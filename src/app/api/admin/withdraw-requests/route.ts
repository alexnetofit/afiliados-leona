import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return profile?.role === "admin" ? user : null;
}

export async function GET() {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { data: requests } = await supabaseAdmin
      .from("withdraw_requests")
      .select("*")
      .order("created_at", { ascending: false });

    return NextResponse.json({ requests: requests || [] });
  } catch (error) {
    console.error("[ADMIN] Error fetching withdraw requests:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { id, status } = await request.json();

    if (!id || !["pending", "paid", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("withdraw_requests")
      .update({ status })
      .eq("id", id);

    if (updateError) {
      console.error("[ADMIN] Error updating withdraw request:", updateError);
      return NextResponse.json({ error: `Erro ao atualizar: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN] Error updating withdraw request:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
