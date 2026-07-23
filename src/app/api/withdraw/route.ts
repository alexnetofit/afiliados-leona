import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import {
  type AsaasAccount,
  getAsaasBaseUrl,
  getWithdrawAsaasAccounts,
} from "@/lib/asaas-accounts";
import { formatBrl, getWithdrawBalance } from "@/lib/withdraw-balance";
import { isTopAffiliateEmail } from "@/lib/top-affiliate";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ADMIN_EMAIL = "kinhonetovai@gmail.com";

function detectPixType(key: string): string {
  const clean = key.replace(/[.\-/\s]/g, "");
  if (/^\d{14}$/.test(clean)) return "CNPJ";
  if (/^\d{11}$/.test(clean)) {
    if (/^[1-9][1-9]9\d{8}$/.test(clean)) return "PHONE";
    return "CPF";
  }
  if (/^(\+?55)\d{10,11}$/.test(clean)) return "PHONE";
  if (key.includes("@")) return "EMAIL";
  return "EVP";
}

const PIX_TYPE_FALLBACKS: Record<string, string[]> = {
  CPF: ["PHONE"],
  PHONE: ["CPF"],
};

type AsaasErrorPayload = {
  errors?: Array<{ code?: string; description?: string }>;
  error?: string;
};

type TransferAttemptOk = {
  ok: true;
  account: AsaasAccount;
  pixType: string;
  data: {
    id: string;
    bankAccount?: {
      ownerName?: string | null;
      bank?: { name?: string | null } | null;
      cpfCnpj?: string | null;
    } | null;
  };
};

type TransferAttemptErr = {
  ok: false;
  account: AsaasAccount;
  pixType: string;
  status: number;
  data: AsaasErrorPayload;
  message: string;
};

type TransferAttempt = TransferAttemptOk | TransferAttemptErr;

function describeAsaasError(data: AsaasErrorPayload | null | undefined): string {
  if (!data) return "Sem detalhes";
  return (
    data.errors?.[0]?.description ||
    data.error ||
    JSON.stringify(data).slice(0, 200)
  );
}

function isInsufficientBalanceError(attempt: TransferAttemptErr): boolean {
  const text = (
    attempt.message +
    " " +
    JSON.stringify(attempt.data || {})
  ).toLowerCase();
  return (
    text.includes("saldo insuficiente") ||
    text.includes("insufficient balance") ||
    text.includes("insufficient_balance")
  );
}

