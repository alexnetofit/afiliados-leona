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

// Helper: Get date components in São Paulo timezone (UTC-3)
function getDateInBRT(date: Date): { day: number; month: number; year: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  return {
    day: parseInt(parts.find(p => p.type === 'day')?.value || '1'),
    month: parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1, // 0-indexed
    year: parseInt(parts.find(p => p.type === 'year')?.value || '2026'),
  };
}

// Helper: Calculate available_at based on payout schedule in BRT
function calculateAvailableAtBRT(paidAt: Date): Date {
  const brt = getDateInBRT(paidAt);
  const nextMonth = new Date(brt.year, brt.month + 1, 1);
  
  if (brt.day <= 15) {
    return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 5, 12, 0, 0);
  } else {
    return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 20, 12, 0, 0);
  }
}

// Cache for affiliate lookups
const affiliateCache = new Map<string, string | null>();

// Helper: Find or create affiliate relationship from customer metadata
async function getOrCreateAffiliateForCustomer(
  customerId: string,
  customerMetadata?: Stripe.Metadata | null
): Promise<string | null> {
  if (affiliateCache.has(customerId)) {
    return affiliateCache.get(customerId) || null;
  }

  const { data: existing } = await supabaseAdmin
    .from("customer_affiliates")
    .select("affiliate_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (existing) {
    affiliateCache.set(customerId, existing.affiliate_id);
    return existing.affiliate_id;
  }

  // Check Link first, then referral, then others
  const affiliateCode = 
    customerMetadata?.Link ||
    customerMetadata?.referral ||
    customerMetadata?.link ||
    customerMetadata?.via ||
    customerMetadata?.affiliate_code ||
    customerMetadata?.ref;

  if (!affiliateCode) {
    affiliateCache.set(customerId, null);
    return null;
  }

  // Find affiliate by code (exact match on affiliate_code)
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
    affiliateCache.set(customerId, affiliate.id);
    return affiliate.id;
  }

  // Try finding by custom alias (from affiliate_links table)
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
    affiliateCache.set(customerId, link.affiliate_id);
    return link.affiliate_id;
  }

  affiliateCache.set(customerId, null);
  return null;
}

