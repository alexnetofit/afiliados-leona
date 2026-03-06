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

  const results: PeriodData[] = [];

  // Pre-fetch AbacatePay billings (single call, cached)
  const abacateBillings = await fetchAbacateBillings();

  for (const label of periods) {
    const { start, end } = getPeriodRange(label);
    const startTs = Math.floor(start.getTime() / 1000);
    const endTs = Math.floor(end.getTime() / 1000);

    // 1. Stripe revenue: paid invoices in the period
    let stripeRevenueCents = 0;
    try {
      for await (const invoice of stripe.invoices.list({
        created: { gte: startTs, lte: endTs },
        status: "paid",
        limit: 100,
      })) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stripeRevenueCents += (invoice as any).amount_paid || 0;
      }
    } catch (e) {
      console.error(`Error fetching Stripe invoices for ${label}:`, e);
    }

    // 1b. AbacatePay revenue: paid billings in the period
    let abacateRevenueCents = 0;
    for (const billing of abacateBillings) {
      if (billing.status !== "PAID" || billing.devMode) continue;
      const billingDate = new Date(billing.createdAt);
      if (billingDate >= start && billingDate <= end) {
        abacateRevenueCents += billing.amount || 0;
      }
    }

    // 2. Affiliate costs: commission transactions in the period (from our DB)
    const { data: txs } = await supabaseAdmin
      .from("transactions")
      .select("commission_amount_cents, type")
      .gte("paid_at", start.toISOString())
      .lte("paid_at", end.toISOString());

    const affiliateCostCents = (txs || []).reduce(
      (sum, t) => sum + t.commission_amount_cents,
      0
    );

    // 3. Manual costs
    let manualCosts: Array<{ id: string; category: string; description: string | null; amount_cents: number }> = [];
    let manualCostsTotalCents = 0;
    try {
      const { data: costs } = await supabaseAdmin
        .from("admin_costs")
        .select("id, category, description, amount_cents")
        .eq("period_label", label)
        .order("created_at", { ascending: true });

      manualCosts = (costs || []) as typeof manualCosts;
      manualCostsTotalCents = manualCosts.reduce((sum, c) => sum + c.amount_cents, 0);
    } catch {
      // Table might not exist yet
    }

    results.push({
      label,
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      stripeRevenueCents,
      abacateRevenueCents,
      affiliateCostCents,
      manualCosts,
      manualCostsTotalCents,
    });
  }

  return NextResponse.json({
    periods: results,
    formatLabel: Object.fromEntries(periods.map((p) => [p, formatPeriodLabel(p)])),
  });
}
