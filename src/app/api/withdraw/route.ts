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
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_BASE_URL = "https://api.asaas.com";

function detectPixType(key: string): string {
  const clean = key.replace(/[.\-/\s]/g, "");
  if (/^\d{11}$/.test(clean)) return "CPF";
  if (/^\d{14}$/.test(clean)) return "CNPJ";
  if (/^(\+?55)?\d{10,11}$/.test(clean)) return "PHONE";
  if (key.includes("@")) return "EMAIL";
  return "EVP";
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { affiliateName, amount, amountCents, dateLabel, pixKey, affiliateId } = await request.json();

    if (!affiliateName || !amount || !pixKey || !amountCents) {
      return NextResponse.json(
        { error: "Dados incompletos. Verifique nome, valor e chave PIX." },
        { status: 400 }
      );
    }

    // Prevent duplicates (allow retry if previous attempt failed)
    if (affiliateId && dateLabel) {
      const { data: existing } = await supabaseAdmin
        .from("withdraw_requests")
        .select("id, status")
        .eq("affiliate_id", affiliateId)
        .eq("date_label", dateLabel)
        .limit(1);

      if (existing && existing.length > 0) {
        const prev = existing[0];
        if (prev.status === "failed") {
          await supabaseAdmin
            .from("withdraw_requests")
            .delete()
            .eq("id", prev.id);
        } else {
          return NextResponse.json({ success: true, duplicate: true });
        }
      }
    }

    // --- Create Asaas PIX transfer ---
    if (!ASAAS_API_KEY) {
      return NextResponse.json(
        { error: "Chave API Asaas não configurada no servidor" },
        { status: 500 }
      );
    }

    const pixType = detectPixType(pixKey);
    const transferValue = amountCents / 100;

    const asaasRes = await fetch(`${ASAAS_BASE_URL}/v3/transfers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: ASAAS_API_KEY,
      },
      body: JSON.stringify({
        value: transferValue,
        operationType: "PIX",
        pixAddressKey: pixKey,
        pixAddressKeyType: pixType,
        description: `Comissao ${affiliateName} - ${dateLabel || "saque"}`,
        externalReference: affiliateId ? `withdraw-${affiliateId}-${dateLabel}` : undefined,
      }),
    });

    const asaasData = await asaasRes.json();

    if (!asaasRes.ok) {
      const errorMsg = asaasData?.errors?.[0]?.description
        || asaasData?.error
        || "Erro ao criar transferência no Asaas";
      console.error("[WITHDRAW] Asaas error:", JSON.stringify(asaasData));
      return NextResponse.json(
        { error: `Falha na transferência PIX: ${errorMsg}` },
        { status: 400 }
      );
    }

    const asaasTransferId = asaasData.id;
    const ownerName = asaasData.bankAccount?.ownerName || null;
    const bankName = asaasData.bankAccount?.bank?.name || null;
    const cpfCnpj = asaasData.bankAccount?.cpfCnpj || null;

    // --- Save to database as PROCESSING (webhook will update to paid) ---
    if (affiliateId && dateLabel) {
      await supabaseAdmin.from("withdraw_requests").insert({
        affiliate_id: affiliateId,
        affiliate_name: affiliateName,
        affiliate_email: user.email,
        amount_text: amount,
        date_label: dateLabel,
        pix_key: pixKey,
        status: "processing",
        asaas_transfer_id: asaasTransferId,
      });
    }

    // --- Send notification email to admin ---
    const pixHtml = `<div style="background: #f4f4f5; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
      <p style="color: #3f3f46; font-size: 14px; margin: 0 0 4px 0; font-weight: 600;">Dados da transferência:</p>
      <p style="color: #52525b; font-size: 14px; margin: 2px 0;"><strong>PIX:</strong> ${pixKey}</p>
      ${ownerName ? `<p style="color: #52525b; font-size: 14px; margin: 2px 0;"><strong>Titular:</strong> ${ownerName}</p>` : ""}
      ${bankName ? `<p style="color: #52525b; font-size: 14px; margin: 2px 0;"><strong>Banco:</strong> ${bankName}</p>` : ""}
      <p style="color: #52525b; font-size: 14px; margin: 2px 0;"><strong>Asaas ID:</strong> ${asaasTransferId}</p>
      <p style="color: #52525b; font-size: 14px; margin: 2px 0;"><strong>Status:</strong> Aguardando autorização no app</p>
    </div>`;

    try {
      await resend.emails.send({
        from: "Leona Afiliados <onboarding@resend.dev>",
        to: ADMIN_EMAIL,
        subject: `SAQUE AFILIADO LEONA: ${affiliateName} - ${amount}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px;">
            <h2 style="color: #18181b;">Transferência PIX Criada</h2>
            <p style="color: #3f3f46; font-size: 16px;">
              O afiliado <strong>${affiliateName}</strong> confirmou o saque de <strong>${amount}</strong>.
            </p>
            ${dateLabel ? `<p style="color: #71717a; font-size: 14px;">Referente à liberação de ${dateLabel}.</p>` : ""}
            <p style="color: #71717a; font-size: 14px;">Email do afiliado: ${user.email}</p>
            ${pixHtml}
            <p style="color: #ef4444; font-size: 14px; font-weight: 600; margin-top: 16px;">
              ⚠ Autorize esta transferência no app Asaas.
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
            <p style="color: #a1a1aa; font-size: 12px;">Enviado automaticamente pelo sistema de afiliados Leona.</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("[WITHDRAW] Error sending admin email:", emailErr);
    }

    return NextResponse.json({
      success: true,
      ownerName,
      bankName,
      cpfCnpj,
      asaasTransferId,
    });
  } catch (error) {
    console.error("[WITHDRAW] Error:", error);
    return NextResponse.json(
      { error: "Erro ao processar solicitação de saque" },
      { status: 500 }
    );
  }
}
