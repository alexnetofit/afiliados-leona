import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { mgrCode, userId } = await request.json();

    if (!mgrCode || !userId) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }

    const { data: manager } = await supabaseAdmin
      .from("affiliates")
      .select("id")
      .eq("affiliate_code", mgrCode.toUpperCase())
      .single();

    if (!manager) {
      return NextResponse.json({ error: "Gerente não encontrado" }, { status: 404 });
    }

    // Retry to find the new affiliate (trigger may have slight delay)
    let newAffiliate = null;
    for (let i = 0; i < 5; i++) {
      const { data } = await supabaseAdmin
        .from("affiliates")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (data) {
        newAffiliate = data;
        break;
      }
      await new Promise((r) => setTimeout(r, 800));
    }

    if (!newAffiliate) {
      return NextResponse.json({ error: "Afiliado não encontrado" }, { status: 404 });
    }

    if (manager.id === newAffiliate.id) {
      return NextResponse.json({ error: "Não pode ser gerente de si mesmo" }, { status: 400 });
    }

    await supabaseAdmin.from("manager_affiliates").upsert(
      {
        manager_id: manager.id,
        affiliate_id: newAffiliate.id,
        commission_percent: 3,
      },
      { onConflict: "manager_id,affiliate_id" }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[REGISTER MANAGER]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
