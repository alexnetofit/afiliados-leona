import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

const supabase = createClient(
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

export async function POST(request: NextRequest) {
  try {
    const { days = 30 } = await request.json();

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startTimestamp = Math.floor(startDate.getTime() / 1000);

    let processed = 0;

    // 1. Sync Subscriptions
    console.log("Syncing subscriptions...");
    for await (const subscription of stripe.subscriptions.list({
      created: { gte: startTimestamp },
      expand: ["data.customer"],
      limit: 100,
    })) {
      const customer = subscription.customer as Stripe.Customer;
      const customerId = typeof subscription.customer === "string" 
        ? subscription.customer 
        : subscription.customer.id;

      // Check if customer has affiliate
      const { data: customerAffiliate } = await supabase
        .from("customer_affiliates")
        .select("affiliate_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (!customerAffiliate) continue;

      // Get customer name
      const customerName = customer.deleted ? null : customer.name || customer.email;

      // Get price info
      const item = subscription.items.data[0];

      // Upsert subscription
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
      }, { onConflict: "stripe_subscription_id" });

      processed++;
    }

    // 2. Sync Invoices (paid only)
    console.log("Syncing invoices...");
    for await (const invoice of stripe.invoices.list({
      created: { gte: startTimestamp },
      status: "paid",
      limit: 100,
    })) {
      if (!invoice.subscription || !invoice.amount_paid) continue;

      const customerId = invoice.customer as string;

      // Check affiliate
      const { data: customerAffiliate } = await supabase
        .from("customer_affiliates")
        .select("affiliate_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (!customerAffiliate) continue;

      // Check if transaction exists
      const { data: existingTx } = await supabase
        .from("transactions")
        .select("id")
        .eq("stripe_invoice_id", invoice.id)
        .single();

      if (existingTx) continue;

      // Get affiliate tier
      const { data: affiliate } = await supabase
        .from("affiliates")
        .select("commission_tier")
        .eq("id", customerAffiliate.affiliate_id)
        .single();

      if (!affiliate) continue;

      const commissionPercent = getCommissionPercent(affiliate.commission_tier);
      const commissionAmount = Math.round(invoice.amount_paid * commissionPercent / 100);

      const paidAt = invoice.status_transitions?.paid_at 
        ? new Date(invoice.status_transitions.paid_at * 1000) 
        : new Date();
      const availableAt = new Date(paidAt);
      availableAt.setDate(availableAt.getDate() + 15);

      // Get subscription ID
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
        description: "Comissão de venda (resync)",
      });

      processed++;
    }

    // 3. Sync Refunds
    console.log("Syncing refunds...");
    for await (const refund of stripe.refunds.list({
      created: { gte: startTimestamp },
      limit: 100,
    })) {
      if (!refund.charge) continue;

      // Get charge to find customer
      const charge = await stripe.charges.retrieve(refund.charge as string);
      const customerId = charge.customer as string;

      if (!customerId) continue;

      // Check affiliate
      const { data: customerAffiliate } = await supabase
        .from("customer_affiliates")
        .select("affiliate_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (!customerAffiliate) continue;

      // Find original transaction
      const { data: originalTx } = await supabase
        .from("transactions")
        .select("commission_percent, subscription_id")
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
        description: "Estorno de comissão (resync)",
      });

      processed++;
    }

    return NextResponse.json({ success: true, processed });
  } catch (error) {
    console.error("Resync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro no resync" },
      { status: 500 }
    );
  }
}
