import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-18.acacia",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REWARDFUL_API_URL = "https://api.getrewardful.com/v1";
const REWARDFUL_API_SECRET = process.env.REWARDFUL_API_SECRET;

interface RewardfulAffiliate {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  token: string;
  state: string;
  confirmed_at: string;
}

interface RewardfulReferral {
  id: string;
  stripe_customer_id: string;
  affiliate: {
    id: string;
  };
}

async function fetchRewardful(endpoint: string) {
  const response = await fetch(`${REWARDFUL_API_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${REWARDFUL_API_SECRET}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Rewardful API error: ${response.status}`);
  }

  return response.json();
}

function getCommissionPercent(tier: number): number {
  switch (tier) {
    case 3: return 40;
    case 2: return 35;
    default: return 30;
  }
}

export async function POST() {
  if (!REWARDFUL_API_SECRET) {
    return NextResponse.json(
      { error: "REWARDFUL_API_SECRET não configurado" },
      { status: 400 }
    );
  }

  try {
    const stats = {
      affiliates: 0,
      customers: 0,
      transactions: 0,
      errors: [] as string[],
    };

    // 1. Fetch all affiliates from Rewardful
    console.log("Fetching affiliates from Rewardful...");
    const { data: rewardfulAffiliates } = await fetchRewardful("/affiliates?per_page=100");

    // Map to store rewardful_id -> our affiliate_id
    const affiliateMap = new Map<string, string>();

    // 2. Import affiliates
    for (const rwAffiliate of rewardfulAffiliates as RewardfulAffiliate[]) {
      try {
        // Check if already migrated (by email or code)
        const { data: existingByCode } = await supabase
          .from("affiliates")
          .select("id, user_id")
          .eq("affiliate_code", rwAffiliate.token)
          .single();

        if (existingByCode) {
          affiliateMap.set(rwAffiliate.id, existingByCode.id);
          continue;
        }

        // Create auth user
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: rwAffiliate.email,
          email_confirm: true,
          password: crypto.randomUUID(), // Temporary password
          user_metadata: {
            full_name: `${rwAffiliate.first_name} ${rwAffiliate.last_name}`.trim(),
            migrated_from: "rewardful",
          },
        });

        if (authError) {
          // User might exist, try to find
          const { data: existingUsers } = await supabase.auth.admin.listUsers();
          const existingUser = existingUsers?.users.find(u => u.email === rwAffiliate.email);
          
          if (existingUser) {
            // Get affiliate for this user
            const { data: existingAffiliate } = await supabase
              .from("affiliates")
              .select("id")
              .eq("user_id", existingUser.id)
              .single();

            if (existingAffiliate) {
              // Update affiliate code
              await supabase
                .from("affiliates")
                .update({ affiliate_code: rwAffiliate.token })
                .eq("id", existingAffiliate.id);

              affiliateMap.set(rwAffiliate.id, existingAffiliate.id);
              stats.affiliates++;
              continue;
            }
          }

          stats.errors.push(`Failed to create user for ${rwAffiliate.email}: ${authError.message}`);
          continue;
        }

        // Create profile (trigger should do this, but we'll ensure)
        await supabase.from("profiles").upsert({
          id: authUser.user.id,
          full_name: `${rwAffiliate.first_name} ${rwAffiliate.last_name}`.trim(),
          role: "affiliate",
        }, { onConflict: "id" });

        // Create affiliate with original code
        const { data: newAffiliate, error: affError } = await supabase
          .from("affiliates")
          .upsert({
            user_id: authUser.user.id,
            affiliate_code: rwAffiliate.token, // Preserve original code!
            is_active: rwAffiliate.state === "active",
          }, { onConflict: "user_id" })
          .select("id")
          .single();

        if (affError || !newAffiliate) {
          stats.errors.push(`Failed to create affiliate for ${rwAffiliate.email}`);
          continue;
        }

        affiliateMap.set(rwAffiliate.id, newAffiliate.id);
        stats.affiliates++;
      } catch (err) {
        stats.errors.push(`Error processing affiliate ${rwAffiliate.email}: ${err}`);
      }
    }

    // 3. Fetch referrals (customer -> affiliate mapping)
    console.log("Fetching referrals from Rewardful...");
    const { data: referrals } = await fetchRewardful("/referrals?per_page=100");

    for (const referral of referrals as RewardfulReferral[]) {
      if (!referral.stripe_customer_id) continue;

      const affiliateId = affiliateMap.get(referral.affiliate.id);
      if (!affiliateId) continue;

      // Create customer_affiliate (First Touch)
      const { error } = await supabase.from("customer_affiliates").upsert({
        stripe_customer_id: referral.stripe_customer_id,
        affiliate_id: affiliateId,
      }, { onConflict: "stripe_customer_id" });

      if (!error) {
        stats.customers++;
      }
    }

    // 4. Import historical transactions from Stripe
    console.log("Importing historical transactions...");
    const processedInvoices = new Set<string>();

    for (const [, affiliateId] of affiliateMap) {
      // Get all customers for this affiliate
      const { data: customers } = await supabase
        .from("customer_affiliates")
        .select("stripe_customer_id")
        .eq("affiliate_id", affiliateId);

      if (!customers) continue;

      for (const customer of customers) {
        // Fetch paid invoices for this customer
        for await (const invoice of stripe.invoices.list({
          customer: customer.stripe_customer_id,
          status: "paid",
          limit: 100,
        })) {
          if (processedInvoices.has(invoice.id)) continue;
          processedInvoices.add(invoice.id);

          if (!invoice.amount_paid) continue;

          // Check if transaction exists
          const { data: existingTx } = await supabase
            .from("transactions")
            .select("id")
            .eq("stripe_invoice_id", invoice.id)
            .single();

          if (existingTx) continue;

          // Calculate commission (use tier 1 for historical)
          const commissionPercent = 30;
          const commissionAmount = Math.round(invoice.amount_paid * commissionPercent / 100);

          const paidAt = invoice.status_transitions?.paid_at
            ? new Date(invoice.status_transitions.paid_at * 1000)
            : new Date(invoice.created * 1000);
          const availableAt = new Date(paidAt);
          availableAt.setDate(availableAt.getDate() + 15);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const invoiceAny = invoice as any;
          await supabase.from("transactions").insert({
            affiliate_id: affiliateId,
            stripe_invoice_id: invoice.id,
            stripe_charge_id: invoiceAny.charge || invoiceAny.payment_intent || null,
            type: "commission",
            amount_gross_cents: invoice.amount_paid,
            commission_percent: commissionPercent,
            commission_amount_cents: commissionAmount,
            paid_at: paidAt.toISOString(),
            available_at: availableAt.toISOString(),
            description: "Comissão histórica (migração Rewardful)",
          });

          stats.transactions++;
        }
      }
    }

    // 5. Recalculate tiers for all affiliates
    console.log("Recalculating tiers...");
    for (const [, affiliateId] of affiliateMap) {
      // Count unique subscriptions with paid transactions
      const { count } = await supabase
        .from("transactions")
        .select("subscription_id", { count: "exact", head: true })
        .eq("affiliate_id", affiliateId)
        .eq("type", "commission")
        .not("subscription_id", "is", null);

      const paidCount = count || 0;
      let tier = 1;
      if (paidCount >= 50) tier = 3;
      else if (paidCount >= 20) tier = 2;

      await supabase
        .from("affiliates")
        .update({
          paid_subscriptions_count: paidCount,
          commission_tier: tier,
        })
        .eq("id", affiliateId);
    }

    // 6. Generate historical monthly payouts as "paid"
    console.log("Generating historical payouts...");
    const { data: allTransactions } = await supabase
      .from("transactions")
      .select("affiliate_id, commission_amount_cents, available_at, type")
      .order("available_at", { ascending: true });

    if (allTransactions) {
      // Group by affiliate and month
      const payoutMap = new Map<string, Map<string, { commissions: number; negatives: number }>>();

      for (const tx of allTransactions) {
        if (!tx.available_at) continue;

        const date = new Date(tx.available_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
        const affiliateKey = tx.affiliate_id;
        const mapKey = `${affiliateKey}_${monthKey}`;

        if (!payoutMap.has(mapKey)) {
          payoutMap.set(mapKey, new Map());
        }

        const affiliatePayouts = payoutMap.get(mapKey)!;
        if (!affiliatePayouts.has(monthKey)) {
          affiliatePayouts.set(monthKey, { commissions: 0, negatives: 0 });
        }

        const monthData = affiliatePayouts.get(monthKey)!;
        if (tx.type === "commission") {
          monthData.commissions += tx.commission_amount_cents;
        } else {
          monthData.negatives += Math.abs(tx.commission_amount_cents);
        }
      }

      // Create payout records
      for (const [mapKey] of payoutMap) {
        const [affiliateId, monthKey] = mapKey.split("_");
        const affiliatePayouts = payoutMap.get(mapKey)!;
        const monthData = affiliatePayouts.get(monthKey)!;

        // Only create for past months
        const payoutMonth = new Date(monthKey);
        if (payoutMonth >= new Date()) continue;

        await supabase.from("monthly_payouts").upsert({
          month: monthKey,
          affiliate_id: affiliateId,
          total_commission_cents: monthData.commissions,
          total_negative_cents: monthData.negatives,
          total_payable_cents: Math.max(monthData.commissions - monthData.negatives, 0),
          status: "paid",
          paid_at: new Date().toISOString(),
          paid_note: "Migração do Rewardful",
        }, { onConflict: "month,affiliate_id" });
      }
    }

    console.log("Migration complete!", stats);

    return NextResponse.json({
      success: true,
      ...stats,
    });
  } catch (error) {
    console.error("Migration error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro na migração" },
      { status: 500 }
    );
  }
}
