import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { fetchWiseCardSpending } from "@/lib/wise";
import { isTopAffiliateEmail } from "@/lib/top-affiliate";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Total já pago/usado manualmente (Wise + Pix) para top afiliados, que são
// pagos por fora do fluxo de saque. Usado no card "Total recebido" do painel
// do próprio afiliado. Só responde para o top afiliado autenticado.
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }

  if (!isTopAffiliateEmail(user.email)) {
    return NextResponse.json({ applicable: false });
  }

  const { data: affiliate } = await supabaseAdmin
    .from("affiliates")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!affiliate) {
    return NextResponse.json({ applicable: false });
  }

  const { data: pixRows } = await supabaseAdmin
    .from("top_affiliate_pix_expenses")
    .select("amount_brl_cents")
    .eq("affiliate_id", affiliate.id);

  const pixTotalBrlCents = (pixRows || []).reduce(
    (sum, p: { amount_brl_cents: number | null }) => sum + (p.amount_brl_cents || 0),
    0
  );

  const startDate = "2026-01-01";
  const endDate = new Date().toISOString().split("T")[0];
  const wise = await fetchWiseCardSpending(startDate, endDate);

  const wiseUsdCents = wise ? Math.round(wise.totalSpent * 100) : 0;
  // Cada gasto Wise vira BRL pelo PTAX do dia em que saiu, não pelo câmbio de hoje.
  const wiseBrlCents = wise ? Math.round(wise.totalSpentBrl * 100) : 0;
  const usedBrlCents = wiseBrlCents + pixTotalBrlCents;

  return NextResponse.json({
    applicable: true,
    usedBrlCents,
    wiseBrlCents,
    wiseUsdCents,
    pixTotalBrlCents,
  });
}
