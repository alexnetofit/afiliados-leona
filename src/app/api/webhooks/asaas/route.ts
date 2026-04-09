import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;

export async function POST(request: NextRequest) {
  try {
    // Validate webhook token if configured
    if (ASAAS_WEBHOOK_TOKEN) {
      const token = request.headers.get("asaas-access-token");
      if (token !== ASAAS_WEBHOOK_TOKEN) {
        console.error("[ASAAS WEBHOOK] Invalid token");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await request.json();
    const event = body.event as string;
    const transfer = body.transfer;

    if (!transfer?.id) {
      return NextResponse.json({ received: true });
    }

    console.log(`[ASAAS WEBHOOK] Event: ${event}, Transfer: ${transfer.id}, Status: ${transfer.status}`);

    // Find the withdraw_request by asaas_transfer_id
    const { data: withdrawRequest } = await supabaseAdmin
      .from("withdraw_requests")
      .select("id, affiliate_name, affiliate_email, amount_text, date_label, status")
      .eq("asaas_transfer_id", transfer.id)
      .single();

    if (!withdrawRequest) {
      console.log(`[ASAAS WEBHOOK] No withdraw_request found for transfer ${transfer.id}`);
      return NextResponse.json({ received: true });
    }

    switch (event) {
      case "TRANSFER_DONE": {
        // Transfer completed - mark as paid
        await supabaseAdmin
          .from("withdraw_requests")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
          })
          .eq("id", withdrawRequest.id);

        // Send "paid" email to partner
        if (withdrawRequest.affiliate_email) {
          try {
            await resend.emails.send({
              from: "Leona Afiliados <onboarding@resend.dev>",
              to: withdrawRequest.affiliate_email,
              subject: `Leona Afiliados - Saque processado, ${withdrawRequest.affiliate_name || "Afiliado"}`,
              html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px;">
                  <h2 style="color: #18181b;">Saque Processado</h2>
                  <p style="color: #3f3f46; font-size: 16px;">
                    Olá, <strong>${withdrawRequest.affiliate_name || "Afiliado"}</strong>!
                  </p>
                  <p style="color: #3f3f46; font-size: 16px;">
                    Seu saque de <strong>${withdrawRequest.amount_text}</strong> foi processado com sucesso.
                  </p>
                  ${withdrawRequest.date_label ? `<p style="color: #71717a; font-size: 14px;">Referente à liberação de ${withdrawRequest.date_label}.</p>` : ""}
                  <p style="color: #3f3f46; font-size: 14px; margin-top: 16px;">
                    O valor foi enviado para a conta informada. Verifique seu extrato.
                  </p>
                  <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
                  <p style="color: #a1a1aa; font-size: 12px;">Enviado automaticamente pelo sistema de afiliados Leona.</p>
                </div>
              `,
            });
          } catch (emailErr) {
            console.error("[ASAAS WEBHOOK] Error sending paid email:", emailErr);
          }
        }

        console.log(`[ASAAS WEBHOOK] Withdraw ${withdrawRequest.id} marked as PAID`);
        break;
      }

      case "TRANSFER_FAILED": {
        await supabaseAdmin
          .from("withdraw_requests")
          .update({ status: "failed" })
          .eq("id", withdrawRequest.id);

        console.log(`[ASAAS WEBHOOK] Withdraw ${withdrawRequest.id} marked as FAILED. Reason: ${transfer.failReason}`);
        break;
      }

      case "TRANSFER_CANCELLED": {
        await supabaseAdmin
          .from("withdraw_requests")
          .update({ status: "failed" })
          .eq("id", withdrawRequest.id);

        console.log(`[ASAAS WEBHOOK] Withdraw ${withdrawRequest.id} marked as FAILED (cancelled)`);
        break;
      }

      case "TRANSFER_BLOCKED": {
        await supabaseAdmin
          .from("withdraw_requests")
          .update({ status: "failed" })
          .eq("id", withdrawRequest.id);

        console.log(`[ASAAS WEBHOOK] Withdraw ${withdrawRequest.id} marked as FAILED (blocked)`);
        break;
      }

      case "TRANSFER_IN_BANK_PROCESSING":
      case "TRANSFER_PENDING":
      case "TRANSFER_CREATED": {
        // Keep as processing
        if (withdrawRequest.status !== "processing") {
          await supabaseAdmin
            .from("withdraw_requests")
            .update({ status: "processing" })
            .eq("id", withdrawRequest.id);
        }
        break;
      }

      default:
        console.log(`[ASAAS WEBHOOK] Unhandled event: ${event}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[ASAAS WEBHOOK] Error:", error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
