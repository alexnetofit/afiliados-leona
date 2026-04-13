import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  calculateAvailableAtBRT,
  getCommissionPercent,
} from "@/lib/commission-payout";
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

const GURU_API_BASE = "https://digitalmanager.guru/api/v2/transactions";
const GURU_HEADERS = {
  Accept: "application/json",
  "User-Agent": "n8n",
};

type GuruApiTransaction = {
  id: string;
  status: string;
  contact?: { email?: string | null; name?: string | null };
  dates?: { confirmed_at?: number | null };
  payment?: {
    total?: number;
    gross?: number;
    net?: number;
    marketplace_id?: string | null;
  };
  subscription?: GuruSubscriptionPayload | null;
};

type BackfillResult = {
  email: string;
  guru_id: string;
  status:
    | "processed"
    | "already_exists"
    | "no_profile"
    | "profile_conflict"
    | "no_referral"
    | "unknown_affiliate"
    | "affiliate_missing"
    | "no_amount"
    | "error";
  detail?: string;
};

async function fetchGuruTransactions(
  token: string,
  confirmedIni: string,
  confirmedEnd: string
): Promise<GuruApiTransaction[]> {
  const all: GuruApiTransaction[] = [];
  let page = 1;

  while (true) {
    const url = new URL(GURU_API_BASE);
    url.searchParams.set("confirmed_at_ini", confirmedIni);
    url.searchParams.set("confirmed_at_end", confirmedEnd);
    url.searchParams.set("status", "approved");
    url.searchParams.set("limit", "100");
    url.searchParams.set("page", String(page));

    const res = await fetch(url.toString(), {
      headers: { ...GURU_HEADERS, Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Guru API ${res.status}: ${await res.text().catch(() => "")}`);
    }

    const json = await res.json();
    const data: GuruApiTransaction[] = json.data ?? [];
    if (data.length === 0) break;

    all.push(...data);
    if (data.length < 100) break;
    page++;
  }

  return all;
}

function grossCents(payment: GuruApiTransaction["payment"]): number | null {
  if (!payment) return null;
  const reais = payment.total ?? payment.gross ?? (payment.net && payment.net > 0 ? payment.net : undefined);
  if (reais == null || typeof reais !== "number" || !Number.isFinite(reais) || reais <= 0) return null;
  return Math.round(reais * 100);
}

function paidAtFromTransaction(tx: GuruApiTransaction): Date {
  const ts = tx.dates?.confirmed_at;
  if (ts && typeof ts === "number") {
    const d = new Date(ts * 1000);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

async function processOne(tx: GuruApiTransaction): Promise<BackfillResult> {
  const guruId = tx.id;
  const email = tx.contact?.email?.trim().toLowerCase() || "";
  const base = { email, guru_id: guruId };

  const amountGrossCents = grossCents(tx.payment);
  if (amountGrossCents == null || amountGrossCents <= 0) {
    return { ...base, status: "no_amount" };
  }

  const { data: existing } = await supabase
    .from("transactions")
    .select("id")
    .eq("guru_transaction_id", guruId)
    .maybeSingle();

  if (existing) {
    return { ...base, status: "already_exists" };
  }

  const billing = await fetchBillingProfileByEmail(email);
  if (!billing.ok) {
    if (billing.reason === "conflict") return { ...base, status: "profile_conflict" };
    return { ...base, status: "no_profile" };
  }

  if (!billing.profile.rewardful_referral) {
    return { ...base, status: "no_referral" };
  }

  const affiliateId = await resolveAffiliateIdByCode(supabase, billing.profile.rewardful_referral);
  if (!affiliateId) {
    return { ...base, status: "unknown_affiliate", detail: billing.profile.rewardful_referral };
  }

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("commission_tier")
    .eq("id", affiliateId)
    .single();

  if (!affiliate) {
    return { ...base, status: "affiliate_missing" };
  }

  const subscriptionId = await upsertSubscriptionFromLeonaAndGuru(supabase, {
    affiliateId,
    profile: billing.profile,
    guruSubscription: tx.subscription ?? null,
    customerNameFromGuru: tx.contact?.name ?? null,
    amountCentsFromGuru: amountGrossCents,
  });

  const commissionPercent = getCommissionPercent(affiliate.commission_tier);
  const netAmount = Math.round(amountGrossCents * 0.93);
  const commissionAmount = Math.round((netAmount * commissionPercent) / 100);
  const paidAt = paidAtFromTransaction(tx);
  const availableAt = calculateAvailableAtBRT(paidAt);

  const marketplaceId = tx.payment?.marketplace_id;
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
    description: "Comissão de venda (Guru – backfill)",
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      return { ...base, status: "already_exists" };
    }
    return { ...base, status: "error", detail: insertErr.message };
  }

  return { ...base, status: "processed" };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth || auth !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const guruToken = process.env.GURU_API_USER_TOKEN;
  if (!guruToken) {
    return NextResponse.json(
      { error: "GURU_API_USER_TOKEN não configurado" },
      { status: 500 }
    );
  }

  let body: { confirmed_at_ini?: string; confirmed_at_end?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* defaults */
  }

  const ini = body.confirmed_at_ini || "2026-04-11";
  const end = body.confirmed_at_end || "2026-04-14";

  let transactions: GuruApiTransaction[];
  try {
    transactions = await fetchGuruTransactions(guruToken, ini, end);
  } catch (e) {
    return NextResponse.json(
      { error: "Falha ao buscar Guru API", detail: String(e) },
      { status: 502 }
    );
  }

  const results: BackfillResult[] = [];

  for (const tx of transactions) {
    try {
      const result = await processOne(tx);
      results.push(result);
    } catch (e) {
      results.push({
        email: tx.contact?.email || "?",
        guru_id: tx.id,
        status: "error",
        detail: String(e),
      });
    }
    await sleep(200);
  }

  const summary = {
    total: results.length,
    processed: results.filter((r) => r.status === "processed").length,
    already_exists: results.filter((r) => r.status === "already_exists").length,
    no_referral: results.filter((r) => r.status === "no_referral").length,
    no_profile: results.filter((r) => r.status === "no_profile").length,
    errors: results.filter((r) => r.status === "error").length,
    other_skips: results.filter((r) =>
      ["profile_conflict", "unknown_affiliate", "affiliate_missing", "no_amount"].includes(r.status)
    ).length,
  };

  return NextResponse.json({ summary, results });
}
