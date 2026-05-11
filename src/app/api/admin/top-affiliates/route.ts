import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
const WISE_PROFILE_ID = process.env.WISE_PROFILE_ID;
const WISE_BALANCE_ID = process.env.WISE_BALANCE_ID;

const TOP_AFFILIATE_EMAIL = "tbnegociodigital@gmail.com";
const WISE_CARD_LAST_FOUR = "1421";

interface WiseTransaction {
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: string;
  runningBalance: number;
}

async function fetchWiseCardSpending(
  startDate: string,
  endDate: string
): Promise<{ transactions: WiseTransaction[]; totalSpent: number } | null> {
  if (!WISE_API_TOKEN || !WISE_PROFILE_ID || !WISE_BALANCE_ID) {
    return null;
  }

  try {
    const url = new URL(
      `https://api.wise.com/v1/profiles/${WISE_PROFILE_ID}/balance-statements/${WISE_BALANCE_ID}/statement`
    );
    url.searchParams.set("intervalStart", `${startDate}T00:00:00.000Z`);
    url.searchParams.set("intervalEnd", `${endDate}T23:59:59.999Z`);
    url.searchParams.set("type", "COMPACT");
    url.searchParams.set("currency", "USD");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${WISE_API_TOKEN}` },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[Wise] Error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const txs: WiseTransaction[] = [];
    let totalSpent = 0;

    for (const t of data.transactions || []) {
      if (t.type !== "DEBIT") continue;
      if (t.details?.type !== "CARD") continue;
      if (t.details?.cardLastFourDigits !== WISE_CARD_LAST_FOUR) continue;

      const amt = t.amount?.value || 0;
      const cur = t.amount?.currency || "USD";

      txs.push({
        date: t.date || "",
        description: t.details?.description || t.details?.merchant?.name || "Transação",
        amount: amt,
        currency: cur,
        type: t.type,
        runningBalance: t.runningBalance?.value || 0,
      });

      totalSpent += Math.abs(amt);
    }

    return { transactions: txs, totalSpent };
  } catch (err) {
    console.error("[Wise] Fetch error:", err);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "auth" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { data: users } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const targetUser = users?.users?.find(
    (u) => u.email?.toLowerCase() === TOP_AFFILIATE_EMAIL
  );
  if (!targetUser) {
    return NextResponse.json(
      { error: "affiliate_not_found" },
      { status: 404 }
    );
  }

  const { data: affiliate } = await supabaseAdmin
    .from("affiliates")
    .select("id, affiliate_code, commission_tier, paid_subscriptions_count")
    .eq("user_id", targetUser.id)
    .single();

  if (!affiliate) {
    return NextResponse.json(
      { error: "affiliate_not_found" },
      { status: 404 }
    );
  }

  const { data: profileData } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", targetUser.id)
    .single();

  const { data: transactions } = await supabaseAdmin
    .from("transactions")
    .select(
      "id, type, amount_gross_cents, commission_percent, commission_amount_cents, paid_at, available_at, description"
    )
    .eq("affiliate_id", affiliate.id)
    .order("paid_at", { ascending: false });

  const { data: pixExpensesRaw } = await supabaseAdmin
    .from("top_affiliate_pix_expenses")
    .select("id, amount_brl_cents, paid_at, description")
    .eq("affiliate_id", affiliate.id)
    .order("paid_at", { ascending: false });

  const pixExpenses = pixExpensesRaw || [];
  const pixTotalBrlCents = pixExpenses.reduce(
    (sum, p) => sum + (p.amount_brl_cents || 0),
    0
  );

  const txs = transactions || [];
  const now = new Date();

  let totalCommissionCents = 0;
  let totalRefundCents = 0;
  let releasedCommissions = 0;
  let releasedRefunds = 0;
  let pendingCommissions = 0;
  let pendingRefunds = 0;

  for (const t of txs) {
    if (t.type === "commission") {
      totalCommissionCents += t.commission_amount_cents;
      if (t.available_at && new Date(t.available_at) <= now) {
        releasedCommissions += t.commission_amount_cents;
      } else {
        pendingCommissions += t.commission_amount_cents;
      }
    } else if (t.type === "refund" || t.type === "dispute") {
      totalRefundCents += Math.abs(t.commission_amount_cents);
      if (t.available_at && new Date(t.available_at) <= now) {
        releasedRefunds += Math.abs(t.commission_amount_cents);
      } else {
        pendingRefunds += Math.abs(t.commission_amount_cents);
      }
    }
  }

  const netCents = totalCommissionCents - totalRefundCents;
  const releasedCents = releasedCommissions - releasedRefunds;
  const pendingCents = pendingCommissions - pendingRefunds;

  const wiseParam = request.nextUrl.searchParams.get("wise");
  let wiseData: {
    transactions: WiseTransaction[];
    totalSpent: number;
  } | null = null;

  if (wiseParam === "true") {
    const startDate = "2026-01-01";
    const endDate = now.toISOString().split("T")[0];
    wiseData = await fetchWiseCardSpending(startDate, endDate);
  }

  const wiseConfigured = !!(WISE_API_TOKEN && WISE_PROFILE_ID && WISE_BALANCE_ID);

  return NextResponse.json({
    affiliate: {
      name: profileData?.full_name || TOP_AFFILIATE_EMAIL,
      email: TOP_AFFILIATE_EMAIL,
      code: affiliate.affiliate_code,
      tier: affiliate.commission_tier,
      salesCount: affiliate.paid_subscriptions_count,
    },
    commission: {
      grossCents: totalCommissionCents,
      refundCents: totalRefundCents,
      totalCents: netCents,
      releasedCents,
      pendingCents,
    },
    wise: wiseData
      ? {
          totalSpentCents: Math.round(wiseData.totalSpent * 100),
          transactions: wiseData.transactions,
        }
      : null,
    wiseConfigured,
    pixExpenses,
    pixTotalBrlCents,
    transactions: txs.slice(0, 100),
  });
}
