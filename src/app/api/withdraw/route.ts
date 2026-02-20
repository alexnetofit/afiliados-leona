import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const ADMIN_EMAIL = "kinhonetovai@gmail.com";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { affiliateName, amount, dateLabel } = await request.json();

    if (!affiliateName || !amount) {
      return NextResponse.json(
        { error: "Dados incompletos" },
        { status: 400 }
      );
    }

    await resend.emails.send({
      from: "Leona Afiliados <onboarding@resend.dev>",
      to: ADMIN_EMAIL,
      subject: `SAQUE AFILIADO LEONA: ${affiliateName}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px;">
          <h2 style="color: #18181b;">Solicitação de Saque</h2>
          <p style="color: #3f3f46; font-size: 16px;">
            O afiliado <strong>${affiliateName}</strong> solicitou o saque de <strong>${amount}</strong>.
          </p>
          ${dateLabel ? `<p style="color: #71717a; font-size: 14px;">Referente à liberação de ${dateLabel}.</p>` : ""}
          <p style="color: #71717a; font-size: 14px;">Email do afiliado: ${user.email}</p>
          <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
          <p style="color: #a1a1aa; font-size: 12px;">Enviado automaticamente pelo sistema de afiliados Leona.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WITHDRAW] Error:", error);
    return NextResponse.json(
      { error: "Erro ao enviar solicitação" },
      { status: 500 }
    );
  }
}
