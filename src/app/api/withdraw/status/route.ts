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
      .select("date_label")
      .eq("affiliate_id", affiliateId);

    const dateLabels = (data || [])
      .map((r: { date_label: string | null }) => r.date_label)
      .filter(Boolean);

    return NextResponse.json({ dateLabels });
  } catch (error) {
    console.error("[WITHDRAW STATUS] Error:", error);
    return NextResponse.json({ dateLabels: [] });
  }
}
