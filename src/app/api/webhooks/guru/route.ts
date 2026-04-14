import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateAvailableAtBRT, getCommissionPercent } from "@/lib/commission-payout";
import { fetchBillingProfileByEmail } from "@/lib/leona-billing";
import { resolveAffiliateIdByCode } from "@/lib/resolve-affiliate-code";
import {
  type GuruSubscriptionPayload,
  upsertSubscriptionFromLeonaAndGuru,
} from "@/lib/guru-subscription-sync";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Status oficiais da Guru (slugs inglês):
 * https://docs.digitalmanager.guru/developers/status-de-transacoes
 *
 * approved  = Aprovada
 * completed = Completa
 * refunded  = Reembolsada
 * dispute   = Reembolso Solicitado
 * chargeback = Reclamada (chargeback)
 */
const COMMISSION_STATUSES = new Set(["approved", "completed"]);

const REFUND_STATUSES = new Set(["refunded"]);

const CHARGEBACK_STATUSES = new Set(["chargeback", "dispute"]);

type GuruPayment = {
  total?: number;
  gross?: number;
  net?: number;
  marketplace_id?: string | null;
  processing_times?: { finished_at?: string | null; started_at?: string | null };
};

type GuruTransactionPayload = {
  api_token?: string;
  webhook_type?: string;
  id?: string;
  status?: string;
  contact?: { email?: string | null; name?: string | null };
  dates?: { confirmed_at?: string | null };
  payment?: GuruPayment;
  subscription?: GuruSubscriptionPayload | null;
};

function grossCentsFromPayment(payment: GuruPayment | undefined): number | null {
  if (!payment) return null;
  const reais =
    payment.total ??
    payment.gross ??
    (payment.net != null && payment.net > 0 ? payment.net : undefined);
  if (reais == null || typeof reais !== "number" || !Number.isFinite(reais) || reais <= 0) {
    return null;
  }
  return Math.round(reais * 100);
}

