import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
      return NextResponse.json({ subscriptions: [] });
    }

    const { data: managed } = await supabaseAdmin
      .from("manager_affiliates")
      .select("affiliate_id")
      .eq("manager_id", affiliate.id);

    if (!managed || managed.length === 0) {
      return NextResponse.json({ subscriptions: [] });
    }

    const affiliateIds = managed.map((m: { affiliate_id: string }) => m.affiliate_id);

    const [subsRes, affiliatesRes, profilesRes] = await Promise.all([
      supabaseAdmin
        .from("subscriptions")
        .select("*")
        .in("affiliate_id", affiliateIds)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("affiliates")
        .select("id, user_id")
        .in("id", affiliateIds),
      supabaseAdmin.from("profiles").select("id, full_name"),
    ]);

    const subs = subsRes.data || [];
    const affiliates = affiliatesRes.data || [];
    const profiles = profilesRes.data || [];

    const result = subs.map((sub: Record<string, unknown>) => {
      const aff = affiliates.find(
        (a: { id: string }) => a.id === sub.affiliate_id
      );
      const prof = aff
        ? profiles.find((p: { id: string }) => p.id === (aff as { user_id: string }).user_id)
        : null;

      return {
        ...sub,
        managed_affiliate_name: (prof as { full_name?: string } | null)?.full_name || "—",
      };
    });

    return NextResponse.json({ subscriptions: result });
  } catch (error) {
    console.error("[MANAGER SUBSCRIPTIONS]", error);
    return NextResponse.json({ subscriptions: [] });
  }
}
