import { SupabaseClient } from "@supabase/supabase-js";

export interface WithdrawBalance {
  liquidoLiberadoCents: number;
  sacadoCents: number;
  saldoDisponivelCents: number;
  ajustePendenteCents: number;
  compensacaoCents: number;
}

const PAGE = 1000;

function parseBrlToCents(t: string | null): number {
  if (!t) return 0;
  const cleaned = t.replace(/[^0-9,]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// Calcula o saldo real do afiliado a partir das transactions já liberadas
// (commission líquida com taxa do gateway aplicada via migration 012) menos os
// withdraw_requests pagos/em processamento.
//
// IMPORTANTE: o `amount_text` dos withdraw_requests anteriores a ~12/03/2026
// foi gravado em valor BRUTO (antes do recálculo de 0.93 da migration 012).
// Pra esses saques antigos, `sacadoCents` fica ~7% maior que o valor que de
// fato foi pago — o que reduz `saldoDisponivelCents`. Isso é INTENCIONAL: o
// afiliado recebeu a mais na época e a diferença é compensada automaticamente
// nos saques futuros. `ajustePendenteCents` expõe o quanto está sendo
// compensado pra que a UI possa explicar isso ao parceiro.
export async function getWithdrawBalance(
  supabaseAdmin: SupabaseClient,
  affiliateId: string
): Promise<WithdrawBalance> {
  let txOffset = 0;
  let liquidoLiberadoCents = 0;
  const bucketLiquidoByDateLabel = new Map<string, number>();
  while (true) {
    const { data: txPage, error: txErr } = await supabaseAdmin
      .from("transactions")
      .select("commission_amount_cents, available_at")
      .eq("affiliate_id", affiliateId)
      .not("available_at", "is", null)
      .lte("available_at", new Date().toISOString())
      .order("available_at", { ascending: true })
      .range(txOffset, txOffset + PAGE - 1);
    if (txErr) break;
    const rows = (txPage || []) as Array<{
      commission_amount_cents: number | null;
      available_at: string | null;
    }>;
    for (const r of rows) {
      const cents = r.commission_amount_cents || 0;
      liquidoLiberadoCents += cents;
      if (r.available_at) {
        const label = new Date(r.available_at).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "America/Sao_Paulo",
        });
        bucketLiquidoByDateLabel.set(
          label,
          (bucketLiquidoByDateLabel.get(label) || 0) + cents
        );
      }
    }
    if (rows.length < PAGE) break;
    txOffset += PAGE;
  }

  const [{ data: prevWithdraws }, { data: adjustmentsRows }] = await Promise.all([
    supabaseAdmin
      .from("withdraw_requests")
      .select("amount_text, status, date_label")
      .eq("affiliate_id", affiliateId)
      .in("status", ["paid", "processing"]),
    supabaseAdmin
      .from("withdraw_balance_adjustments")
      .select("amount_cents")
      .eq("affiliate_id", affiliateId),
  ]);

  const compensacaoCents = (adjustmentsRows || []).reduce(
    (sum, a: { amount_cents: number | null }) => sum + (a.amount_cents || 0),
    0
  );
  liquidoLiberadoCents += compensacaoCents;

  let sacadoCents = 0;
  let ajustePendenteCents = 0;
  (prevWithdraws || []).forEach(
    (w: {
      amount_text: string | null;
      status: string;
      date_label: string | null;
    }) => {
      const sacadoBruto = parseBrlToCents(w.amount_text);
      sacadoCents += sacadoBruto;
      // Se o bucket atual de transactions desse `date_label` é menor que o
      // sacado, a diferença é o "ajuste histórico" (migration 012 reduziu as
      // transactions em 7%, mas o amount_text foi salvo em bruto).
      if (w.date_label) {
        const bucketLiquido = bucketLiquidoByDateLabel.get(w.date_label) ?? 0;
        const diff = sacadoBruto - bucketLiquido;
        if (diff > 0) ajustePendenteCents += diff;
      }
    }
  );

  // ajustePendenteCents = quanto ainda falta compensar via
  // withdraw_balance_adjustments. Em afiliados já compensados pelo script
  // 024, esse valor cai pra 0 (compensacaoCents cobre o legado).
  const ajustePendenteRestante = Math.max(ajustePendenteCents - compensacaoCents, 0);

  return {
    liquidoLiberadoCents,
    sacadoCents,
    saldoDisponivelCents: liquidoLiberadoCents - sacadoCents,
    ajustePendenteCents: ajustePendenteRestante,
    compensacaoCents,
  };
}

export function formatBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
