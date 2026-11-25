import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  activityStatusForSubscriptions,
  fetchAllPages,
  type ActivityPayment,
} from "@/lib/subscription-activity";

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

    const [subs, affiliatesRes, profilesRes] = await Promise.all([
      fetchAllPages<Record<string, unknown>>((from, to) =>
        supabaseAdmin
          .from("subscriptions")
          .select("*")
          .in("affiliate_id", affiliateIds)
          .order("id", { ascending: true })
          .range(from, to)
      ),
      supabaseAdmin
        .from("affiliates")
        .select("id, user_id")
        .in("id", affiliateIds),
      supabaseAdmin.from("profiles").select("id, full_name"),
    ]);
    const affiliates = affiliatesRes.data || [];
    const profiles = profilesRes.data || [];
    const payments = await fetchAllPages<ActivityPayment>((from, to) =>
      supabaseAdmin
        .from("transactions")
        .select("subscription_id, type, paid_at, guru_transaction_id, stripe_invoice_id")
        .in("affiliate_id", affiliateIds)
        .order("id", { ascending: true })
        .range(from, to)
    );
    const statusById = activityStatusForSubscriptions(
      subs.map((sub) => ({
        id: String(sub.id),
        status: sub.status == null ? null : String(sub.status),
        is_trial: Boolean(sub.is_trial),
        trial_end: sub.trial_end == null ? null : String(sub.trial_end),
      })),
      payments
    );

    const result = subs.map((sub: Record<string, unknown>) => {
      const aff = affiliates.find(
        (a: { id: string }) => a.id === sub.affiliate_id
      );
      const prof = aff
        ? profiles.find((p: { id: string }) => p.id === (aff as { user_id: string }).user_id)
        : null;

      return {
        ...sub,
        status: statusById.get(String(sub.id)) || "canceled",
        managed_affiliate_name: (prof as { full_name?: string } | null)?.full_name || "—",
      };
    });

    return NextResponse.json({ subscriptions: result });
  } catch (error) {
    console.error("[MANAGER SUBSCRIPTIONS]", error);
    return NextResponse.json({ subscriptions: [] });
  }
}
