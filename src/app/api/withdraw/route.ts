import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAIL = "kinhonetovai@gmail.com";

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
  } catch {
    return NextResponse.json({ dateLabels: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { affiliateName, amount, dateLabel, pixKey, wiseEmail, affiliateId } = await request.json();

    if (!affiliateName || !amount) {
      return NextResponse.json(
        { error: "Dados incompletos" },
        { status: 400 }
      );
    }

    const payoutLines: string[] = [];
    if (pixKey) payoutLines.push(`<strong>PIX:</strong> ${pixKey}`);
    if (wiseEmail) payoutLines.push(`<strong>Wise:</strong> ${wiseEmail}`);
    const payoutHtml = payoutLines.length > 0
      ? `<div style="background: #f4f4f5; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
           <p style="color: #3f3f46; font-size: 14px; margin: 0 0 4px 0; font-weight: 600;">Dados para pagamento:</p>
           ${payoutLines.map(l => `<p style="color: #52525b; font-size: 14px; margin: 2px 0;">${l}</p>`).join("")}
         </div>`
      : "";

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
          ${payoutHtml}
          <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
          <p style="color: #a1a1aa; font-size: 12px;">Enviado automaticamente pelo sistema de afiliados Leona.</p>
        </div>
      `,
    });

    // Save to database
    if (affiliateId) {
      await supabaseAdmin.from("withdraw_requests").insert({
        affiliate_id: affiliateId,
        affiliate_name: affiliateName,
        affiliate_email: user.email,
        amount_text: amount,
        date_label: dateLabel || null,
        pix_key: pixKey || null,
        wise_email: wiseEmail || null,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[WITHDRAW] Error:", error);
    return NextResponse.json(
      { error: "Erro ao enviar solicitação" },
      { status: 500 }
    );
  }
}
