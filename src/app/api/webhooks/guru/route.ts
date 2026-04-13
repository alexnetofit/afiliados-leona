import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateAvailableAtBRT, getCommissionPercent } from "@/lib/commission-payout";
import { fetchBillingProfileByEmail } from "@/lib/leona-billing";
import { resolveAffiliateIdByCode } from "@/lib/resolve-affiliate-code";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Status em que a venda está paga/aprovada (Guru PT/EN). */
const COMMISSION_STATUSES = new Set([
  "approved",
  "complete",
  "completa",
  "aprovado",
]);

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
  contact?: { email?: string | null };
  dates?: { confirmed_at?: string | null };
  payment?: GuruPayment;
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

  if (!body.status || !COMMISSION_STATUSES.has(String(body.status).toLowerCase())) {
    return NextResponse.json({ received: true, status: "ignored_status" });
  }

  const guruId = body.id?.trim();
  if (!guruId) {
    return NextResponse.json({ received: true, status: "missing_id" });
  }

  const emailRaw = body.contact?.email?.trim().toLowerCase();
  if (!emailRaw) {
    return NextResponse.json({ received: true, status: "missing_email" });
  }

  const amountGrossCents = grossCentsFromPayment(body.payment);
  if (amountGrossCents == null || amountGrossCents <= 0) {
    return NextResponse.json({ received: true, status: "no_amount" });
  }

  const { data: existingTx } = await supabase
    .from("transactions")
    .select("id")
    .eq("guru_transaction_id", guruId)
    .maybeSingle();

  if (existingTx) {
    return NextResponse.json({ received: true, status: "already_processed" });
  }

  const billing = await fetchBillingProfileByEmail(emailRaw);
  if (!billing.ok) {
    if (billing.reason === "not_found") {
      console.log(`[GURU WEBHOOK] Leona 404 / sem perfil para email ${emailRaw}, tx ${guruId}`);
      return NextResponse.json({ received: true, status: "no_billing_profile" });
    }
    if (billing.reason === "conflict") {
      console.warn(
        `[GURU WEBHOOK] Leona 409 — várias contas para owner ${emailRaw}, tx ${guruId}; comissão não atribuída`
      );
      return NextResponse.json({ received: true, status: "billing_conflict" });
    }
    const code = billing.httpStatus === 503 ? 503 : 502;
    return NextResponse.json({ error: "Leona billing unavailable" }, { status: code });
  }

  if (!billing.rewardful_referral) {
    console.log(`[GURU WEBHOOK] Sem rewardful_referral no Leona para ${emailRaw}, tx ${guruId}`);
    return NextResponse.json({ received: true, status: "no_referral" });
  }

  const affiliateId = await resolveAffiliateIdByCode(supabase, billing.rewardful_referral);
  if (!affiliateId) {
    console.log(
      `[GURU WEBHOOK] Código Rewardful não encontrado nos afiliados: ${billing.rewardful_referral} (tx ${guruId})`
    );
    return NextResponse.json({ received: true, status: "unknown_affiliate_code" });
  }

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("commission_tier")
    .eq("id", affiliateId)
    .single();

  if (!affiliate) {
    return NextResponse.json({ received: true, status: "affiliate_missing" });
  }

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
    subscription_id: null,
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
      return NextResponse.json({ received: true, status: "already_processed" });
    }
    console.error("[GURU WEBHOOK] insert transaction:", insertErr);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  console.log(`[GURU WEBHOOK] Comissão registrada tx=${guruId} affiliate=${affiliateId}`);
  return NextResponse.json({ received: true, status: "processed" });
}
