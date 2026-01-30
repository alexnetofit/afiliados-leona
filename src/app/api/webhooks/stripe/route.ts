import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

// Initialize Supabase with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// Helper Functions
// ============================================

async function getAffiliateForCustomer(
  customerId: string,
  metadata?: Stripe.Metadata | null
): Promise<string | null> {
  // 1. Check customer_affiliates (First Touch - never changes)
  const { data: existing } = await supabase
    .from("customer_affiliates")
    .select("affiliate_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (existing) {
    return existing.affiliate_id;
  }

  // 2. If no First Touch, check metadata for affiliate code
  // Priority: Link first (readable code), then referral as fallback
  const affiliateCode = 
    metadata?.Link ||
    metadata?.link ||
    metadata?.via || 
    metadata?.affiliate_code || 
    metadata?.ref ||
    metadata?.referral;
  
  if (!affiliateCode) {
    return null;
  }
  
  console.log(`Found affiliate code in metadata: ${affiliateCode} for customer ${customerId}`);

  // Find affiliate by code (exact match or in semicolon-separated list)
  let affiliate = await supabase
    .from("affiliates")
    .select("id")
    .eq("affiliate_code", affiliateCode)
    .single()
    .then(r => r.data);

  // If not found, try searching in semicolon-separated codes
  if (!affiliate) {
    const { data: affiliates } = await supabase
      .from("affiliates")
      .select("id, affiliate_code")
      .ilike("affiliate_code", `%${affiliateCode}%`);
    
    affiliate = affiliates?.find(a => 
      a.affiliate_code.split(';').map((c: string) => c.trim().toLowerCase()).includes(affiliateCode.toLowerCase())
    ) || null;
  }

  // Try finding by custom alias (created by affiliate in dashboard)
  if (!affiliate) {
    const { data: link } = await supabase
      .from("affiliate_links")
      .select("affiliate_id")
      .eq("alias", affiliateCode)
      .single();

    if (!link) {
      return null;
    }

    await supabase.from("customer_affiliates").insert({
      stripe_customer_id: customerId,
      affiliate_id: link.affiliate_id,
    });

    return link.affiliate_id;
  }

  // Create First Touch
  await supabase.from("customer_affiliates").insert({
    stripe_customer_id: customerId,
    affiliate_id: affiliate.id,
  });

  return affiliate.id;
}

function getCommissionPercent(tier: number): number {
  switch (tier) {
    case 3: return 40;
    case 2: return 35;
    default: return 30;
  }
}

async function getSubscriptionByStripeId(stripeSubscriptionId: string) {
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .single();
  return data;
}

// ============================================
// Event Handlers
// ============================================

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  if (!customerId) return;

  // Get customer metadata
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return;

  // Create First Touch if affiliate code present
  await getAffiliateForCustomer(customerId, {
    ...session.metadata,
    ...customer.metadata,
  });
}

async function handleSubscriptionCreatedOrUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const affiliateId = await getAffiliateForCustomer(customerId);
  
  if (!affiliateId) return;

  // Get customer name
  const customer = await stripe.customers.retrieve(customerId);
  const customerName = !customer.deleted ? customer.name || customer.email : null;

  // Get price info
  const item = subscription.items.data[0];
  const priceId = item?.price.id;
  const amountCents = item?.price.unit_amount || 0;

  // Determine status
  const status = subscription.status;
  const isTrial = status === "trialing";
  
  // Cast to any for flexible property access (Stripe API version compatibility)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = subscription as any;
  const currentPeriodEnd = sub.current_period_end || item?.current_period_end;
  
  // Upsert subscription
  await supabase.from("subscriptions").upsert({
    affiliate_id: affiliateId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
    customer_name: customerName,
    price_id: priceId,
    amount_cents: amountCents,
    status: status,
    is_trial: isTrial,
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
    last_event_at: new Date().toISOString(),
  }, {
    onConflict: "stripe_subscription_id",
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
      last_event_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Cast to any for flexible property access (Stripe API version compatibility)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inv = invoice as any;
  
  // Skip if no subscription or no amount
  if (!inv.subscription || !inv.amount_paid || inv.amount_paid <= 0) {
    return;
  }

  const customerId = inv.customer as string;
  const affiliateId = await getAffiliateForCustomer(customerId);
  
  if (!affiliateId) return;

  // Check idempotency - if transaction already exists, skip
  const { data: existingTx } = await supabase
    .from("transactions")
    .select("id")
    .eq("stripe_invoice_id", invoice.id)
    .single();

  if (existingTx) return;

  // Get affiliate's current tier
  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("commission_tier, paid_subscriptions_count")
    .eq("id", affiliateId)
    .single();

  if (!affiliate) return;

  const commissionPercent = getCommissionPercent(affiliate.commission_tier);
  const commissionAmount = Math.round(inv.amount_paid * commissionPercent / 100);

  // Calculate available_at (+15 days)
  const paidAt = inv.status_transitions?.paid_at 
    ? new Date(inv.status_transitions.paid_at * 1000) 
    : new Date();
  const availableAt = new Date(paidAt);
  availableAt.setDate(availableAt.getDate() + 15);

  // Get subscription ID from our database
  const subscriptionRecord = await getSubscriptionByStripeId(inv.subscription as string);

  // Create transaction
  await supabase.from("transactions").insert({
    affiliate_id: affiliateId,
    subscription_id: subscriptionRecord?.id || null,
    stripe_invoice_id: invoice.id,
    stripe_charge_id: inv.charge as string,
    type: "commission",
    amount_gross_cents: inv.amount_paid,
    commission_percent: commissionPercent,
    commission_amount_cents: commissionAmount,
    paid_at: paidAt.toISOString(),
    available_at: availableAt.toISOString(),
    description: "Comissão de venda",
  });

  // Check if this is the first payment for this subscription
  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("subscription_id", subscriptionRecord?.id)
    .eq("type", "commission");

  // If first payment, increment paid_subscriptions_count
  if (count === 1) {
    await supabase
      .from("affiliates")
      .update({
        paid_subscriptions_count: affiliate.paid_subscriptions_count + 1,
      })
      .eq("id", affiliateId);
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const customerId = charge.customer as string;
  if (!customerId) return;

  const affiliateId = await getAffiliateForCustomer(customerId);
  if (!affiliateId) return;

  // Find original transaction
  const { data: originalTx } = await supabase
    .from("transactions")
    .select("*")
    .eq("stripe_charge_id", charge.id)
    .eq("type", "commission")
    .single();

  if (!originalTx) return;

  // Calculate refunded amount
  const refundedAmount = charge.amount_refunded;
  const commissionRefund = Math.round(refundedAmount * originalTx.commission_percent / 100);

  // Create negative transaction
  await supabase.from("transactions").insert({
    affiliate_id: affiliateId,
    subscription_id: originalTx.subscription_id,
    stripe_charge_id: charge.id,
    type: "refund",
    amount_gross_cents: -refundedAmount,
    commission_percent: originalTx.commission_percent,
    commission_amount_cents: -commissionRefund,
    paid_at: new Date().toISOString(),
    available_at: new Date().toISOString(), // Immediate debit
    description: "Estorno de comissão - Refund",
  });

  // Mark subscription as having refund
  if (originalTx.subscription_id) {
    await supabase
      .from("subscriptions")
      .update({ has_refund: true })
      .eq("id", originalTx.subscription_id);
  }
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const charge = await stripe.charges.retrieve(dispute.charge as string);
  const customerId = charge.customer as string;
  if (!customerId) return;

  const affiliateId = await getAffiliateForCustomer(customerId);
  if (!affiliateId) return;

  // Find original transaction
  const { data: originalTx } = await supabase
    .from("transactions")
    .select("*")
    .eq("stripe_charge_id", dispute.charge)
    .eq("type", "commission")
    .single();

  if (!originalTx) return;

  // Create negative transaction for dispute
  const disputeAmount = dispute.amount;
  const commissionDeduction = Math.round(disputeAmount * originalTx.commission_percent / 100);

  await supabase.from("transactions").insert({
    affiliate_id: affiliateId,
    subscription_id: originalTx.subscription_id,
    stripe_charge_id: dispute.charge as string,
    type: "dispute",
    amount_gross_cents: -disputeAmount,
    commission_percent: originalTx.commission_percent,
    commission_amount_cents: -commissionDeduction,
    paid_at: new Date().toISOString(),
    available_at: new Date().toISOString(),
    description: "Estorno de comissão - Disputa",
  });

  // Mark subscription as having dispute
  if (originalTx.subscription_id) {
    await supabase
      .from("subscriptions")
      .update({ has_dispute: true })
      .eq("id", originalTx.subscription_id);
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // Cast to any for flexible property access (Stripe API version compatibility)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inv = invoice as any;
  
  // We don't show failed payments to affiliates (as per spec)
  // Just update subscription status if needed
  if (inv.subscription) {
    await supabase
      .from("subscriptions")
      .update({
        status: "past_due",
        last_event_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", inv.subscription);
  }
}

// ============================================
// Main Webhook Handler
// ============================================

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  // Register event for idempotency
  const { data: existingEvent } = await supabase
    .from("stripe_events")
    .select("status")
    .eq("stripe_event_id", event.id)
    .single();

  if (existingEvent?.status === "processed") {
    // Already processed, skip
    return NextResponse.json({ received: true, status: "already_processed" });
  }

  // Create or update event record
  await supabase.from("stripe_events").upsert({
    stripe_event_id: event.id,
    type: event.type,
    status: "pending",
    payload: event.data.object as unknown as Record<string, unknown>,
  }, {
    onConflict: "stripe_event_id",
  });

  try {
    // Process event based on type
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionCreatedOrUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case "charge.dispute.created":
      case "charge.dispute.updated":
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      default:
        // Event type not handled
        await supabase
          .from("stripe_events")
          .update({ status: "skipped" })
          .eq("stripe_event_id", event.id);
        
        return NextResponse.json({ received: true, status: "skipped" });
    }

    // Mark as processed
    await supabase
      .from("stripe_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id);

    return NextResponse.json({ received: true, status: "processed" });
  } catch (error) {
    console.error("Error processing webhook:", error);

    // Mark as failed
    await supabase
      .from("stripe_events")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        processed_at: new Date().toISOString(),
      })
      .eq("stripe_event_id", event.id);

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
