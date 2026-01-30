import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Check if admin
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const payoutDate = searchParams.get("payoutDate");

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate e endDate são obrigatórios" }, { status: 400 });
    }

    // Fetch transactions (using service role - bypasses RLS)
    const { data: transactions, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("id, affiliate_id, commission_amount_cents, paid_at, available_at, type")
      .gte("paid_at", startDate)
      .lte("paid_at", endDate)
      .eq("type", "commission");

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ payouts: [], stats: { pending: 0, paid: 0, count: 0 } });
    }

    // Group by affiliate
    const affiliateMap = new Map<string, { total: number; count: number }>();
    transactions.forEach((tx) => {
      const existing = affiliateMap.get(tx.affiliate_id) || { total: 0, count: 0 };
      existing.total += tx.commission_amount_cents;
      existing.count += 1;
      affiliateMap.set(tx.affiliate_id, existing);
    });

    // Fetch affiliates with profiles
    const affiliateIds = Array.from(affiliateMap.keys());
    const { data: affiliates } = await supabaseAdmin
      .from("affiliates")
      .select("id, affiliate_code, payout_pix_key, payout_wise_email, user_id")
      .in("id", affiliateIds);

    if (!affiliates || affiliates.length === 0) {
      return NextResponse.json({ payouts: [], stats: { pending: 0, paid: 0, count: 0 } });
    }

    // Fetch profiles for names
    const userIds = affiliates.map(a => a.user_id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const profileMap = new Map<string, string>();
    profiles?.forEach(p => profileMap.set(p.id, p.full_name || ""));

    // Check existing payouts
    const { data: existingPayouts } = await supabaseAdmin
      .from("monthly_payouts")
      .select("affiliate_id, status, paid_at")
      .eq("month", payoutDate);

    const paidMap = new Map<string, string>();
    existingPayouts?.forEach(p => {
      if (p.status === "paid" && p.paid_at) {
        paidMap.set(p.affiliate_id, p.paid_at);
      }
    });

    // Build response
    const payouts = affiliates.map(aff => {
      const txData = affiliateMap.get(aff.id) || { total: 0, count: 0 };
      const isPaid = paidMap.has(aff.id);

      return {
        affiliate_id: aff.id,
        affiliate_code: aff.affiliate_code,
        full_name: profileMap.get(aff.user_id) || null,
        email: aff.payout_wise_email || "-",
        payout_pix_key: aff.payout_pix_key,
        payout_wise_email: aff.payout_wise_email,
        total_cents: txData.total,
        transactions_count: txData.count,
        status: isPaid ? "paid" : "pending",
        paid_at: paidMap.get(aff.id) || null,
      };
    });

    // Sort by total descending
    payouts.sort((a, b) => b.total_cents - a.total_cents);

    const stats = {
      pending: payouts.filter(p => p.status === "pending").reduce((sum, p) => sum + p.total_cents, 0),
      paid: payouts.filter(p => p.status === "paid").reduce((sum, p) => sum + p.total_cents, 0),
      count: payouts.filter(p => p.status === "pending").length,
    };

    return NextResponse.json({ payouts, stats });
  } catch (error) {
    console.error("Payouts API error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// Mark as paid
export async function POST(request: NextRequest) {
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
    const { affiliateIds, payoutDate, amounts } = body;

    if (!affiliateIds || !payoutDate || !amounts) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    // Insert/update payout records
    for (let i = 0; i < affiliateIds.length; i++) {
      const affiliateId = affiliateIds[i];
      const amount = amounts[affiliateId] || 0;

      const { data: existing } = await supabaseAdmin
        .from("monthly_payouts")
        .select("id")
        .eq("affiliate_id", affiliateId)
        .eq("month", payoutDate)
        .single();

      if (existing) {
        await supabaseAdmin
          .from("monthly_payouts")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            total_commission_cents: amount,
            total_payable_cents: amount,
          })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin
          .from("monthly_payouts")
          .insert({
            affiliate_id: affiliateId,
            month: payoutDate,
            total_commission_cents: amount,
            total_negative_cents: 0,
            total_payable_cents: amount,
            status: "paid",
            paid_at: new Date().toISOString(),
          });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark as paid error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