function paidAtFromPayload(body: GuruTransactionPayload): Date {
  const confirmed = body.dates?.confirmed_at;
  if (confirmed) {
    const d = new Date(confirmed);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const finished = body.payment?.processing_times?.finished_at;
  if (finished) {
    const d = new Date(finished);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const started = body.payment?.processing_times?.started_at;
  if (started) {
    const d = new Date(started);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

async function maybeSyncSubscriptionFromLeona(
  body: GuruTransactionPayload,
  emailRaw: string
): Promise<void> {
  const billing = await fetchBillingProfileByEmail(emailRaw);
  if (!billing.ok) return;
  if (!billing.profile.rewardful_referral) return;

  const affiliateId = await resolveAffiliateIdByCode(
    supabase,
    billing.profile.rewardful_referral
  );
  if (!affiliateId) return;

  const amountCents = grossCentsFromPayment(body.payment);

  await upsertSubscriptionFromLeonaAndGuru(supabase, {
    affiliateId,
    profile: billing.profile,
    guruSubscription: body.subscription ?? null,
    customerNameFromGuru: body.contact?.name ?? null,
    amountCentsFromGuru: amountCents,
  });
}

async function processGuruRefund(
  guruId: string,
  body: GuruTransactionPayload
): Promise<NextResponse> {
  const { data: originalTx } = await supabase
    .from("transactions")
    .select(
      "id, affiliate_id, subscription_id, commission_percent, available_at, amount_gross_cents"
    )
    .eq("guru_transaction_id", guruId)
    .eq("type", "commission")
    .maybeSingle();

  if (!originalTx) {
    console.log(`[GURU WEBHOOK] Refund sem comissão original tx=${guruId}`);
    return NextResponse.json({ received: true, status: "no_original_commission" });
  }

  const refundKey = `guru_refund:${guruId}`;
  const { data: existingRefund } = await supabase
    .from("transactions")
    .select("id")
    .eq("stripe_invoice_id", refundKey)
    .maybeSingle();

  if (existingRefund) {
    return NextResponse.json({ received: true, status: "refund_already_processed" });
  }

  const refundedAmount = originalTx.amount_gross_cents;
  const netRefund = Math.round(refundedAmount * 0.93);
  const commissionRefund = Math.round(
    (netRefund * originalTx.commission_percent) / 100
  );

  const marketplaceId = body.payment?.marketplace_id;
  const chargeId =
    marketplaceId != null && String(marketplaceId).trim() !== ""
      ? String(marketplaceId)
      : null;

  const { error } = await supabase.from("transactions").insert({
    affiliate_id: originalTx.affiliate_id,
    subscription_id: originalTx.subscription_id,
    guru_transaction_id: null,
    stripe_invoice_id: refundKey,
    stripe_charge_id: chargeId,
    type: "refund",
    amount_gross_cents: -refundedAmount,
    commission_percent: originalTx.commission_percent,
    commission_amount_cents: -commissionRefund,
    paid_at: new Date().toISOString(),
    available_at: originalTx.available_at,
    description: "Estorno de comissão (Guru)",
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ received: true, status: "refund_already_processed" });
    }
    console.error("[GURU WEBHOOK] insert refund:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (originalTx.subscription_id) {
    await supabase
      .from("subscriptions")
      .update({ has_refund: true })
      .eq("id", originalTx.subscription_id);
  }

  console.log(`[GURU WEBHOOK] Estorno registrado tx=${guruId}`);
  return NextResponse.json({ received: true, status: "refund_processed" });
}

async function processGuruDispute(
  guruId: string,
  body: GuruTransactionPayload
): Promise<NextResponse> {
  const { data: originalTx } = await supabase
    .from("transactions")
    .select(
      "id, affiliate_id, subscription_id, commission_percent, available_at, amount_gross_cents"
    )
    .eq("guru_transaction_id", guruId)
    .eq("type", "commission")
    .maybeSingle();

  if (!originalTx) {
    console.log(`[GURU WEBHOOK] Disputa sem comissão original tx=${guruId}`);
    return NextResponse.json({ received: true, status: "no_original_commission" });
  }

  const disputeKey = `guru_dispute:${guruId}`;
  const { data: existing } = await supabase
    .from("transactions")
    .select("id")
    .eq("stripe_invoice_id", disputeKey)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ received: true, status: "dispute_already_processed" });
  }

  const disputeAmount = originalTx.amount_gross_cents;
  const netDispute = Math.round(disputeAmount * 0.93);
  const commissionDeduction = Math.round(
    (netDispute * originalTx.commission_percent) / 100
  );

  const marketplaceId = body.payment?.marketplace_id;
  const chargeId =
    marketplaceId != null && String(marketplaceId).trim() !== ""
      ? String(marketplaceId)
      : null;

  const { error } = await supabase.from("transactions").insert({
    affiliate_id: originalTx.affiliate_id,
    subscription_id: originalTx.subscription_id,
    guru_transaction_id: null,
    stripe_invoice_id: disputeKey,
    stripe_charge_id: chargeId,
    type: "dispute",
    amount_gross_cents: -disputeAmount,
    commission_percent: originalTx.commission_percent,
    commission_amount_cents: -commissionDeduction,
    paid_at: new Date().toISOString(),
    available_at: originalTx.available_at,
    description: "Estorno de comissão - Disputa (Guru)",
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ received: true, status: "dispute_already_processed" });
    }
    console.error("[GURU WEBHOOK] insert dispute:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (originalTx.subscription_id) {
    await supabase
      .from("subscriptions")
      .update({ has_dispute: true })
      .eq("id", originalTx.subscription_id);
  }

  console.log(`[GURU WEBHOOK] Disputa registrada tx=${guruId}`);
  return NextResponse.json({ received: true, status: "dispute_processed" });
}

