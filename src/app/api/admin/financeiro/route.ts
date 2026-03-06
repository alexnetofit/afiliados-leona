import { NextRequest, NextResponse } from "next/server";
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

const ABACATEPAY_API_KEY = process.env.ABACATEPAY_API_KEY;
const FIRST_PERIOD = "2026-01";

// --------------- helpers ---------------

interface AbacateWithdraw {
  id: string;
  amount: number;
  status: string;
  devMode: boolean;
  createdAt: string;
}

let abacateCache: AbacateWithdraw[] | null = null;
let abacateCacheTs = 0;

async function fetchAbacateWithdraws(): Promise<AbacateWithdraw[]> {
  if (!ABACATEPAY_API_KEY) return [];
  if (abacateCache && Date.now() - abacateCacheTs < 5 * 60 * 1000) return abacateCache;
  try {
    const res = await fetch("https://api.abacatepay.com/v1/withdraw/list", {
      headers: { Authorization: `Bearer ${ABACATEPAY_API_KEY}` },
    });
    if (!res.ok) throw new Error(`AbacatePay ${res.status}`);
    const json = await res.json();
    abacateCache = (json.data || []) as AbacateWithdraw[];
    abacateCacheTs = Date.now();
    return abacateCache;
  } catch (e) {
    console.error("AbacatePay withdraw error:", e);
    return [];
  }
}

async function fetchUsdBrlRate(): Promise<number> {
  try {
    const res = await fetch(
      "https://economia.awesomeapi.com.br/json/last/USD-BRL",
      { next: { revalidate: 3600 } }
    );
    const json = await res.json();
    return parseFloat(json.USDBRL?.bid || "5.50");
  } catch {
    return 5.50;
  }
}

function getPeriodRange(label: string): { start: Date; end: Date } {
  const [year, month] = label.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 6, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 5, 23, 59, 59)),
  };
}

function getPeriodLabel(date: Date): string {
  const day = date.getUTCDate();
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth();
  if (day <= 5) {
    month -= 1;
    if (month < 0) { month = 11; year -= 1; }
  }
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function formatPeriodLabel(label: string): string {
  const [year, month] = label.split("-").map(Number);
  const names = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
  ];
  return `${names[month - 1]} ${year}`;
}

function generatePeriods(): string[] {
  const current = getPeriodLabel(new Date());
  const [curY, curM] = current.split("-").map(Number);
  const [firstY, firstM] = FIRST_PERIOD.split("-").map(Number);
  const periods: string[] = [];
  let y = curY, m = curM;
  while (y > firstY || (y === firstY && m >= firstM)) {
    periods.push(`${y}-${String(m).padStart(2, "0")}`);
    m--;
    if (m <= 0) { m = 12; y--; }
  }
  return periods;
}

async function verifyAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabaseAdmin
    .from("profiles").select("role").eq("id", user.id).single();
  return p?.role === "admin";
}

// --------------- types ---------------

interface PeriodData {
  label: string;
  startDate: string;
  endDate: string;
  stripeRevenueBrlCents: number;
  stripeRevenueUsdCents: number;
  abacateRevenueCents: number;
  usdBrlRate: number;
  affiliateCostCents: number;
  manualCosts: Array<{ id: string; category: string; description: string | null; amount_cents: number }>;
  manualCostsTotalCents: number;
  revenueCached: boolean;
}

