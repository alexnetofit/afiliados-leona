import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TOP_AFFILIATE_EMAIL = "tbnegociodigital@gmail.com";

async function verifyAdminAndGetEmail(): Promise<string | null> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return null;
  return user.email ?? null;
}

async function resolveTopAffiliateId(): Promise<string | null> {
  const { data: users } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const targetUser = users?.users?.find(
    (u) => u.email?.toLowerCase() === TOP_AFFILIATE_EMAIL
  );
  if (!targetUser) return null;

  const { data: affiliate } = await supabaseAdmin
    .from("affiliates")
    .select("id")
    .eq("user_id", targetUser.id)
    .single();

  return affiliate?.id ?? null;
}

export async function POST(request: NextRequest) {
  const adminEmail = await verifyAdminAndGetEmail();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { amount_brl_cents?: number; paid_at?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const amount = Number(body.amount_brl_cents);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "amount_brl_cents inválido" },
      { status: 400 }
    );
  }

  const paidAt = body.paid_at ? new Date(body.paid_at) : new Date();
  if (Number.isNaN(paidAt.getTime())) {
    return NextResponse.json({ error: "paid_at inválido" }, { status: 400 });
  }

  const affiliateId = await resolveTopAffiliateId();
  if (!affiliateId) {
    return NextResponse.json({ error: "affiliate_not_found" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("top_affiliate_pix_expenses")
    .insert({
      affiliate_id: affiliateId,
      amount_brl_cents: Math.round(amount),
      paid_at: paidAt.toISOString(),
      description: body.description?.trim() || null,
      created_by_admin: adminEmail,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ expense: data });
}

export async function DELETE(request: NextRequest) {
  const adminEmail = await verifyAdminAndGetEmail();
  if (!adminEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const affiliateId = await resolveTopAffiliateId();
  if (!affiliateId) {
    return NextResponse.json({ error: "affiliate_not_found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("top_affiliate_pix_expenses")
    .delete()
    .eq("id", id)
    .eq("affiliate_id", affiliateId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
