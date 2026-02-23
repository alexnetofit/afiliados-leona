import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    const { affiliateName, affiliateEmail, amount, dateLabel } = await request.json();

    if (!affiliateEmail || !amount) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "Leona Afiliados <onboarding@resend.dev>",
      to: affiliateEmail,
      subject: `PAGAMENTO REALIZADO: ${affiliateName || "Afiliado"}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px;">
          <h2 style="color: #18181b;">Saque Processado ✅</h2>
          <p style="color: #3f3f46; font-size: 16px;">
            Olá, <strong>${affiliateName || "Afiliado"}</strong>!
          </p>
          <p style="color: #3f3f46; font-size: 16px;">
            Seu saque de <strong>${amount}</strong> foi processado com sucesso.
          </p>
          ${dateLabel ? `<p style="color: #71717a; font-size: 14px;">Referente à liberação de ${dateLabel}.</p>` : ""}
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

    if (emailError) {
      return NextResponse.json(
        { error: `Resend: ${emailError.message}`, details: emailError },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, emailId: emailData?.id });
  } catch (error) {
    console.error("[NOTIFY-PAID] Error:", error);
    return NextResponse.json(
      { error: "Erro ao enviar notificação" },
      { status: 500 }
    );
  }
}
