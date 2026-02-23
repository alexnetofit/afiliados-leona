import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("withdraw_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Solicitação não encontrada" }, { status: 404 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("withdraw_requests")
      .update({ status })
      .eq("id", id);

    if (updateError) {
      console.error("[ADMIN] Error updating withdraw request:", updateError);
      return NextResponse.json({ error: `Erro ao atualizar: ${updateError.message}` }, { status: 500 });
    }

    if (status === "paid" && existing.affiliate_email) {
      await resend.emails.send({
        from: "Leona Afiliados <onboarding@resend.dev>",
        to: existing.affiliate_email,
        subject: `PAGAMENTO REALIZADO: ${existing.affiliate_name || "Afiliado"}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px;">
            <h2 style="color: #18181b;">Saque Processado ✅</h2>
            <p style="color: #3f3f46; font-size: 16px;">
              Olá, <strong>${existing.affiliate_name || "Afiliado"}</strong>!
            </p>
            <p style="color: #3f3f46; font-size: 16px;">
              Seu saque de <strong>${existing.amount_text}</strong> foi processado com sucesso.
            </p>
            ${existing.date_label ? `<p style="color: #71717a; font-size: 14px;">Referente à liberação de ${existing.date_label}.</p>` : ""}
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
              <p style="color: #166534; font-size: 14px; margin: 0; font-weight: 600;">
                O valor foi enviado para a conta informada. Verifique seu extrato.
              </p>
            </div>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
            <p style="color: #a1a1aa; font-size: 12px;">Enviado automaticamente pelo sistema de afiliados Leona.</p>
          </div>
        `,
      });
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
