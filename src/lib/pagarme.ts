/**
 * Cliente mínimo da API v5 da Pagar.me.
 *
 * Auth: HTTP Basic com a Secret Key como user (password vazio).
 * Doc: https://docs.pagar.me/reference/listar-cobran%C3%A7as
 */

const PAGARME_BASE_URL = "https://api.pagar.me/core/v5";

export interface PagarmeCharge {
  id: string;
  status: string;
  amount: number;
  paid_amount?: number | null;
  paid_at?: string | null;
  created_at?: string | null;
  payment_method?: string | null;
  metadata?: Record<string, string | number | boolean | null> | null;
  order?: {
    id?: string | null;
    metadata?: Record<string, string | number | boolean | null> | null;
  } | null;
}

/**
 * Taxas Guru (já incluindo imposto) que descontamos do bruto pra chegar
 * no líquido que efetivamente cai pra gente.
 *  - cartão de crédito: 4,3%
 *  - pix: 0,7%
 * Boleto/voucher caem como cartão por segurança (raros nessa operação).
 */
const GURU_FEE_BY_METHOD: Record<string, number> = {
  credit_card: 0.043,
  pix: 0.007,
  boleto: 0.043,
  voucher: 0.043,
};
const GURU_FEE_DEFAULT = 0.043;

interface PagarmeListResponse {
  data?: PagarmeCharge[];
  paging?: { total?: number; next?: string | null };
}

/**
 * Lista cobranças paginando até esgotar.
 * Filtros: `status=paid` + janela `created_since` / `created_until`.
 *
 * Pagar.me só permite filtrar por created_at (não há paid_since), então
 * o consumidor deve ampliar a janela quando for filtrar por paid_at depois.
 */
export async function fetchPagarmeCharges(opts: {
  apiKey: string;
  status?: string;
  createdSince?: Date;
  createdUntil?: Date;
  pageSize?: number;
  maxPages?: number;
}): Promise<PagarmeCharge[]> {
  const apiKey = opts.apiKey;
  if (!apiKey) return [];

  const auth = Buffer.from(`${apiKey}:`).toString("base64");
  // ATENÇÃO: a API v5 do Pagar.me ignora `size` e SEMPRE devolve até 30 itens
  // por página (testado em 2026-05). Mantemos o parâmetro por compatibilidade,
  // mas a paginação não pode confiar nesse valor – usamos `paging.total` e
  // o tamanho REAL do array retornado pra decidir quando parar.
  const size = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? 1000;

  const all: PagarmeCharge[] = [];
  let page = 1;

  while (page <= maxPages) {
    const url = new URL(`${PAGARME_BASE_URL}/charges`);
    if (opts.status) url.searchParams.set("status", opts.status);
    if (opts.createdSince) url.searchParams.set("created_since", opts.createdSince.toISOString());
    if (opts.createdUntil) url.searchParams.set("created_until", opts.createdUntil.toISOString());
    url.searchParams.set("page", String(page));
    url.searchParams.set("size", String(size));

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
      });
    } catch (e) {
      console.error("[PagarMe] fetch falhou:", e);
      break;
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(`[PagarMe] charges/list HTTP ${res.status}:`, txt.slice(0, 300));
      break;
    }

    let json: PagarmeListResponse;
    try {
      json = (await res.json()) as PagarmeListResponse;
    } catch (e) {
      console.error("[PagarMe] parse JSON:", e);
      break;
    }

    const items = json.data ?? [];
    if (items.length === 0) break;
    all.push(...items);

    const total = json.paging?.total;
    // Critério principal: se o backend disse o total, paramos quando
    // já temos tudo. Se não disser, paramos quando a página atual
    // veio menor que o size pedido (heurística clássica).
    if (typeof total === "number" && all.length >= total) break;
    if (total === undefined && items.length < size) break;
    page++;
  }

  return all;
}

/**
 * Delay padrão (em dias) pra cada método cair na conta após o pagamento.
 *  - pix: D+1
 *  - cartão de crédito: D+8
 *  - boleto/voucher/desconhecido: D+8 (default conservador)
 */
const SAQUE_DELAY_DAYS_BY_METHOD: Record<string, number> = {
  pix: 1,
  credit_card: 8,
  boleto: 8,
  voucher: 8,
};
const SAQUE_DELAY_DAYS_DEFAULT = 8;

