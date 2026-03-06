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

interface AbacateWithdraw {
  id: string;
  amount: number;
  status: string;
  devMode: boolean;
  createdAt: string;
}

let abacateWithdrawCache: AbacateWithdraw[] | null = null;
let abacateCacheTime = 0;

async function fetchAbacateWithdraws(): Promise<AbacateWithdraw[]> {
  if (!ABACATEPAY_API_KEY) return [];

  if (abacateWithdrawCache && Date.now() - abacateCacheTime < 5 * 60 * 1000) {
    return abacateWithdrawCache;
  }

  try {
    const res = await fetch("https://api.abacatepay.com/v1/withdraw/list", {
      headers: { Authorization: `Bearer ${ABACATEPAY_API_KEY}` },
    });
    if (!res.ok) throw new Error(`AbacatePay ${res.status}`);
    const json = await res.json();
    abacateWithdrawCache = (json.data || []) as AbacateWithdraw[];
    abacateCacheTime = Date.now();
    return abacateWithdrawCache;
  } catch (e) {
    console.error("Error fetching AbacatePay withdraws:", e);
    return [];
  }
}

interface PeriodData {
  label: string;
  startDate: string;
  endDate: string;
  stripeRevenueCents: number;
  abacateRevenueCents: number;
  affiliateCostCents: number;
  manualCosts: Array<{
    id: string;
    category: string;
    description: string | null;
    amount_cents: number;
  }>;
  manualCostsTotalCents: number;
}

function getPeriodRange(label: string): { start: Date; end: Date } {
  const [year, month] = label.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 6, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 5, 23, 59, 59));
  return { start, end };
}

function getPeriodLabel(date: Date): string {
  const day = date.getUTCDate();
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth(); // 0-indexed

  if (day <= 5) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }

  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function formatPeriodLabel(label: string): string {
  const [year, month] = label.split("-").map(Number);
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${monthNames[month - 1]} ${year}`;
}

async function verifyAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin";
}

// GET /api/admin/financeiro - returns all periods with DB-only data (fast)
// GET /api/admin/financeiro?revenue=2026-02 - fetches live Stripe/AbacatePay revenue for a specific period
export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const revenueParam = request.nextUrl.searchParams.get("revenue");

  // === Mode 1: Fetch live revenue for a specific period ===
  if (revenueParam) {
    const { start, end } = getPeriodRange(revenueParam);
    const startTs = Math.floor(start.getTime() / 1000);
    const endTs = Math.floor(end.getTime() / 1000);

    const [stripePayoutsTotal, abacateWithdraws] = await Promise.all([
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
          console.error(`Error fetching Stripe payouts for ${revenueParam}:`, e);
        }
        return total;
      })(),
      fetchAbacateWithdraws(),
    ]);

    let abacateRevenueCents = 0;
    const startMs = start.getTime();
    const endMs = end.getTime();
    for (const w of abacateWithdraws) {
      if (w.status !== "COMPLETE" || w.devMode) continue;
      const t = new Date(w.createdAt).getTime();
      if (t >= startMs && t <= endMs) abacateRevenueCents += w.amount || 0;
    }

    return NextResponse.json({
      period: revenueParam,
      stripeRevenueCents: stripePayoutsTotal,
      abacateRevenueCents,
    });
  }

  // === Mode 2: Load all periods with DB data only (fast) ===
  const now = new Date();
  const currentPeriod = getPeriodLabel(now);

  const numMonths = 8;
  const periods: string[] = [];
  const [curYear, curMonth] = currentPeriod.split("-").map(Number);
  for (let i = 0; i < numMonths; i++) {
    let m = curMonth - i;
    let y = curYear;
    while (m <= 0) { m += 12; y -= 1; }
    periods.push(`${y}-${String(m).padStart(2, "0")}`);
  }

  const allRanges = periods.map((label) => ({ label, ...getPeriodRange(label) }));
  const globalStart = allRanges[allRanges.length - 1].start;
  const globalEnd = allRanges[0].end;

  // Only DB queries - no Stripe calls, very fast
  const [allTxs, allCosts] = await Promise.all([
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
    )
      .then((r) => r.data || [])
      .catch(() => [] as Array<{ id: string; category: string; description: string | null; amount_cents: number; period_label: string }>),
  ]);

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

    return {
      label,
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      stripeRevenueCents: 0,
      abacateRevenueCents: 0,
      affiliateCostCents,
      manualCosts,
      manualCostsTotalCents,
    };
  });

  return NextResponse.json({
    currentPeriod,
    periods: results,
    formatLabel: Object.fromEntries(periods.map((p) => [p, formatPeriodLabel(p)])),
  });
}
