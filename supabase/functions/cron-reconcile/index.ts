// Supabase Edge Function for Daily Stripe Reconciliation
// Should be triggered by pg_cron or external scheduler daily
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getCommissionPercent(tier: number): number {
  switch (tier) {
    case 3: return 40;
    case 2: return 35;
    default: return 30;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Reconcile last 30 days
    const days = 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    const stats = {
      subscriptionsProcessed: 0,
      invoicesProcessed: 0,
      refundsProcessed: 0,
      disputesProcessed: 0,
      errors: [] as string[],
    };

    console.log(`Starting daily reconciliation for last ${days} days...`);

    // 1. Reconcile Subscriptions
    console.log("Reconciling subscriptions...");
    for await (const subscription of stripe.subscriptions.list({
      created: { gte: startTimestamp },
      expand: ["data.customer"],
      limit: 100,
    })) {
      try {
        const customerId = typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

        // Get affiliate for customer
        const { data: customerAffiliate } = await supabase
          .from("customer_affiliates")
          .select("affiliate_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!customerAffiliate) continue;

        const customer = subscription.customer as Stripe.Customer;
        const customerName = customer.deleted ? null : customer.name || customer.email;
        const item = subscription.items.data[0];

        await supabase.from("subscriptions").upsert({
          affiliate_id: customerAffiliate.affiliate_id,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customerId,
          customer_name: customerName,
          price_id: item?.price.id,
          amount_cents: item?.price.unit_amount || 0,
          status: subscription.status,
          is_trial: subscription.status === "trialing",
          trial_start: subscription.trial_start
            ? new Date(subscription.trial_start * 1000).toISOString()
            : null,
          trial_end: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
          started_at: subscription.start_date
            ? new Date(subscription.start_date * 1000).toISOString()
            : null,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          canceled_at: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000).toISOString()
            : null,
          last_event_at: new Date().toISOString(),
        }, { onConflict: "stripe_subscription_id" });

        stats.subscriptionsProcessed++;
      } catch (err) {
        stats.errors.push(`Subscription ${subscription.id}: ${err}`);
      }
    }

    // 2. Reconcile Paid Invoices
    console.log("Reconciling invoices...");
    for await (const invoice of stripe.invoices.list({
      created: { gte: startTimestamp },
      status: "paid",
      limit: 100,
    })) {
      try {
        if (!invoice.subscription || !invoice.amount_paid) continue;

        const customerId = invoice.customer as string;

        // Check if transaction already exists
        const { data: existingTx } = await supabase
          .from("transactions")
          .select("id")
          .eq("stripe_invoice_id", invoice.id)
          .single();

        if (existingTx) continue;

        // Get affiliate
        const { data: customerAffiliate } = await supabase
          .from("customer_affiliates")
          .select("affiliate_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!customerAffiliate) continue;

        // Get affiliate tier
        const { data: affiliate } = await supabase
          .from("affiliates")
          .select("commission_tier, paid_subscriptions_count")
          .eq("id", customerAffiliate.affiliate_id)
          .single();

        if (!affiliate) continue;

        const commissionPercent = getCommissionPercent(affiliate.commission_tier);
        const commissionAmount = Math.round(invoice.amount_paid * commissionPercent / 100);

        const paidAt = invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : new Date(invoice.created * 1000);
        const availableAt = new Date(paidAt);
        availableAt.setDate(availableAt.getDate() + 15);

        // Get subscription record
        const { data: subRecord } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("stripe_subscription_id", invoice.subscription)
          .single();

        await supabase.from("transactions").insert({
          affiliate_id: customerAffiliate.affiliate_id,
          subscription_id: subRecord?.id || null,
          stripe_invoice_id: invoice.id,
          stripe_charge_id: invoice.charge as string,
          type: "commission",
          amount_gross_cents: invoice.amount_paid,
          commission_percent: commissionPercent,
          commission_amount_cents: commissionAmount,
          paid_at: paidAt.toISOString(),
          available_at: availableAt.toISOString(),
          description: "Comissão de venda",
        });

        // Check if first invoice for subscription
        if (subRecord) {
          const { count } = await supabase
            .from("transactions")
            .select("id", { count: "exact", head: true })
            .eq("subscription_id", subRecord.id)
            .eq("type", "commission");

          if (count === 1) {
            await supabase
              .from("affiliates")
              .update({ paid_subscriptions_count: affiliate.paid_subscriptions_count + 1 })
              .eq("id", customerAffiliate.affiliate_id);
          }
        }

        stats.invoicesProcessed++;
      } catch (err) {
        stats.errors.push(`Invoice ${invoice.id}: ${err}`);
      }
    }

    // 3. Reconcile Refunds
    console.log("Reconciling refunds...");
    for await (const refund of stripe.refunds.list({
      created: { gte: startTimestamp },
      limit: 100,
    })) {
      try {
        if (!refund.charge) continue;

        const charge = await stripe.charges.retrieve(refund.charge as string);
        const customerId = charge.customer as string;

        if (!customerId) continue;

        // Get affiliate
        const { data: customerAffiliate } = await supabase
          .from("customer_affiliates")
          .select("affiliate_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!customerAffiliate) continue;

        // Find original transaction
        const { data: originalTx } = await supabase
          .from("transactions")
          .select("id, commission_percent, subscription_id")
          .eq("stripe_charge_id", refund.charge)
          .eq("type", "commission")
          .single();

        if (!originalTx) continue;

        // Check if refund transaction exists
        const { data: existingRefund } = await supabase
          .from("transactions")
          .select("id")
          .eq("stripe_charge_id", refund.charge)
          .eq("type", "refund")
          .single();

        if (existingRefund) continue;

        const refundAmount = -Math.round(refund.amount * originalTx.commission_percent / 100);

        await supabase.from("transactions").insert({
          affiliate_id: customerAffiliate.affiliate_id,
          subscription_id: originalTx.subscription_id,
          stripe_charge_id: refund.charge as string,
          type: "refund",
          amount_gross_cents: -refund.amount,
          commission_percent: originalTx.commission_percent,
          commission_amount_cents: refundAmount,
          paid_at: new Date().toISOString(),
          available_at: new Date().toISOString(),
          description: "Estorno de comissão - Refund",
        });

        // Mark subscription
        if (originalTx.subscription_id) {
          await supabase
            .from("subscriptions")
            .update({ has_refund: true })
            .eq("id", originalTx.subscription_id);
        }

        stats.refundsProcessed++;
      } catch (err) {
        stats.errors.push(`Refund ${refund.id}: ${err}`);
      }
    }

    // 4. Reconcile Disputes
    console.log("Reconciling disputes...");
    for await (const dispute of stripe.disputes.list({
      created: { gte: startTimestamp },
      limit: 100,
    })) {
      try {
        const charge = await stripe.charges.retrieve(dispute.charge as string);
        const customerId = charge.customer as string;

        if (!customerId) continue;

        const { data: customerAffiliate } = await supabase
          .from("customer_affiliates")
          .select("affiliate_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!customerAffiliate) continue;

        const { data: originalTx } = await supabase
          .from("transactions")
          .select("id, commission_percent, subscription_id")
          .eq("stripe_charge_id", dispute.charge)
          .eq("type", "commission")
          .single();

        if (!originalTx) continue;

        // Check if dispute transaction exists
        const { data: existingDispute } = await supabase
          .from("transactions")
          .select("id")
          .eq("stripe_charge_id", dispute.charge as string)
          .eq("type", "dispute")
          .single();

        if (existingDispute) continue;

        const disputeAmount = -Math.round(dispute.amount * originalTx.commission_percent / 100);

        await supabase.from("transactions").insert({
          affiliate_id: customerAffiliate.affiliate_id,
          subscription_id: originalTx.subscription_id,
          stripe_charge_id: dispute.charge as string,
          type: "dispute",
          amount_gross_cents: -dispute.amount,
          commission_percent: originalTx.commission_percent,
          commission_amount_cents: disputeAmount,
          paid_at: new Date().toISOString(),
          available_at: new Date().toISOString(),
          description: "Estorno de comissão - Disputa",
        });

        if (originalTx.subscription_id) {
          await supabase
            .from("subscriptions")
            .update({ has_dispute: true })
            .eq("id", originalTx.subscription_id);
        }

        stats.disputesProcessed++;
      } catch (err) {
        stats.errors.push(`Dispute ${dispute.id}: ${err}`);
      }
    }

    console.log("Reconciliation complete!", stats);

    return new Response(
      JSON.stringify({ success: true, ...stats }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Reconciliation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
