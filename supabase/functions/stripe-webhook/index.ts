// Supabase Edge Function version of the webhook handler
// This can be used as an alternative to the Next.js API route

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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

async function getAffiliateForCustomer(
  customerId: string,
  metadata?: Record<string, string> | null
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("customer_affiliates")
    .select("affiliate_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (existing) return existing.affiliate_id;

  const affiliateCode = metadata?.via || metadata?.affiliate_code || metadata?.ref;
  if (!affiliateCode) return null;

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("id")
    .eq("affiliate_code", affiliateCode)
    .single();

  if (!affiliate) {
    const { data: link } = await supabase
      .from("affiliate_links")
      .select("affiliate_id")
      .eq("alias", affiliateCode)
      .single();

    if (!link) return null;

    await supabase.from("customer_affiliates").insert({
      stripe_customer_id: customerId,
      affiliate_id: link.affiliate_id,
    });

    return link.affiliate_id;
  }

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing signature" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check idempotency
  const { data: existingEvent } = await supabase
    .from("stripe_events")
    .select("status")
    .eq("stripe_event_id", event.id)
    .single();

  if (existingEvent?.status === "processed") {
    return new Response(JSON.stringify({ received: true, status: "already_processed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabase.from("stripe_events").upsert({
    stripe_event_id: event.id,
    type: event.type,
    status: "pending",
    payload: event.data.object,
  }, { onConflict: "stripe_event_id" });

  try {
    switch (event.type) {
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription || !invoice.amount_paid || invoice.amount_paid <= 0) break;

        const customerId = invoice.customer as string;
        const affiliateId = await getAffiliateForCustomer(customerId);
        if (!affiliateId) break;

        const { data: existingTx } = await supabase
          .from("transactions")
          .select("id")
          .eq("stripe_invoice_id", invoice.id)
          .single();

        if (existingTx) break;

        const { data: affiliate } = await supabase
          .from("affiliates")
          .select("commission_tier, paid_subscriptions_count")
          .eq("id", affiliateId)
          .single();

        if (!affiliate) break;

        const commissionPercent = getCommissionPercent(affiliate.commission_tier);
        const commissionAmount = Math.round(invoice.amount_paid * commissionPercent / 100);

        const paidAt = invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : new Date();
        const availableAt = new Date(paidAt);
        availableAt.setDate(availableAt.getDate() + 15);

        const { data: subscriptionRecord } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("stripe_subscription_id", invoice.subscription)
          .single();

        await supabase.from("transactions").insert({
          affiliate_id: affiliateId,
          subscription_id: subscriptionRecord?.id || null,
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

        const { count } = await supabase
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("subscription_id", subscriptionRecord?.id)
          .eq("type", "commission");

        if (count === 1) {
          await supabase
            .from("affiliates")
            .update({ paid_subscriptions_count: affiliate.paid_subscriptions_count + 1 })
            .eq("id", affiliateId);
        }
        break;
      }

      // Add other event handlers as needed...
    }

    await supabase
      .from("stripe_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id);

    return new Response(JSON.stringify({ received: true, status: "processed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    await supabase
      .from("stripe_events")
      .update({
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        processed_at: new Date().toISOString(),
      })
      .eq("stripe_event_id", event.id);

    return new Response(JSON.stringify({ error: "Processing failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
