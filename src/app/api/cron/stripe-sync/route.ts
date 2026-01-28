import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getCommissionPercent(tier: number): number {
  switch (tier) {
    case 3: return 40;
    case 2: return 35;
    default: return 30;
  }
}

// Helper: Find or create affiliate relationship from customer metadata
async function getOrCreateAffiliateForCustomer(
  customerId: string,
  customerMetadata?: Stripe.Metadata | null
): Promise<string | null> {
  // 1. Check if customer already has an affiliate (First Touch)
  const { data: existing } = await supabaseAdmin
    .from("customer_affiliates")
    .select("affiliate_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (existing) {
    return existing.affiliate_id;
  }

  // 2. Check metadata for affiliate code
  const affiliateCode = 
    customerMetadata?.referral || 
    customerMetadata?.via || 
    customerMetadata?.affiliate_code || 
    customerMetadata?.ref;

  if (!affiliateCode) {
    return null;
  }

  console.log(`[CRON] Found affiliate code: ${affiliateCode} for customer ${customerId}`);

  // 3. Find affiliate by code
  const { data: affiliate } = await supabaseAdmin
    .from("affiliates")
    .select("id")
    .eq("affiliate_code", affiliateCode)
    .single();

  if (affiliate) {
    await supabaseAdmin.from("customer_affiliates").insert({
      stripe_customer_id: customerId,
      affiliate_id: affiliate.id,
    });
    return affiliate.id;
  }

  // 4. Try finding by link alias
  const { data: link } = await supabaseAdmin
    .from("affiliate_links")
    .select("affiliate_id")
    .eq("alias", affiliateCode)
    .single();

  if (link) {
    await supabaseAdmin.from("customer_affiliates").insert({
      stripe_customer_id: customerId,
      affiliate_id: link.affiliate_id,
    });
    return link.affiliate_id;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel sends this header)
    const authHeader = request.headers.get("authorization");
    
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log("[CRON] Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[CRON] Starting automatic Stripe sync (last 3 days)...");

    // Calculate date range (last 3 days)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 3);
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    let processed = 0;
    let customersLinked = 0;

    // 1. Scan customers and link by metadata
    console.log("[CRON] Scanning customers...");
    for await (const customer of stripe.customers.list({
      created: { gte: startTimestamp },
      limit: 100,
    })) {
      if (customer.deleted) continue;

      const affiliateId = await getOrCreateAffiliateForCustomer(
        customer.id,
        customer.metadata
      );

      if (affiliateId) {
        customersLinked++;
      }
    }

    // 2. Sync Subscriptions
    console.log("[CRON] Syncing subscriptions...");
    for await (const subscription of stripe.subscriptions.list({
      created: { gte: startTimestamp },
      expand: ["data.customer"],
      limit: 100,
    })) {
      const customer = subscription.customer as Stripe.Customer;
      const customerId = typeof subscription.customer === "string" 
        ? subscription.customer 
        : subscription.customer.id;

      const customerObj = customer.deleted ? null : customer;
      const affiliateId = await getOrCreateAffiliateForCustomer(
        customerId,
        customerObj?.metadata
      );

      if (!affiliateId) continue;

      const customerName = customerObj?.name || customerObj?.email || null;
      const item = subscription.items.data[0];
      const sub = subscription as any;
      const currentPeriodEnd = sub.current_period_end || item?.current_period_end;

      await supabaseAdmin.from("subscriptions").upsert({
        affiliate_id: affiliateId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        customer_name: customerName,
        price_id: item?.price.id,
        amount_cents: item?.price.unit_amount || 0,
        status: subscription.status,
        is_trial: subscription.status === "trialing",
        trial_start: sub.trial_start 
          ? new Date(sub.trial_start * 1000).toISOString() 
          : null,
        trial_end: sub.trial_end 
          ? new Date(sub.trial_end * 1000).toISOString() 
          : null,
        started_at: sub.start_date 
          ? new Date(sub.start_date * 1000).toISOString() 
          : null,
        current_period_end: currentPeriodEnd 
          ? new Date(currentPeriodEnd * 1000).toISOString() 
          : null,
        canceled_at: sub.canceled_at 
          ? new Date(sub.canceled_at * 1000).toISOString() 
          : null,
      }, { onConflict: "stripe_subscription_id" });

      processed++;
    }

    // 3. Sync Invoices (paid only)
    console.log("[CRON] Syncing invoices...");
    for await (const invoice of stripe.invoices.list({
      created: { gte: startTimestamp },
      status: "paid",
      expand: ["data.customer"],
      limit: 100,
    })) {
      const inv = invoice as any;
      if (!inv.subscription || !inv.amount_paid) continue;

      const customerId = inv.customer?.id || inv.customer as string;
      const customerObj = typeof inv.customer === 'object' && !inv.customer?.deleted 
        ? inv.customer 
        : null;
      
      const affiliateId = await getOrCreateAffiliateForCustomer(
        customerId,
        customerObj?.metadata
      );

      if (!affiliateId) continue;

      // Check if transaction exists
      const { data: existingTx } = await supabaseAdmin
        .from("transactions")
        .select("id")
        .eq("stripe_invoice_id", invoice.id)
        .single();

      if (existingTx) continue;

      // Get affiliate tier
      const { data: affiliate } = await supabaseAdmin
        .from("affiliates")
        .select("commission_tier")
        .eq("id", affiliateId)
        .single();

      if (!affiliate) continue;

      const commissionPercent = getCommissionPercent(affiliate.commission_tier);
      const commissionAmount = Math.round(inv.amount_paid * commissionPercent / 100);

      const paidAt = inv.status_transitions?.paid_at 
        ? new Date(inv.status_transitions.paid_at * 1000) 
        : new Date();
      const availableAt = new Date(paidAt);
      availableAt.setDate(availableAt.getDate() + 15);

      const { data: subRecord } = await supabaseAdmin
        .from("subscriptions")
        .select("id")
        .eq("stripe_subscription_id", inv.subscription)
        .single();

      await supabaseAdmin.from("transactions").insert({
        affiliate_id: affiliateId,
        subscription_id: subRecord?.id || null,
        stripe_invoice_id: invoice.id,
        stripe_charge_id: inv.charge as string,
        type: "commission",
        amount_gross_cents: inv.amount_paid,
        commission_percent: commissionPercent,
        commission_amount_cents: commissionAmount,
        paid_at: paidAt.toISOString(),
        available_at: availableAt.toISOString(),
        description: "Comissão de venda (cron sync)",
      });

      processed++;
    }

    // 4. Sync Refunds
    console.log("[CRON] Syncing refunds...");
    for await (const refund of stripe.refunds.list({
      created: { gte: startTimestamp },
      limit: 100,
    })) {
      if (!refund.charge) continue;

      const charge = await stripe.charges.retrieve(refund.charge as string);
      const customerId = charge.customer as string;

      if (!customerId) continue;

      const { data: customerAffiliate } = await supabaseAdmin
        .from("customer_affiliates")
        .select("affiliate_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (!customerAffiliate) continue;

      const { data: originalTx } = await supabaseAdmin
        .from("transactions")
        .select("commission_percent, subscription_id")
        .eq("stripe_charge_id", refund.charge)
        .eq("type", "commission")
        .single();

      if (!originalTx) continue;

      const { data: existingRefund } = await supabaseAdmin
        .from("transactions")
        .select("id")
        .eq("stripe_charge_id", refund.charge)
        .eq("type", "refund")
        .single();

      if (existingRefund) continue;

      const refundAmount = -Math.round(refund.amount * originalTx.commission_percent / 100);

      await supabaseAdmin.from("transactions").insert({
        affiliate_id: customerAffiliate.affiliate_id,
        subscription_id: originalTx.subscription_id,
        stripe_charge_id: refund.charge as string,
        type: "refund",
        amount_gross_cents: -refund.amount,
        commission_percent: originalTx.commission_percent,
        commission_amount_cents: refundAmount,
        paid_at: new Date().toISOString(),
        available_at: new Date().toISOString(),
        description: "Estorno de comissão (cron sync)",
      });

      processed++;
    }

    const message = `[CRON] Sync completed: ${processed} records, ${customersLinked} customers linked`;
    console.log(message);

    return NextResponse.json({ 
      success: true, 
      processed,
      customersLinked,
      message
    });
  } catch (error) {
    console.error("[CRON] Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron sync error" },
      { status: 500 }
    );
  }
}
