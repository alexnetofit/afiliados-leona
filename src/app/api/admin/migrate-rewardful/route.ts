import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
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

interface RewardfulPaginatedResponse<T> {
  data: T[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
  };
}

// Fetch all pages from Rewardful API
async function fetchAllRewardful<T>(endpoint: string): Promise<T[]> {
  const allData: T[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await fetch(`${REWARDFUL_API_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}&per_page=100`, {
      headers: {
        Authorization: `Bearer ${REWARDFUL_API_SECRET}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Rewardful API error: ${response.status}`);
    }

    const json = await response.json() as RewardfulPaginatedResponse<T>;
    allData.push(...json.data);
    
    totalPages = json.pagination?.total_pages || 1;
    page++;
  } while (page <= totalPages);

  return allData;
}

export async function POST() {
  // Create a streaming response
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // 1. Verify admin authentication
        const supabaseAuth = await createServerClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();

        if (!user) {
          sendEvent({ type: "error", message: "Não autenticado" });
          controller.close();
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profile?.role !== "admin") {
          sendEvent({ type: "error", message: "Acesso negado" });
          controller.close();
          return;
        }

        if (!REWARDFUL_API_SECRET) {
          sendEvent({ type: "error", message: "REWARDFUL_API_SECRET não configurado" });
          controller.close();
          return;
        }

        const stats = {
          affiliates: 0,
          affiliatesSkipped: 0,
          customers: 0,
          transactions: 0,
          errors: [] as string[],
        };

        sendEvent({ type: "start", message: "Iniciando migração do Rewardful..." });

        // 2. Fetch ALL affiliates from Rewardful (with pagination)
        sendEvent({ type: "progress", step: "affiliates", message: "Buscando afiliados do Rewardful..." });
        
        const rewardfulAffiliates = await fetchAllRewardful<RewardfulAffiliate>("/affiliates");
        
        sendEvent({ 
          type: "progress", 
          step: "affiliates", 
          message: `${rewardfulAffiliates.length} afiliados encontrados no Rewardful` 
        });

        // Map to store rewardful_id -> our affiliate_id
        const affiliateMap = new Map<string, string>();

        // 3. Import affiliates
        for (let i = 0; i < rewardfulAffiliates.length; i++) {
          const rwAffiliate = rewardfulAffiliates[i];
          
          try {
            // Check if already migrated (by code)
            const { data: existingByCode } = await supabase
              .from("affiliates")
              .select("id, user_id")
              .eq("affiliate_code", rwAffiliate.token)
              .single();

            if (existingByCode) {
              affiliateMap.set(rwAffiliate.id, existingByCode.id);
              stats.affiliatesSkipped++;
              continue;
            }

            // Check by email
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
                // Update affiliate code to match Rewardful
                await supabase
                  .from("affiliates")
                  .update({ affiliate_code: rwAffiliate.token })
                  .eq("id", existingAffiliate.id);

                affiliateMap.set(rwAffiliate.id, existingAffiliate.id);
                stats.affiliates++;
                continue;
              }
            }

            // Create new auth user
            const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
              email: rwAffiliate.email,
              email_confirm: true,
              password: crypto.randomUUID(),
              user_metadata: {
                full_name: `${rwAffiliate.first_name} ${rwAffiliate.last_name}`.trim(),
                migrated_from: "rewardful",
              },
            });

            if (authError) {
              stats.errors.push(`${rwAffiliate.email}: ${authError.message}`);
              continue;
            }

            // Create profile
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
                affiliate_code: rwAffiliate.token,
                is_active: rwAffiliate.state === "active",
              }, { onConflict: "user_id" })
              .select("id")
              .single();

            if (affError || !newAffiliate) {
              stats.errors.push(`Erro ao criar afiliado: ${rwAffiliate.email}`);
              continue;
            }

            affiliateMap.set(rwAffiliate.id, newAffiliate.id);
            stats.affiliates++;
          } catch (err) {
            stats.errors.push(`${rwAffiliate.email}: ${err}`);
          }

          // Progress update every 10 affiliates
          if ((i + 1) % 10 === 0 || i === rewardfulAffiliates.length - 1) {
            sendEvent({ 
              type: "progress", 
              step: "affiliates", 
              message: `${i + 1}/${rewardfulAffiliates.length} afiliados processados (${stats.affiliates} novos, ${stats.affiliatesSkipped} já existiam)` 
            });
          }
        }

        sendEvent({ 
          type: "progress", 
          step: "affiliates", 
          message: `Concluído: ${stats.affiliates} afiliados importados, ${stats.affiliatesSkipped} já existiam`,
          completed: true
        });

        // 4. Fetch ALL referrals (with pagination)
        sendEvent({ type: "progress", step: "referrals", message: "Buscando referrals do Rewardful..." });
        
        const referrals = await fetchAllRewardful<RewardfulReferral>("/referrals");
        
        sendEvent({ 
          type: "progress", 
          step: "referrals", 
          message: `${referrals.length} referrals encontrados` 
        });

        for (let i = 0; i < referrals.length; i++) {
          const referral = referrals[i];
          
          if (!referral.stripe_customer_id) continue;

          const affiliateId = affiliateMap.get(referral.affiliate.id);
          if (!affiliateId) continue;

          const { error } = await supabase.from("customer_affiliates").upsert({
            stripe_customer_id: referral.stripe_customer_id,
            affiliate_id: affiliateId,
          }, { onConflict: "stripe_customer_id" });

          if (!error) {
            stats.customers++;
          }

          if ((i + 1) % 50 === 0 || i === referrals.length - 1) {
            sendEvent({ 
              type: "progress", 
              step: "referrals", 
              message: `${i + 1}/${referrals.length} referrals processados (${stats.customers} clientes vinculados)` 
            });
          }
        }

        sendEvent({ 
          type: "progress", 
          step: "referrals", 
          message: `Concluído: ${stats.customers} clientes vinculados a afiliados`,
          completed: true
        });

        // 5. Import historical transactions from Stripe
        sendEvent({ type: "progress", step: "transactions", message: "Importando transações do Stripe..." });
        
        const processedInvoices = new Set<string>();
        let affiliateCount = 0;

        for (const [, affiliateId] of affiliateMap) {
          affiliateCount++;
          
          const { data: customers } = await supabase
            .from("customer_affiliates")
            .select("stripe_customer_id")
            .eq("affiliate_id", affiliateId);

          if (!customers) continue;

          for (const customer of customers) {
            try {
              for await (const invoice of stripe.invoices.list({
                customer: customer.stripe_customer_id,
                status: "paid",
                limit: 100,
              })) {
                if (processedInvoices.has(invoice.id)) continue;
                processedInvoices.add(invoice.id);

                if (!invoice.amount_paid) continue;

                const { data: existingTx } = await supabase
                  .from("transactions")
                  .select("id")
                  .eq("stripe_invoice_id", invoice.id)
                  .single();

                if (existingTx) continue;

                const commissionPercent = 30;
                const commissionAmount = Math.round(invoice.amount_paid * commissionPercent / 100);

                const paidAt = invoice.status_transitions?.paid_at
                  ? new Date(invoice.status_transitions.paid_at * 1000)
                  : new Date(invoice.created * 1000);
                const availableAt = new Date(paidAt);
                availableAt.setDate(availableAt.getDate() + 15);

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
            } catch (err) {
              // Skip customers that don't exist in Stripe
            }
          }

          if (affiliateCount % 5 === 0 || affiliateCount === affiliateMap.size) {
            sendEvent({ 
              type: "progress", 
              step: "transactions", 
              message: `${affiliateCount}/${affiliateMap.size} afiliados processados, ${stats.transactions} transações importadas` 
            });
          }
        }

        sendEvent({ 
          type: "progress", 
          step: "transactions", 
          message: `Concluído: ${stats.transactions} transações históricas importadas`,
          completed: true
        });

        // 6. Recalculate tiers
        sendEvent({ type: "progress", step: "tiers", message: "Recalculando tiers de comissão..." });
        
        for (const [, affiliateId] of affiliateMap) {
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

        sendEvent({ 
          type: "progress", 
          step: "tiers", 
          message: "Tiers de comissão atualizados",
          completed: true
        });

        // 7. Generate historical payouts
        sendEvent({ type: "progress", step: "payouts", message: "Gerando histórico de pagamentos..." });
        
        const { data: allTransactions } = await supabase
          .from("transactions")
          .select("affiliate_id, commission_amount_cents, available_at, type")
          .order("available_at", { ascending: true });

        if (allTransactions) {
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

          let payoutsCreated = 0;
          for (const [mapKey] of payoutMap) {
            const [affiliateId, monthKey] = mapKey.split("_");
            const affiliatePayouts = payoutMap.get(mapKey)!;
            const monthData = affiliatePayouts.get(monthKey)!;

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
            
            payoutsCreated++;
          }

          sendEvent({ 
            type: "progress", 
            step: "payouts", 
            message: `${payoutsCreated} registros de pagamento gerados`,
            completed: true
          });
        }

        // Complete
        sendEvent({ 
          type: "complete", 
          message: "Migração concluída!",
          summary: {
            affiliates: stats.affiliates,
            affiliatesSkipped: stats.affiliatesSkipped,
            customers: stats.customers,
            transactions: stats.transactions,
            errors: stats.errors.length,
          }
        });

        if (stats.errors.length > 0) {
          sendEvent({ 
            type: "errors", 
            errors: stats.errors.slice(0, 20) // Limit to 20 errors
          });
        }

      } catch (error) {
        sendEvent({ 
          type: "error", 
          message: error instanceof Error ? error.message : "Erro na migração" 
        });
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
