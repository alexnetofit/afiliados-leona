import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  fetchWiseCardSpending,
  wiseConfigured as isWiseConfigured,
  type WiseTransaction,
} from "@/lib/wise";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TOP_AFFILIATE_EMAIL = "tbnegociodigital@gmail.com";

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

  // Paginação manual: o Supabase limita cada query a 1000 linhas. Afiliados com
  // mais de 1000 transações (muitas vendas + estornos) tinham o cálculo de
  // "Liberado"/"Saldo" truncado — as transações mais antigas (comissões já
  // liberadas) ficavam de fora da janela e o saldo aparecia MENOR do que o real,
  // oscilando pra baixo conforme novas vendas empurravam as antigas pra fora.
  type TxRow = {
    id: string;
    type: string;
    amount_gross_cents: number;
    commission_percent: number;
    commission_amount_cents: number;
    paid_at: string | null;
    available_at: string | null;
    description: string | null;
  };
  const transactions: TxRow[] = [];
  {
    const PAGE = 1000;
    for (let page = 0; page < 200; page++) {
      const fromIdx = page * PAGE;
      const { data, error } = await supabaseAdmin
        .from("transactions")
        .select(
          "id, type, amount_gross_cents, commission_percent, commission_amount_cents, paid_at, available_at, description"
        )
        .eq("affiliate_id", affiliate.id)
        .order("paid_at", { ascending: false })
        .range(fromIdx, fromIdx + PAGE - 1);
      if (error) {
        console.error("[top-affiliates] erro paginando transactions:", error.message);
        break;
      }
      if (!data || data.length === 0) break;
      transactions.push(...(data as TxRow[]));
      if (data.length < PAGE) break;
    }
  }

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

  const txs = transactions;
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

  const wiseConfigured = isWiseConfigured();

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
