import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAGE_SIZE = 1000;

async function fetchAllPaged<T>(
  makeQuery: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < 200; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await makeQuery(from, from + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return out;
}

export async function PATCH(request: Request) {
  try {
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

    const body = await request.json();
    const { affiliateId, commission_tier, tier_locked } = body as {
      affiliateId?: string;
      commission_tier?: number;
      tier_locked?: boolean;
    };

    if (!affiliateId || !commission_tier || ![1, 2, 3].includes(commission_tier)) {
      return NextResponse.json(
        { error: "affiliateId e commission_tier (1, 2 ou 3) são obrigatórios" },
        { status: 400 }
      );
    }

    // Toda mudança manual de tier vira override protegido por padrão (tier_locked=true),
    // senão o trigger update_affiliate_tier ou o cron cron_update_affiliate_tiers
    // recalcula a partir de paid_subscriptions_count e desfaz a alteração silenciosamente.
    // Admin pode explicitamente passar tier_locked:false pra "voltar ao automático".
    const lock = typeof tier_locked === "boolean" ? tier_locked : true;

    const { error } = await supabaseAdmin
      .from("affiliates")
      .update({ commission_tier, tier_locked: lock })
      .eq("id", affiliateId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tierNames: Record<number, string> = { 1: "Bronze 30%", 2: "Prata 35%", 3: "Ouro 40%" };
    const lockSuffix = lock ? " (override protegido)" : " (automático)";
    return NextResponse.json({
      success: true,
      message: `Tier alterado para ${tierNames[commission_tier]}${lockSuffix}`,
    });
  } catch (error) {
    console.error("[ADMIN] Error updating tier:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

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

    // PostgREST corta em 1000 linhas. Sem range a lista do admin parava em 1000
    // enquanto o banco já passou disso.
    type AffiliateRow = {
      id: string;
      affiliate_code: string;
      commission_tier: number;
      paid_subscriptions_count: number;
      tier_locked: boolean;
      is_active: boolean;
      created_at: string;
      user_id: string;
    };
    const affiliatesData = await fetchAllPaged<AffiliateRow>((from, to) =>
      supabaseAdmin
        .from("affiliates")
        .select("id, affiliate_code, commission_tier, paid_subscriptions_count, tier_locked, is_active, created_at, user_id")
        .order("created_at", { ascending: false })
        .range(from, to)
    );

    if (!affiliatesData.length) {
      return NextResponse.json({ affiliates: [] });
    }

    const profiles = await fetchAllPaged<{ id: string; full_name: string | null }>((from, to) =>
      supabaseAdmin.from("profiles").select("id, full_name").range(from, to)
    );
    const profileMap = new Map(profiles.map((p) => [p.id, p.full_name]));

    const emailMap = new Map<string, string>();
    for (let page = 1; page <= 20; page++) {
      const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
      const users = data?.users || [];
      for (const u of users) {
        if (u.email) emailMap.set(u.id, u.email);
      }
      if (users.length < PAGE_SIZE) break;
    }

    const commissionMap = new Map<string, number>();
    const commissionRows = await fetchAllPaged<{
      affiliate_id: string;
      commission_amount_cents: number;
    }>((from, to) =>
      supabaseAdmin
        .from("transactions")
        .select("affiliate_id, commission_amount_cents")
        .eq("type", "commission")
        .range(from, to)
    );
    for (const tx of commissionRows) {
      commissionMap.set(
        tx.affiliate_id,
        (commissionMap.get(tx.affiliate_id) || 0) + tx.commission_amount_cents
      );
    }

    const activeSubs = await fetchAllPaged<{ affiliate_id: string }>((from, to) =>
      supabaseAdmin
        .from("subscriptions")
        .select("affiliate_id")
        .eq("status", "active")
        .range(from, to)
    );
    const activeSubMap = new Map<string, number>();
    for (const sub of activeSubs) {
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
      tier_locked: affiliate.tier_locked,
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