async function reprocessExistingGuruTransaction(
  body: GuruTransactionPayload,
  guruId: string,
  emailRaw: string,
  amountGrossCents: number,
  existingTx: {
    id: string;
    affiliate_id: string;
    subscription_id: string | null;
    amount_gross_cents: number;
  }
): Promise<{ response: NextResponse; subscriptionSynced: boolean }> {
  const billing = await fetchBillingProfileByEmail(emailRaw);
  if (!billing.ok || !billing.profile.rewardful_referral) {
    return {
      response: NextResponse.json({ received: true, status: "already_processed" }),
      subscriptionSynced: false,
    };
  }

  const newAffiliateId = await resolveAffiliateIdByCode(
    supabase,
    billing.profile.rewardful_referral
  );
  if (!newAffiliateId) {
    return {
      response: NextResponse.json({ received: true, status: "already_processed" }),
      subscriptionSynced: false,
    };
  }

  const subscriptionId = await upsertSubscriptionFromLeonaAndGuru(supabase, {
    affiliateId: newAffiliateId,
    profile: billing.profile,
    guruSubscription: body.subscription ?? null,
    customerNameFromGuru: body.contact?.name ?? null,
    amountCentsFromGuru: amountGrossCents,
  });

  const txPatch: Record<string, unknown> = {};

  if (newAffiliateId !== existingTx.affiliate_id) {
    const { data: affiliate } = await supabase
      .from("affiliates")
      .select("commission_tier")
      .eq("id", newAffiliateId)
      .single();

    if (affiliate) {
      const commissionPercent = getCommissionPercent(affiliate.commission_tier);
      const netAmount = Math.round(amountGrossCents * 0.93);
      const commissionAmount = Math.round((netAmount * commissionPercent) / 100);

      txPatch.affiliate_id = newAffiliateId;
      txPatch.commission_percent = commissionPercent;
      txPatch.commission_amount_cents = commissionAmount;
    }
  }

  if (subscriptionId && subscriptionId !== existingTx.subscription_id) {
    txPatch.subscription_id = subscriptionId;
  }

  if (Object.keys(txPatch).length > 0) {
    const { error } = await supabase
      .from("transactions")
      .update(txPatch)
      .eq("id", existingTx.id);

    if (error) {
      console.error("[GURU WEBHOOK] update existing transaction:", error);
    } else {
      console.log(
        `[GURU WEBHOOK] Transação atualizada tx=${guruId}`,
        txPatch.affiliate_id
          ? `affiliate: ${existingTx.affiliate_id} → ${newAffiliateId}`
          : `subscription_id atualizado`
      );
    }

    return {
      response: NextResponse.json({ received: true, status: "updated" }),
      subscriptionSynced: true,
    };
  }

  return {
    response: NextResponse.json({ received: true, status: "already_processed" }),
    subscriptionSynced: true,
  };
}

async function processGuruCommission(
  body: GuruTransactionPayload,
  guruId: string,
  emailRaw: string
): Promise<{ response: NextResponse; subscriptionSynced: boolean }> {
  const amountGrossCents = grossCentsFromPayment(body.payment);
  if (amountGrossCents == null || amountGrossCents <= 0) {
    return {
      response: NextResponse.json({ received: true, status: "no_amount" }),
      subscriptionSynced: false,
    };
  }

  const { data: existingTx } = await supabase
    .from("transactions")
    .select("id, affiliate_id, subscription_id, amount_gross_cents")
    .eq("guru_transaction_id", guruId)
    .maybeSingle();

  if (existingTx) {
    return await reprocessExistingGuruTransaction(
      body,
      guruId,
      emailRaw,
      amountGrossCents,
      existingTx
    );
  }

  const billing = await fetchBillingProfileByEmail(emailRaw);
  if (!billing.ok) {
    if (billing.reason === "not_found") {
      console.log(`[GURU WEBHOOK] Leona 404 / sem perfil para email ${emailRaw}, tx ${guruId}`);
      return {
        response: NextResponse.json({ received: true, status: "no_billing_profile" }),
        subscriptionSynced: false,
      };
    }
    if (billing.reason === "conflict") {
      console.warn(
        `[GURU WEBHOOK] Leona 409 — várias contas para owner ${emailRaw}, tx ${guruId}; comissão não atribuída`
      );
      return {
        response: NextResponse.json({ received: true, status: "billing_conflict" }),
        subscriptionSynced: false,
      };
    }
    const code = billing.httpStatus === 503 ? 503 : 502;
    return {
      response: NextResponse.json(
        { error: "Leona billing unavailable" },
        { status: code }
      ),
      subscriptionSynced: false,
    };
  }

  if (!billing.profile.rewardful_referral) {
    console.log(`[GURU WEBHOOK] Sem rewardful_referral no Leona para ${emailRaw}, tx ${guruId}`);
    return {
      response: NextResponse.json({ received: true, status: "no_referral" }),
      subscriptionSynced: false,
    };
  }

  const affiliateId = await resolveAffiliateIdByCode(
    supabase,
    billing.profile.rewardful_referral
  );
  if (!affiliateId) {
    console.log(
      `[GURU WEBHOOK] Código Rewardful não encontrado: ${billing.profile.rewardful_referral} (tx ${guruId})`
    );
    return {
      response: NextResponse.json({ received: true, status: "unknown_affiliate_code" }),
      subscriptionSynced: false,
    };
  }

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("commission_tier")
    .eq("id", affiliateId)
    .single();

  if (!affiliate) {
    return {
      response: NextResponse.json({ received: true, status: "affiliate_missing" }),
      subscriptionSynced: false,
    };
  }

  const subscriptionId = await upsertSubscriptionFromLeonaAndGuru(supabase, {
    affiliateId,
    profile: billing.profile,
    guruSubscription: body.subscription ?? null,
    customerNameFromGuru: body.contact?.name ?? null,
    amountCentsFromGuru: amountGrossCents,
  });

  const commissionPercent = getCommissionPercent(affiliate.commission_tier);
  const netAmount = Math.round(amountGrossCents * 0.93);
  const commissionAmount = Math.round((netAmount * commissionPercent) / 100);
  const paidAt = paidAtFromPayload(body);
  const availableAt = calculateAvailableAtBRT(paidAt);

  const marketplaceId = body.payment?.marketplace_id;
  const chargeId =
    marketplaceId != null && String(marketplaceId).trim() !== ""
      ? String(marketplaceId)
      : null;

  const { error: insertErr } = await supabase.from("transactions").insert({
    affiliate_id: affiliateId,
    subscription_id: subscriptionId,
    guru_transaction_id: guruId,
    stripe_invoice_id: null,
    stripe_charge_id: chargeId,
    type: "commission",
    amount_gross_cents: amountGrossCents,
    commission_percent: commissionPercent,
    commission_amount_cents: commissionAmount,
    paid_at: paidAt.toISOString(),
    available_at: availableAt.toISOString(),
    description: "Comissão de venda (Guru)",
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      return {
        response: NextResponse.json({ received: true, status: "already_processed" }),
        subscriptionSynced: true,
      };
    }
    console.error("[GURU WEBHOOK] insert transaction:", insertErr);
    return {
      response: NextResponse.json({ error: "Database error" }, { status: 500 }),
      subscriptionSynced: true,
    };
  }

  console.log(`[GURU WEBHOOK] Comissão registrada tx=${guruId} affiliate=${affiliateId}`);
  return {
    response: NextResponse.json({ received: true, status: "processed" }),
    subscriptionSynced: true,
  };
}