// --------------- route ---------------

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const revenueParam = request.nextUrl.searchParams.get("revenue");

  // === Mode 1: Fetch live revenue for a specific period, save to DB ===
  if (revenueParam) {
    const { start, end } = getPeriodRange(revenueParam);
    const startTs = Math.floor(start.getTime() / 1000);
    const endTs = Math.floor(end.getTime() / 1000);
    const startMs = start.getTime();
    const endMs = end.getTime();

    const [stripeUsdCents, abacateList, usdBrlRate] = await Promise.all([
      (async () => {
        let total = 0;
        try {
          for await (const payout of stripe.payouts.list({
            created: { gte: startTs, lte: endTs },
            status: "paid",
            limit: 100,
          })) {
            total += payout.amount;
          }
        } catch (e) {
          console.error(`Stripe payouts error (${revenueParam}):`, e);
        }
        return total;
      })(),
      fetchAbacateWithdraws(),
      fetchUsdBrlRate(),
    ]);

    let abacateCents = 0;
    for (const w of abacateList) {
      if (w.status !== "COMPLETE" || w.devMode) continue;
      const t = new Date(w.createdAt).getTime();
      if (t >= startMs && t <= endMs) abacateCents += w.amount || 0;
    }

    const stripeBrlCents = Math.round(stripeUsdCents * usdBrlRate);

    // Salva no banco para meses passados (cache permanente)
    const cp = getPeriodLabel(new Date());
    if (revenueParam !== cp) {
      const { error } = await supabaseAdmin.from("period_revenue").upsert({
        period_label: revenueParam,
        stripe_revenue_usd_cents: stripeUsdCents,
        stripe_revenue_brl_cents: stripeBrlCents,
        abacate_revenue_cents: abacateCents,
        usd_brl_rate: usdBrlRate,
        cached_at: new Date().toISOString(),
      });
      if (error) console.error("Erro ao salvar period_revenue:", error.message);
    }

    return NextResponse.json({
      period: revenueParam,
      stripeRevenueUsdCents: stripeUsdCents,
      stripeRevenueBrlCents: stripeBrlCents,
      abacateRevenueCents: abacateCents,
      usdBrlRate,
    });
  }

  // === Mode 2: Load all periods from DB (fast) ===
  const currentPeriod = getPeriodLabel(new Date());
  const periods = generatePeriods();

  if (periods.length === 0) {
    return NextResponse.json({ currentPeriod, periods: [], formatLabel: {} });
  }

  const allRanges = periods.map((label) => ({ label, ...getPeriodRange(label) }));
  const globalStart = allRanges[allRanges.length - 1].start;
  const globalEnd = allRanges[0].end;

  type CachedRev = { period_label: string; stripe_revenue_usd_cents: number; stripe_revenue_brl_cents: number; abacate_revenue_cents: number; usd_brl_rate: number };

  const [allTxs, allCosts, cachedRevRows] = await Promise.all([
    supabaseAdmin
      .from("transactions")
      .select("commission_amount_cents, paid_at")
      .gte("paid_at", globalStart.toISOString())
      .lte("paid_at", globalEnd.toISOString())
      .then((r) => r.data || []),
    Promise.resolve(
      supabaseAdmin
        .from("admin_costs")
        .select("id, category, description, amount_cents, period_label")
        .in("period_label", periods)
        .order("created_at", { ascending: true })
    ).then((r) => r.data || []).catch(() => [] as Array<{ id: string; category: string; description: string | null; amount_cents: number; period_label: string }>),
    Promise.resolve(
      supabaseAdmin
        .from("period_revenue")
        .select("period_label, stripe_revenue_usd_cents, stripe_revenue_brl_cents, abacate_revenue_cents, usd_brl_rate")
        .in("period_label", periods)
    ).then((r) => (r.data || []) as CachedRev[])
      .catch(() => [] as CachedRev[]),
  ]);

  const revMap = new Map(cachedRevRows.map((r) => [r.period_label, r]));

  const results: PeriodData[] = allRanges.map(({ label, start, end }) => {
    const startMs = start.getTime();
    const endMs = end.getTime();

    const affiliateCostCents = (allTxs as Array<{ commission_amount_cents: number; paid_at: string }>)
      .filter((tx) => {
        const t = new Date(tx.paid_at).getTime();
        return t >= startMs && t <= endMs;
      })
      .reduce((sum, tx) => sum + tx.commission_amount_cents, 0);

    const manualCosts = (allCosts as Array<{ id: string; category: string; description: string | null; amount_cents: number; period_label: string }>)
      .filter((c) => c.period_label === label)
      .map(({ id, category, description, amount_cents }) => ({ id, category, description, amount_cents }));
    const manualCostsTotalCents = manualCosts.reduce((sum, c) => sum + c.amount_cents, 0);

    const cached = revMap.get(label);
    const isCurrent = label === currentPeriod;

    return {
      label,
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      stripeRevenueBrlCents: cached && !isCurrent ? cached.stripe_revenue_brl_cents : 0,
      stripeRevenueUsdCents: cached && !isCurrent ? cached.stripe_revenue_usd_cents : 0,
      abacateRevenueCents: cached && !isCurrent ? cached.abacate_revenue_cents : 0,
      usdBrlRate: cached && !isCurrent ? Number(cached.usd_brl_rate) : 0,
      affiliateCostCents,
      manualCosts,
      manualCostsTotalCents,
      revenueCached: !isCurrent && !!cached,
    };
  });

  return NextResponse.json({
    currentPeriod,
    periods: results,
    formatLabel: Object.fromEntries(periods.map((p) => [p, formatPeriodLabel(p)])),
  });
}