/**
 * Soma o valor LÍQUIDO (após taxas Guru) das cobranças cujo dinheiro cai
 * pra gente dentro da janela de SAQUE [`saqueSince`, `saqueUntil`].
 *
 * O "dinheiro disponível" é calculado como `paid_at + delay`, onde o
 * `delay` depende do método de pagamento (pix D+1, cartão D+8, etc).
 *
 * Pagar.me retorna `paid_amount` em centavos (BRL). Fallback para `amount`
 * se `paid_amount` estiver vazio. Aplicamos a taxa Guru por método de
 * pagamento (cartão 4,3% / pix 0,7%) pra refletir o que cai pra gente.
 */
export async function sumPagarmePaidAmountByProduct(opts: {
  apiKey: string;
  productId: string;
  /** Início da janela de SAQUE (dinheiro caindo na conta). */
  saqueSince: Date;
  /** Fim da janela de SAQUE (dinheiro caindo na conta). */
  saqueUntil: Date;
  /** Buffer pra trás na consulta `created_since` (boletos podem ser criados muito antes do pagamento). */
  createdSinceBufferDays?: number;
}): Promise<{
  amountCents: number;
  grossCents: number;
  matched: number;
  scanned: number;
  byMethod: Record<string, { count: number; grossCents: number; netCents: number }>;
}> {
  if (!opts.apiKey) {
    return { amountCents: 0, grossCents: 0, matched: 0, scanned: 0, byMethod: {} };
  }

  // O `paid_at` mais antigo possível dentro da janela é `saqueSince - maxDelay`,
  // e o mais novo é `saqueUntil - minDelay`. Usamos esses extremos pra montar
  // o filtro de `created_since`/`created_until` na API.
  const dayMs = 24 * 60 * 60 * 1000;
  const allDelays = Object.values(SAQUE_DELAY_DAYS_BY_METHOD).concat(
    SAQUE_DELAY_DAYS_DEFAULT
  );
  const maxDelayMs = Math.max(...allDelays) * dayMs;
  const minDelayMs = Math.min(...allDelays) * dayMs;
  const earliestPaidAt = new Date(opts.saqueSince.getTime() - maxDelayMs);
  const latestPaidAt = new Date(opts.saqueUntil.getTime() - minDelayMs);

  const bufferMs = (opts.createdSinceBufferDays ?? 30) * dayMs;
  const createdSince = new Date(earliestPaidAt.getTime() - bufferMs);
  // Cobranças criadas DEPOIS do último paid possível não cabem na janela.
  const createdUntil = new Date(latestPaidAt.getTime() + dayMs);

  const charges = await fetchPagarmeCharges({
    apiKey: opts.apiKey,
    status: "paid",
    createdSince,
    createdUntil,
  });

  const saqueSinceMs = opts.saqueSince.getTime();
  const saqueUntilMs = opts.saqueUntil.getTime();

  let amountCents = 0;
  let grossCents = 0;
  let matched = 0;
  let scanned = 0;
  const byMethod: Record<string, { count: number; grossCents: number; netCents: number }> = {};

  for (const ch of charges) {
    scanned++;
    if (ch.status !== "paid") continue;
    if (!ch.paid_at) continue;

    const meta = ch.metadata ?? ch.order?.metadata ?? {};
    if (String(meta.product_id ?? "") !== opts.productId) continue;

    const paidAtMs = new Date(ch.paid_at).getTime();
    if (Number.isNaN(paidAtMs)) continue;

    const method = (ch.payment_method ?? "unknown").toLowerCase();
    const delayDays = SAQUE_DELAY_DAYS_BY_METHOD[method] ?? SAQUE_DELAY_DAYS_DEFAULT;
    const availableAtMs = paidAtMs + delayDays * dayMs;
    if (availableAtMs < saqueSinceMs || availableAtMs > saqueUntilMs) continue;

    const gross =
      typeof ch.paid_amount === "number" && ch.paid_amount > 0
        ? ch.paid_amount
        : typeof ch.amount === "number"
          ? ch.amount
          : 0;

    const fee = GURU_FEE_BY_METHOD[method] ?? GURU_FEE_DEFAULT;
    const net = Math.round(gross * (1 - fee));

    grossCents += gross;
    amountCents += net;
    matched++;

    const bucket = byMethod[method] ?? { count: 0, grossCents: 0, netCents: 0 };
    bucket.count++;
    bucket.grossCents += gross;
    bucket.netCents += net;
    byMethod[method] = bucket;
  }

  return { amountCents, grossCents, matched, scanned, byMethod };
}
