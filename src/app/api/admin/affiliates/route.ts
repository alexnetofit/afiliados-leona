import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Auth check
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Fetch all affiliates
    const { data: affiliatesData } = await supabaseAdmin
      .from("affiliates")
      .select("id, affiliate_code, commission_tier, paid_subscriptions_count, is_active, created_at, user_id")
      .order("created_at", { ascending: false });

    if (!affiliatesData) {
      return NextResponse.json({ affiliates: [] });
    }

    // Fetch all profiles in one query
    const userIds = affiliatesData.map((a) => a.user_id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profileMap = new Map(
      (profiles || []).map((p) => [p.id, p.full_name])
    );

    // Fetch all users emails via admin API (paginated)
    const emailMap = new Map<string, string>();
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of users || []) {
      if (u.email) emailMap.set(u.id, u.email);
    }

    // Fetch transactions for all affiliates in one query
    const affiliateIds = affiliatesData.map((a) => a.id);
    const { data: allTransactions } = await supabaseAdmin
      .from("transactions")
      .select("affiliate_id, commission_amount_cents")
      .in("affiliate_id", affiliateIds)
      .eq("type", "commission");

    const commissionMap = new Map<string, number>();
    for (const tx of allTransactions || []) {
      commissionMap.set(
        tx.affiliate_id,
        (commissionMap.get(tx.affiliate_id) || 0) + tx.commission_amount_cents
      );
    }

    // Fetch active subscription counts in one query
    const { data: activeSubs } = await supabaseAdmin
      .from("subscriptions")
      .select("affiliate_id")
      .in("affiliate_id", affiliateIds)
      .eq("status", "active");

    const activeSubMap = new Map<string, number>();
    for (const sub of activeSubs || []) {
      activeSubMap.set(
        sub.affiliate_id,
        (activeSubMap.get(sub.affiliate_id) || 0) + 1
      );
    }

    // Build response
    const enrichedAffiliates = affiliatesData.map((affiliate) => ({
      id: affiliate.id,
      user_id: affiliate.user_id,
      affiliate_code: affiliate.affiliate_code,
      commission_tier: affiliate.commission_tier,
      paid_subscriptions_count: affiliate.paid_subscriptions_count,
      is_active: affiliate.is_active,
      created_at: affiliate.created_at,
      profile: { full_name: profileMap.get(affiliate.user_id) || null },
      user: { email: emailMap.get(affiliate.user_id) || "N/A" },
      totalCommissions: commissionMap.get(affiliate.id) || 0,
      activeSubscriptions: activeSubMap.get(affiliate.id) || 0,
    }));

    return NextResponse.json({ affiliates: enrichedAffiliates });
  } catch (error) {
    console.error("[ADMIN] Error fetching affiliates:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
