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

interface AbacateBilling {
  id: string;
  amount: number;
  status: string;
  devMode: boolean;
  createdAt: string;
  updatedAt: string;
}

let abacateBillingsCache: AbacateBilling[] | null = null;
let abacateCacheTime = 0;

async function fetchAbacateBillings(): Promise<AbacateBilling[]> {
  if (!ABACATEPAY_API_KEY) return [];

  // Cache for 5 minutes
  if (abacateBillingsCache && Date.now() - abacateCacheTime < 5 * 60 * 1000) {
    return abacateBillingsCache;
  }

  try {
    const res = await fetch("https://api.abacatepay.com/v1/billing/list", {
      headers: { Authorization: `Bearer ${ABACATEPAY_API_KEY}` },
    });
    if (!res.ok) throw new Error(`AbacatePay ${res.status}`);
    const json = await res.json();
    abacateBillingsCache = (json.data || []) as AbacateBilling[];
    abacateCacheTime = Date.now();
    return abacateBillingsCache;
  } catch (e) {
    console.error("Error fetching AbacatePay billings:", e);
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

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const monthsParam = request.nextUrl.searchParams.get("months") || "6";
  const numMonths = Math.min(parseInt(monthsParam), 12);

  const now = new Date();
  const currentPeriod = getPeriodLabel(now);

  const periods: string[] = [];
  const [curYear, curMonth] = currentPeriod.split("-").map(Number);
  for (let i = 0; i < numMonths; i++) {
    let m = curMonth - i;
    let y = curYear;
    while (m <= 0) { m += 12; y -= 1; }
    periods.push(`${y}-${String(m).padStart(2, "0")}`);
  }

  // Calculate the full date range (oldest start to newest end)
  const allRanges = periods.map((label) => ({ label, ...getPeriodRange(label) }));
  const globalStart = allRanges[allRanges.length - 1].start;
  const globalEnd = allRanges[0].end;
  const globalStartTs = Math.floor(globalStart.getTime() / 1000);
  const globalEndTs = Math.floor(globalEnd.getTime() / 1000);

  // Fetch all data in parallel: Stripe invoices, AbacatePay, transactions, manual costs
  const [stripeInvoices, abacateBillings, allTxs, allCosts] = await Promise.all([
    // Single Stripe call for entire range
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoices: Array<{ amount_paid: number; created: number }> = [];
      try {
        for await (const invoice of stripe.invoices.list({
          created: { gte: globalStartTs, lte: globalEndTs },
          status: "paid",
          limit: 100,
        })) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const inv = invoice as any;
          invoices.push({ amount_paid: inv.amount_paid || 0, created: inv.created });
        }
      } catch (e) {
        console.error("Error fetching Stripe invoices:", e);
      }
      return invoices;
    })(),
    fetchAbacateBillings(),
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

  // Distribute fetched data into periods
  const results: PeriodData[] = allRanges.map(({ label, start, end }) => {
    const startMs = start.getTime();
    const endMs = end.getTime();

    const stripeRevenueCents = stripeInvoices
      .filter((inv) => inv.created * 1000 >= startMs && inv.created * 1000 <= endMs)
      .reduce((sum, inv) => sum + inv.amount_paid, 0);

    let abacateRevenueCents = 0;
    for (const billing of abacateBillings) {
      if (billing.status !== "PAID" || billing.devMode) continue;
      const t = new Date(billing.createdAt).getTime();
      if (t >= startMs && t <= endMs) abacateRevenueCents += billing.amount || 0;
    }

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
      stripeRevenueCents,
      abacateRevenueCents,
      affiliateCostCents,
      manualCosts,
      manualCostsTotalCents,
    };
  });

  return NextResponse.json({
    periods: results,
    formatLabel: Object.fromEntries(periods.map((p) => [p, formatPeriodLabel(p)])),
  });
}
