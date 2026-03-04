import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function tierToPercent(tier: number): number {
  if (tier >= 3) return 40;
  if (tier >= 2) return 35;
  return 30;
}

function tierToName(tier: number): string {
  if (tier >= 3) return "Ouro";
  if (tier >= 2) return "Prata";
  return "Bronze";
}

export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { data: affiliate } = await supabaseAdmin
      .from("affiliates")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!affiliate) {
      return NextResponse.json({ affiliates: [] });
    }

    const { data: managed } = await supabaseAdmin
      .from("manager_affiliates")
      .select("affiliate_id, commission_percent")
      .eq("manager_id", affiliate.id);

    if (!managed || managed.length === 0) {
      return NextResponse.json({ affiliates: [] });
    }

    const affiliateIds = managed.map((m: { affiliate_id: string }) => m.affiliate_id);

    const [affiliatesRes, profilesRes, transactionsRes, subscriptionsRes] = await Promise.all([
      supabaseAdmin
        .from("affiliates")
        .select("id, user_id, affiliate_code, commission_tier, created_at")
        .in("id", affiliateIds),
      supabaseAdmin.from("profiles").select("id, full_name"),
      supabaseAdmin
        .from("transactions")
        .select("affiliate_id, type, commission_amount_cents")
        .in("affiliate_id", affiliateIds),
      supabaseAdmin
        .from("subscriptions")
        .select("affiliate_id, status")
        .in("affiliate_id", affiliateIds),
    ]);

    const affiliates = affiliatesRes.data || [];
    const allProfiles = profilesRes.data || [];
    const transactions = transactionsRes.data || [];
    const subscriptions = subscriptionsRes.data || [];

    const userIds = affiliates.map((a: { user_id: string }) => a.user_id);
    const profiles = allProfiles.filter((p: { id: string }) => userIds.includes(p.id));

    const result = affiliates.map(
      (aff: {
        id: string;
        user_id: string;
        affiliate_code: string;
        commission_tier: number;
        created_at: string;
      }) => {
        const mgrEntry = managed.find(
          (m: { affiliate_id: string }) => m.affiliate_id === aff.id
        );
        const prof = profiles.find((p: { id: string }) => p.id === aff.user_id);
        const affTxs = transactions.filter(
          (t: { affiliate_id: string; type: string }) =>
            t.affiliate_id === aff.id && t.type === "commission"
        );
        const affSubs = subscriptions.filter(
          (s: { affiliate_id: string }) => s.affiliate_id === aff.id
        );

        const totalSales = affTxs.length;
        const totalRevenueCents = affTxs.reduce(
          (sum: number, t: { commission_amount_cents: number }) =>
            sum + t.commission_amount_cents,
          0
        );
        const activeSubs = affSubs.filter(
          (s: { status: string }) => s.status === "active"
        ).length;

        return {
          id: aff.id,
          name: (prof as { full_name?: string } | undefined)?.full_name || "—",
          affiliate_code: aff.affiliate_code,
          tier: aff.commission_tier,
          tier_name: tierToName(aff.commission_tier),
          commission_percent: tierToPercent(aff.commission_tier),
          manager_commission_percent:
            (mgrEntry as { commission_percent?: number } | undefined)?.commission_percent || 3,
          total_sales: totalSales,
          total_revenue_cents: totalRevenueCents,
          active_subscriptions: activeSubs,
          total_subscriptions: affSubs.length,
          created_at: aff.created_at,
        };
      }
    );

    return NextResponse.json({ affiliates: result });
  } catch (error) {
    console.error("[MANAGER AFFILIATES]", error);
    return NextResponse.json({ affiliates: [] });
  }
}