async function attemptTransfer(
  account: AsaasAccount,
  payload: {
    transferValue: number;
    pixKey: string;
    pixType: string;
    description: string;
    externalReference?: string;
  }
): Promise<TransferAttempt> {
  const res = await fetch(`${getAsaasBaseUrl()}/v3/transfers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: account.apiKey,
    },
    body: JSON.stringify({
      value: payload.transferValue,
      operationType: "PIX",
      pixAddressKey: payload.pixKey,
      pixAddressKeyType: payload.pixType,
      description: payload.description,
      externalReference: payload.externalReference,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as AsaasErrorPayload &
    Partial<TransferAttemptOk["data"]>;

  if (res.ok && (data as { id?: string }).id) {
    return {
      ok: true,
      account,
      pixType: payload.pixType,
      data: data as TransferAttemptOk["data"],
    };
  }

  return {
    ok: false,
    account,
    pixType: payload.pixType,
    status: res.status,
    data,
    message: describeAsaasError(data),
  };
}

async function notifyAdminWithdrawFailed(args: {
  affiliateName: string;
  affiliateEmail: string | null | undefined;
  amount: string;
  pixKey: string;
  asaasMessage: string;
  attempts: TransferAttemptErr[];
}): Promise<void> {
  const lines = args.attempts
    .map(
      (a) =>
        `<li>tipo ${a.pixType}, HTTP ${a.status}: ${a.message}</li>`
    )
    .join("");

  try {
    await resend.emails.send({
      from: "Leona Afiliados <noreply@leonaflow.com>",
      to: ADMIN_EMAIL,
      subject: `[URGENTE] Saque falhou no Asaas - ${args.affiliateName}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 560px;">
          <h2 style="color: #b91c1c;">Falha na transferência PIX</h2>
          <p style="color: #3f3f46; font-size: 15px;">
            O afiliado <strong>${args.affiliateName}</strong> tentou sacar
            <strong>${args.amount}</strong> e o Asaas recusou a operação.
          </p>
          <p style="color: #52525b; font-size: 14px;"><strong>Erro Asaas:</strong> ${args.asaasMessage}</p>
          <p style="color: #52525b; font-size: 14px;"><strong>PIX:</strong> ${args.pixKey}</p>
          ${args.affiliateEmail ? `<p style="color: #52525b; font-size: 14px;"><strong>Email:</strong> ${args.affiliateEmail}</p>` : ""}
          <p style="color: #3f3f46; font-size: 14px; margin-top: 12px;"><strong>Tentativas:</strong></p>
          <ul style="color: #52525b; font-size: 13px;">${lines}</ul>
        </div>
      `,
    });
  } catch (e) {
    console.error("[WITHDRAW] Falha ao notificar admin:", e);
  }
}

function isDuplicateAsaasError(attempt: TransferAttemptErr): boolean {
  if (attempt.status !== 409) return false;
  const text = attempt.message.toLowerCase();
  return text.includes("já solicitado") || text.includes("ja solicitado");
}

async function findExistingWithdraw(
  affiliateId: string,
  dateLabel: string
): Promise<{ asaas_transfer_id: string | null; status: string } | null> {
  const { data } = await supabaseAdmin
    .from("withdraw_requests")
    .select("asaas_transfer_id, status")
    .eq("affiliate_id", affiliateId)
    .eq("date_label", dateLabel)
    .in("status", ["processing", "paid", "pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

function parseAsaasTransferIdFromError(message: string): string | null {
  const match = message.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  return match?.[0] ?? null;
}

async function resolveDuplicateWithdraw(
  affiliateId: string,
  dateLabel: string,
  failures: TransferAttemptErr[]
): Promise<{ asaas_transfer_id: string | null; status: string } | null> {
  let existing = await findExistingWithdraw(affiliateId, dateLabel);
  if (existing) return existing;

  const transferId = failures
    .map((f) => parseAsaasTransferIdFromError(f.message))
    .find(Boolean);
  if (!transferId) return null;

  const { data } = await supabaseAdmin
    .from("withdraw_requests")
    .select("asaas_transfer_id, status")
    .eq("asaas_transfer_id", transferId)
    .maybeSingle();
  return data;
}

/** Erro mais relevante pro afiliado: prioriza a 1ª falha (tipo PIX detectado). */
function pickAffiliateFacingError(failures: TransferAttemptErr[]): string {
  if (failures.length === 0) {
    return "Erro desconhecido ao criar transferência no Asaas";
  }
  const nonBalance = failures.find((f) => !isInsufficientBalanceError(f));
  return (nonBalance ?? failures[0]).message;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Top afiliados são pagos manualmente pela equipe (Wise/Pix), fora deste
    // fluxo. Bloqueamos o saque automático pra evitar pagamento em duplicidade.
    if (isTopAffiliateEmail(user.email)) {
      return NextResponse.json(
        {
          error:
            "Você é um Parceiro Top e seus pagamentos são feitos diretamente pela equipe. Não é necessário solicitar saque por aqui.",
        },
        { status: 403 }
      );
    }

    const { affiliateName, amount, amountCents, dateLabel, pixKey, affiliateId } =
      await request.json();

    if (!affiliateName || !amount || !pixKey || !amountCents) {
      return NextResponse.json(
        { error: "Dados incompletos. Verifique nome, valor e chave PIX." },
        { status: 400 }
      );
    }

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

    // Valida saldo TOTAL do afiliado (líquido liberado - sacado anterior). Cobre
    // dois cenários: (1) refunds em buckets já sacados — bug histórico antes da
    // migration 022; (2) saques antigos cujo amount_text foi gravado em valor
    // bruto antes da migration 012 recalcular as comissões pra líquido (~7% a
    // menos). Em ambos os casos a compensação é automática nos saques futuros.
    if (affiliateId) {
      const balance = await getWithdrawBalance(supabaseAdmin, affiliateId);

      if (amountCents > balance.saldoDisponivelCents) {
        console.warn(
          `[WITHDRAW] Saldo insuficiente: afiliado=${affiliateId} pediu=${amountCents} ` +
            `disponivel=${balance.saldoDisponivelCents} (liquido=${balance.liquidoLiberadoCents} ` +
            `- sacado=${balance.sacadoCents}, ajusteHistorico=${balance.ajustePendenteCents})`
        );

        const linhas: string[] = [
          `Você quis sacar ${formatBrl(amountCents)}, mas seu saldo real disponível é ${formatBrl(Math.max(balance.saldoDisponivelCents, 0))}.`,
          "",
          `• Total líquido liberado até hoje: ${formatBrl(balance.liquidoLiberadoCents)}`,
          `• Total já sacado em períodos anteriores: ${formatBrl(balance.sacadoCents)}`,
        ];
        if (balance.ajustePendenteCents > 0) {
          linhas.push(
            `• Ajuste de saques antigos sendo compensado: ${formatBrl(balance.ajustePendenteCents)}`,
            "",
            "O valor do período liberado na tela pode ser maior que seu saldo real. Isso pode ocorrer por ajustes de comissão (reatribuição a outro parceiro), estornos ou diferenças de saques anteriores. Se quiser entender o cálculo em detalhe, fala com o suporte."
          );
        } else {
          linhas.push(
            "",
            "O valor do período liberado na tela pode ser maior que seu saldo real. Isso pode ocorrer por ajustes de comissão (reatribuição a outro parceiro), estornos ou diferenças de saques anteriores. Se o valor não bater com o que você esperava, fala com o suporte que a gente revisa."
          );
        }

        return NextResponse.json(
          {
            error: linhas.join("\n"),
            balance: {
              liquidoLiberadoCents: balance.liquidoLiberadoCents,
              sacadoCents: balance.sacadoCents,
              saldoDisponivelCents: balance.saldoDisponivelCents,
              ajustePendenteCents: balance.ajustePendenteCents,
            },
          },
          { status: 400 }
        );
      }
    }

    const accounts = getWithdrawAsaasAccounts();
    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "Conta Asaas de pagamentos não configurada no servidor" },
        { status: 500 }
      );
    }

    const detectedType = detectPixType(pixKey);
    const transferValue = amountCents / 100;
    const typesToTry = [detectedType, ...(PIX_TYPE_FALLBACKS[detectedType] || [])];
    const description = `Comissao ${affiliateName} - ${dateLabel || "saque"}`;
    const externalReference = affiliateId
      ? `withdraw-${affiliateId}-${dateLabel}`
      : undefined;

    let success: TransferAttemptOk | null = null;
    const failures: TransferAttemptErr[] = [];
    const account = accounts[0];

    for (const pixType of typesToTry) {
      console.log(
        `[WITHDRAW] Tentando ${account.label} (${account.id}) tipo ${pixType} chave ${pixKey}`
      );
      const attempt = await attemptTransfer(account, {
        transferValue,
        pixKey,
        pixType,
        description,
        externalReference,
      });

      if (attempt.ok) {
        console.log(
          `[WITHDRAW] Sucesso em ${account.label} tipo ${pixType} transferId=${attempt.data.id}`
        );
        success = attempt;
        break;
      }

      console.warn(
        `[WITHDRAW] Falha em ${account.label} tipo ${pixType}:`,
        JSON.stringify(attempt.data)
      );
      failures.push(attempt);

      if (isInsufficientBalanceError(attempt)) {
        break;
      }
    }

    if (!success) {
      const duplicateAsaas = failures.some(isDuplicateAsaasError);
      if (duplicateAsaas && affiliateId && dateLabel) {
        const existing = await resolveDuplicateWithdraw(
          affiliateId,
          dateLabel,
          failures
        );
        if (existing) {
          console.log(
            `[WITHDRAW] Asaas 409 duplicado — saque já existe (${existing.status}) affiliate=${affiliateId} period=${dateLabel}`
          );
          return NextResponse.json({
            success: true,
            duplicate: true,
            asaasTransferId: existing.asaas_transfer_id,
          });
        }
      }

      const errorMsg = pickAffiliateFacingError(failures);
      const allInsufficient =
        failures.length > 0 && failures.every(isInsufficientBalanceError);
      const skipAdminEmail = duplicateAsaas;

      if (!skipAdminEmail) {
        await notifyAdminWithdrawFailed({
          affiliateName,
          affiliateEmail: user.email,
          amount,
          pixKey,
          asaasMessage: errorMsg,
          attempts: failures,
        });
      }

      console.error(
        "[WITHDRAW] Asaas error:",
        JSON.stringify(failures.map((f) => ({ tipo: f.pixType, msg: f.message })))
      );

      return NextResponse.json(
        { error: errorMsg },
        { status: allInsufficient ? 503 : 400 }
      );
    }

    const asaasTransferId = success.data.id;
    const ownerName = success.data.bankAccount?.ownerName || null;
    const bankName = success.data.bankAccount?.bank?.name || null;
    const cpfCnpj = success.data.bankAccount?.cpfCnpj || null;
    const usedAccount = success.account;

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
        asaas_account: usedAccount.id,
      });
    }

    const pixHtml = `<div style="background: #f4f4f5; border-radius: 8px; padding: 12px 16px; margin: 16px 0;">
      <p style="color: #3f3f46; font-size: 14px; margin: 0 0 4px 0; font-weight: 600;">Dados da transferência:</p>
      <p style="color: #52525b; font-size: 14px; margin: 2px 0;"><strong>Conta Asaas:</strong> ${usedAccount.label}</p>
      <p style="color: #52525b; font-size: 14px; margin: 2px 0;"><strong>PIX:</strong> ${pixKey}</p>
      ${ownerName ? `<p style="color: #52525b; font-size: 14px; margin: 2px 0;"><strong>Titular:</strong> ${ownerName}</p>` : ""}
      ${bankName ? `<p style="color: #52525b; font-size: 14px; margin: 2px 0;"><strong>Banco:</strong> ${bankName}</p>` : ""}
      <p style="color: #52525b; font-size: 14px; margin: 2px 0;"><strong>Asaas ID:</strong> ${asaasTransferId}</p>
      <p style="color: #52525b; font-size: 14px; margin: 2px 0;"><strong>Status:</strong> Aguardando autorização no app</p>
    </div>`;

    try {
      await resend.emails.send({
        from: "Leona Afiliados <noreply@leonaflow.com>",
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
              ⚠ Autorize esta transferência no app Asaas (${usedAccount.label}).
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
      asaasAccount: usedAccount.id,
    });
  } catch (error) {
    console.error("[WITHDRAW] Error:", error);
    return NextResponse.json(
      { error: "Erro ao processar solicitação de saque" },
      { status: 500 }
    );
  }
}