export async function POST(request: NextRequest) {
  const expectedToken = process.env.GURU_WEBHOOK_API_TOKEN;
  if (!expectedToken) {
    console.error("[GURU WEBHOOK] GURU_WEBHOOK_API_TOKEN não configurado");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  let body: GuruTransactionPayload;
  try {
    body = (await request.json()) as GuruTransactionPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.api_token !== expectedToken) {
    console.error("[GURU WEBHOOK] api_token inválido");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (body.webhook_type !== "transaction") {
    return NextResponse.json({ received: true, status: "ignored_type" });
  }

  const guruId = body.id?.trim();
  const emailRaw = body.contact?.email?.trim().toLowerCase() || "";
  const st = String(body.status || "").toLowerCase();

  let response: NextResponse;
  let subscriptionSynced = false;

  if (REFUND_STATUSES.has(st)) {
    if (!guruId) {
      response = NextResponse.json({ received: true, status: "missing_id" });
    } else {
      response = await processGuruRefund(guruId, body);
    }
  } else if (CHARGEBACK_STATUSES.has(st)) {
    if (!guruId) {
      response = NextResponse.json({ received: true, status: "missing_id" });
    } else {
      response = await processGuruDispute(guruId, body);
    }
  } else if (COMMISSION_STATUSES.has(st)) {
    if (!guruId) {
      response = NextResponse.json({ received: true, status: "missing_id" });
    } else if (!emailRaw) {
      response = NextResponse.json({ received: true, status: "missing_email" });
    } else {
      const cr = await processGuruCommission(body, guruId, emailRaw);
      response = cr.response;
      subscriptionSynced = cr.subscriptionSynced;
    }
  } else {
    response = NextResponse.json({ received: true, status: "ignored_status" });
  }

  const shouldSyncLeona =
    emailRaw &&
    response.status === 200 &&
    !subscriptionSynced;

  if (shouldSyncLeona) {
    try {
      await maybeSyncSubscriptionFromLeona(body, emailRaw);
    } catch (e) {
      console.error("[GURU WEBHOOK] sync assinatura Leona:", e);
    }
  }

  return response;
}