export async function GET(request: NextRequest) {
  // Clear cache
  affiliateCache.clear();

  let syncLogId: string | null = null;

  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log("[CRON] Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[CRON] Starting automatic Stripe sync (last 3 days)...");

    const days = 3;

    // Create sync log entry
    const { data: syncLog } = await supabaseAdmin
      .from("sync_logs")
      .insert({
        days_synced: days,
        triggered_by: "cron",
        status: "running",
      })
      .select("id")
      .single();

    syncLogId = syncLog?.id || null;

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    let customersScanned = 0;
    let customersLinked = 0;
    let subscriptionsSynced = 0;
    let invoicesSynced = 0;
    let refundsSynced = 0;

    // 1. Scan customers
    console.log("[CRON] Scanning customers...");
    const customers: Stripe.Customer[] = [];
    for await (const customer of stripe.customers.list({
      created: { gte: startTimestamp },
      limit: 100,
    })) {
      if (!customer.deleted) {
        customers.push(customer);
      }
    }

    customersScanned = customers.length;

    // Process in batches
    for (let i = 0; i < customers.length; i += 10) {
      const batch = customers.slice(i, i + 10);
      await Promise.all(batch.map(async (customer) => {
        const affiliateId = await getOrCreateAffiliateForCustomer(
          customer.id,
          customer.metadata
        );
        if (affiliateId) {
          customersLinked++;
        }
      }));
    }

    console.log(`[CRON] ${customersLinked} customers linked`);

    // 2. Sync Subscriptions - fetch both created AND recently updated
    console.log("[CRON] Syncing subscriptions...");
    const subscriptionMap = new Map<string, Stripe.Subscription>();

    // 2a. Recently created
    for await (const sub of stripe.subscriptions.list({
      created: { gte: startTimestamp },
      expand: ["data.customer"],
      limit: 100,
    })) {
      subscriptionMap.set(sub.id, sub);
    }

    // 2b. Recently changed period (catches trial->active, renewals)
    for await (const sub of stripe.subscriptions.list({
      current_period_start: { gte: startTimestamp },
      expand: ["data.customer"],
      limit: 100,
    })) {
      subscriptionMap.set(sub.id, sub);
    }

    const subscriptions = Array.from(subscriptionMap.values());

    for (let i = 0; i < subscriptions.length; i += 10) {
      const batch = subscriptions.slice(i, i + 10);
      await Promise.all(batch.map(async (subscription) => {
        const customer = subscription.customer as Stripe.Customer;
        const customerId = typeof subscription.customer === "string" 
          ? subscription.customer 
          : subscription.customer.id;

        const customerObj = customer.deleted ? null : customer;
        const affiliateId = await getOrCreateAffiliateForCustomer(
          customerId,
          customerObj?.metadata
        );

        if (!affiliateId) return;

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

        subscriptionsSynced++;
      }));
    }

    console.log(`[CRON] ${subscriptionsSynced} subscriptions synced`);

    // 3. Sync Invoices
    console.log("[CRON] Syncing invoices...");
    const invoices: Stripe.Invoice[] = [];
    for await (const invoice of stripe.invoices.list({
      created: { gte: startTimestamp },
      status: "paid",
      expand: ["data.customer"],
      limit: 100,
    })) {
      invoices.push(invoice);
    }

    for (let i = 0; i < invoices.length; i += 10) {
      const batch = invoices.slice(i, i + 10);
      await Promise.all(batch.map(async (invoice) => {
        const inv = invoice as any;
        
        // Skip invoices without payment
        if (!inv.amount_paid) return;

        // Extract subscription ID from lines if not directly available
        let subscriptionId = inv.subscription;
        if (!subscriptionId && inv.lines?.data?.length > 0) {
          const firstLine = inv.lines.data[0];
          subscriptionId = firstLine?.parent?.subscription_item_details?.subscription || 
                           firstLine?.subscription || 
                           null;
        }

        const customerId = inv.customer?.id || inv.customer as string;
        const customerObj = typeof inv.customer === 'object' && !inv.customer?.deleted 
          ? inv.customer 
          : null;
        
        const affiliateId = await getOrCreateAffiliateForCustomer(
          customerId,
          customerObj?.metadata
        );

        if (!affiliateId) return;

        const { data: existingTx } = await supabaseAdmin
          .from("transactions")
          .select("id")
          .eq("stripe_invoice_id", invoice.id)
          .single();

        if (existingTx) return;

        const { data: affiliate } = await supabaseAdmin
          .from("affiliates")
          .select("commission_tier")
          .eq("id", affiliateId)
          .single();

        if (!affiliate) return;

        const commissionPercent = getCommissionPercent(affiliate.commission_tier);
        const commissionAmount = Math.round(inv.amount_paid * commissionPercent / 100);

        const paidAt = inv.status_transitions?.paid_at 
          ? new Date(inv.status_transitions.paid_at * 1000) 
          : new Date();
        // Calculate available_at based on payout schedule in BRT timezone
        const availableAt = calculateAvailableAtBRT(paidAt);

        const { data: subRecord } = subscriptionId ? await supabaseAdmin
          .from("subscriptions")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .single() : { data: null };

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

        invoicesSynced++;
      }));
    }

    console.log(`[CRON] ${invoicesSynced} invoices synced`);

    // 4. Sync Refunds
    console.log("[CRON] Syncing refunds...");
    const refunds: Stripe.Refund[] = [];
    for await (const refund of stripe.refunds.list({
      created: { gte: startTimestamp },
      expand: ["data.charge"],
      limit: 100,
    })) {
      refunds.push(refund);
    }

    for (const refund of refunds) {
      if (!refund.charge) continue;

      const charge = typeof refund.charge === 'object' 
        ? refund.charge 
        : await stripe.charges.retrieve(refund.charge);
      
      const customerId = charge.customer as string;
      if (!customerId) continue;

      const { data: customerAffiliate } = await supabaseAdmin
        .from("customer_affiliates")
        .select("affiliate_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (!customerAffiliate) continue;

      const chargeId = typeof refund.charge === 'string' ? refund.charge : refund.charge.id;

      const { data: originalTx } = await supabaseAdmin
        .from("transactions")
        .select("commission_percent, subscription_id")
        .eq("stripe_charge_id", chargeId)
        .eq("type", "commission")
        .single();

      if (!originalTx) continue;

      const { data: existingRefund } = await supabaseAdmin
        .from("transactions")
        .select("id")
        .eq("stripe_charge_id", chargeId)
        .eq("type", "refund")
        .single();

      if (existingRefund) continue;

      const refundAmount = -Math.round(refund.amount * originalTx.commission_percent / 100);

      await supabaseAdmin.from("transactions").insert({
        affiliate_id: customerAffiliate.affiliate_id,
        subscription_id: originalTx.subscription_id,
        stripe_charge_id: chargeId,
        type: "refund",
        amount_gross_cents: -refund.amount,
        commission_percent: originalTx.commission_percent,
        commission_amount_cents: refundAmount,
        paid_at: new Date().toISOString(),
        available_at: new Date().toISOString(),
        description: "Estorno de comissão (cron sync)",
      });

      refundsSynced++;
    }

    console.log(`[CRON] ${refundsSynced} refunds synced`);

    // Update sync log
    if (syncLogId) {
      await supabaseAdmin.from("sync_logs").update({
        customers_scanned: customersScanned,
        customers_linked: customersLinked,
        subscriptions_synced: subscriptionsSynced,
        invoices_synced: invoicesSynced,
        refunds_synced: refundsSynced,
        status: "completed",
        finished_at: new Date().toISOString(),
      }).eq("id", syncLogId);
    }

    const message = `[CRON] Sync completed: ${subscriptionsSynced + invoicesSynced + refundsSynced} records, ${customersLinked} customers linked`;
    console.log(message);

    return NextResponse.json({ 
      success: true, 
      customersScanned,
      customersLinked,
      subscriptionsSynced,
      invoicesSynced,
      refundsSynced,
      message
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Cron sync error";
    console.error("[CRON] Sync error:", error);

    // Update sync log with error
    if (syncLogId) {
      await supabaseAdmin.from("sync_logs").update({
        status: "error",
        error_message: errorMessage,
        finished_at: new Date().toISOString(),
      }).eq("id", syncLogId);
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
