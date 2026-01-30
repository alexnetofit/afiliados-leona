import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
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

// Cache for affiliate lookups to avoid repeated queries
const affiliateCache = new Map<string, string | null>();

// Helper: Find or create affiliate relationship from customer metadata
async function getOrCreateAffiliateForCustomer(
  customerId: string,
  customerMetadata?: Stripe.Metadata | null
): Promise<string | null> {
  // Check cache first
  if (affiliateCache.has(customerId)) {
    return affiliateCache.get(customerId) || null;
  }

  // 1. Check if customer already has an affiliate (First Touch)
  const { data: existing } = await supabaseAdmin
    .from("customer_affiliates")
    .select("affiliate_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (existing) {
    affiliateCache.set(customerId, existing.affiliate_id);
    return existing.affiliate_id;
  }

  // 2. Check metadata for affiliate code (Link, via, etc)
  // NOTE: "Link" contains the readable affiliate code (e.g., "raphaela-thaine")
  // "referral" contains the Rewardful referral UUID (not an affiliate code)
  const affiliateCode = 
    customerMetadata?.Link ||
    customerMetadata?.link ||
    customerMetadata?.via || 
    customerMetadata?.affiliate_code || 
    customerMetadata?.ref;

  if (!affiliateCode) {
    affiliateCache.set(customerId, null);
    return null;
  }

  // 3. Find affiliate by code (exact match or contained in semicolon-separated list)
  // First try exact match
  let affiliate = await supabaseAdmin
    .from("affiliates")
    .select("id")
    .eq("affiliate_code", affiliateCode)
    .single()
    .then(r => r.data);

  // If not found, try searching in semicolon-separated codes
  if (!affiliate) {
    const { data: affiliates } = await supabaseAdmin
      .from("affiliates")
      .select("id, affiliate_code")
      .ilike("affiliate_code", `%${affiliateCode}%`);
    
    // Verify it's an exact match within the semicolon-separated values
    affiliate = affiliates?.find(a => 
      a.affiliate_code.split(';').map((c: string) => c.trim().toLowerCase()).includes(affiliateCode.toLowerCase())
    ) || null;
  }

  if (affiliate) {
    await supabaseAdmin.from("customer_affiliates").insert({
      stripe_customer_id: customerId,
      affiliate_id: affiliate.id,
    });
    affiliateCache.set(customerId, affiliate.id);
    return affiliate.id;
  }

  // Try finding by custom alias (created by affiliate in dashboard)
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

export async function POST(request: NextRequest) {
  // Clear cache for new sync
  affiliateCache.clear();

  // Create a streaming response
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let syncLogId: string | null = null;
      
      try {
        // 1. Verify admin authentication
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          sendEvent({ type: "error", message: "Não autenticado" });
          controller.close();
          return;
        }

        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (profile?.role !== "admin") {
          sendEvent({ type: "error", message: "Acesso negado" });
          controller.close();
          return;
        }

        // 2. Get request parameters
        const { days = 30 } = await request.json();

        // 3. Create sync log entry
        const { data: syncLog } = await supabaseAdmin
          .from("sync_logs")
          .insert({
            days_synced: days,
            triggered_by: "manual",
            status: "running",
          })
          .select("id")
          .single();

        syncLogId = syncLog?.id || null;

        sendEvent({ type: "start", message: `Iniciando sync dos últimos ${days} dias...` });

        // Calculate date range
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startTimestamp = Math.floor(startDate.getTime() / 1000);

        let customersScanned = 0;
        let customersLinked = 0;
        let subscriptionsSynced = 0;
        let invoicesSynced = 0;
        let refundsSynced = 0;

        // 4. First pass: Scan all customers and link by metadata
        sendEvent({ type: "progress", step: "customers", message: "Escaneando clientes..." });

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
        sendEvent({ type: "progress", step: "customers", message: `${customersScanned} clientes encontrados` });

        // Process customers in batches of 10
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

          if (i % 50 === 0 && i > 0) {
            sendEvent({ 
              type: "progress", 
              step: "customers", 
              message: `${i}/${customersScanned} clientes processados, ${customersLinked} vinculados` 
            });
          }
        }

        sendEvent({ 
          type: "progress", 
          step: "customers", 
          message: `Concluído: ${customersLinked} clientes vinculados a afiliados`,
          completed: true
        });

        // Update sync log
        if (syncLogId) {
          await supabaseAdmin.from("sync_logs").update({
            customers_scanned: customersScanned,
            customers_linked: customersLinked,
          }).eq("id", syncLogId);
        }

        // 5. Sync Subscriptions
        sendEvent({ type: "progress", step: "subscriptions", message: "Sincronizando assinaturas..." });

        const subscriptions: Stripe.Subscription[] = [];
        for await (const subscription of stripe.subscriptions.list({
          created: { gte: startTimestamp },
          expand: ["data.customer"],
          limit: 100,
        })) {
          subscriptions.push(subscription);
        }

        sendEvent({ type: "progress", step: "subscriptions", message: `${subscriptions.length} assinaturas encontradas` });

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

        sendEvent({ 
          type: "progress", 
          step: "subscriptions", 
          message: `Concluído: ${subscriptionsSynced} assinaturas sincronizadas`,
          completed: true
        });

        // Update sync log
        if (syncLogId) {
          await supabaseAdmin.from("sync_logs").update({
            subscriptions_synced: subscriptionsSynced,
          }).eq("id", syncLogId);
        }

        // 6. Sync Invoices (paid only)
        sendEvent({ type: "progress", step: "invoices", message: "Sincronizando faturas pagas..." });

        const invoices: Stripe.Invoice[] = [];
        for await (const invoice of stripe.invoices.list({
          created: { gte: startTimestamp },
          status: "paid",
          expand: ["data.customer"],
          limit: 100,
        })) {
          invoices.push(invoice);
        }

        sendEvent({ type: "progress", step: "invoices", message: `${invoices.length} faturas encontradas` });

        for (let i = 0; i < invoices.length; i += 10) {
          const batch = invoices.slice(i, i + 10);
          await Promise.all(batch.map(async (invoice) => {
            const inv = invoice as any;
            if (!inv.subscription || !inv.amount_paid) return;

            const customerId = inv.customer?.id || inv.customer as string;
            const customerObj = typeof inv.customer === 'object' && !inv.customer?.deleted 
              ? inv.customer 
              : null;
            
            const affiliateId = await getOrCreateAffiliateForCustomer(
              customerId,
              customerObj?.metadata
            );

            if (!affiliateId) return;

            // Check if transaction exists
            const { data: existingTx } = await supabaseAdmin
              .from("transactions")
              .select("id")
              .eq("stripe_invoice_id", invoice.id)
              .single();

            if (existingTx) return;

            // Get affiliate tier
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
              description: "Comissão de venda (resync)",
            });

            invoicesSynced++;
          }));
        }

        sendEvent({ 
          type: "progress", 
          step: "invoices", 
          message: `Concluído: ${invoicesSynced} transações criadas`,
          completed: true
        });

        // Update sync log
        if (syncLogId) {
          await supabaseAdmin.from("sync_logs").update({
            invoices_synced: invoicesSynced,
          }).eq("id", syncLogId);
        }

        // 7. Sync Refunds with expanded charge data
        sendEvent({ type: "progress", step: "refunds", message: "Sincronizando reembolsos..." });

        const refunds: Stripe.Refund[] = [];
        for await (const refund of stripe.refunds.list({
          created: { gte: startTimestamp },
          expand: ["data.charge"],
          limit: 100,
        })) {
          refunds.push(refund);
        }

        sendEvent({ type: "progress", step: "refunds", message: `${refunds.length} reembolsos encontrados` });

        for (const refund of refunds) {
          if (!refund.charge) continue;

          // Get charge from expanded data or fetch it
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
            description: "Estorno de comissão (resync)",
          });

          refundsSynced++;
        }

        sendEvent({ 
          type: "progress", 
          step: "refunds", 
          message: `Concluído: ${refundsSynced} estornos processados`,
          completed: true
        });

        // 8. Finalize sync log
        if (syncLogId) {
          await supabaseAdmin.from("sync_logs").update({
            refunds_synced: refundsSynced,
            status: "completed",
            finished_at: new Date().toISOString(),
          }).eq("id", syncLogId);
        }

        const totalProcessed = subscriptionsSynced + invoicesSynced + refundsSynced;
        
        sendEvent({ 
          type: "complete", 
          message: `Sync concluído!`,
          summary: {
            customersScanned,
            customersLinked,
            subscriptionsSynced,
            invoicesSynced,
            refundsSynced,
            totalProcessed,
          }
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        
        // Update sync log with error
        if (syncLogId) {
          await supabaseAdmin.from("sync_logs").update({
            status: "error",
            error_message: errorMessage,
            finished_at: new Date().toISOString(),
          }).eq("id", syncLogId);
        }

        sendEvent({ type: "error", message: errorMessage });
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
