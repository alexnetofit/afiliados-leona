import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const affiliateId = request.nextUrl.searchParams.get("affiliateId");
    if (!affiliateId) {
      return NextResponse.json({ dateLabels: [] });
    }

    const { data } = await supabaseAdmin
      .from("withdraw_requests")
      .select("date_label, status, paid_at")
      .eq("affiliate_id", affiliateId);

    const withdraws: Record<string, { status: string; paid_at: string | null }> = {};
    (data || []).forEach((r: { date_label: string | null; status: string; paid_at: string | null }) => {
      if (r.date_label) {
        withdraws[r.date_label] = { status: r.status, paid_at: r.paid_at };
      }
    });

    return NextResponse.json({ withdraws });
  } catch (error) {
    console.error("[WITHDRAW STATUS] Error:", error);
    return NextResponse.json({ withdraws: {} });
  }
}
