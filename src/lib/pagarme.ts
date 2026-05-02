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
  metadata?: Record<string, string | number | boolean | null> | null;
  order?: {
    id?: string | null;
    metadata?: Record<string, string | number | boolean | null> | null;
  } | null;
}

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
  const size = opts.pageSize ?? 100;
  const maxPages = opts.maxPages ?? 50;

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

    const total = json.paging?.total ?? all.length;
    if (page * size >= total) break;
    page++;
  }

  return all;
}

/**
 * Soma o valor pago das cobranças cujo `paid_at` cai em
 * [`paidSince`, `paidUntil`] e que tenham `metadata.product_id` igual ao
 * informado. Status considerado: "paid".
 *
 * Pagar.me retorna `paid_amount` em centavos (BRL). Fallback para `amount`
 * se `paid_amount` estiver vazio.
 */
export async function sumPagarmePaidAmountByProduct(opts: {
  apiKey: string;
  productId: string;
  paidSince: Date;
  paidUntil: Date;
  /** Buffer pra trás na consulta `created_since` (boletos podem ser criados muito antes do pagamento). */
  createdSinceBufferDays?: number;
}): Promise<{ amountCents: number; matched: number; scanned: number }> {
  if (!opts.apiKey) return { amountCents: 0, matched: 0, scanned: 0 };

  const bufferMs = (opts.createdSinceBufferDays ?? 30) * 24 * 60 * 60 * 1000;
  const createdSince = new Date(opts.paidSince.getTime() - bufferMs);
  // Cobranças criadas DEPOIS de paidUntil não podem ter sido pagas dentro da janela.
  const createdUntil = new Date(opts.paidUntil.getTime() + 24 * 60 * 60 * 1000);

  const charges = await fetchPagarmeCharges({
    apiKey: opts.apiKey,
    status: "paid",
    createdSince,
    createdUntil,
  });

  const paidSinceMs = opts.paidSince.getTime();
  const paidUntilMs = opts.paidUntil.getTime();

  let amountCents = 0;
  let matched = 0;
  let scanned = 0;

  for (const ch of charges) {
    scanned++;
    if (ch.status !== "paid") continue;
    if (!ch.paid_at) continue;

    const meta = ch.metadata ?? ch.order?.metadata ?? {};
    if (String(meta.product_id ?? "") !== opts.productId) continue;

    const paidAtMs = new Date(ch.paid_at).getTime();
    if (Number.isNaN(paidAtMs)) continue;
    if (paidAtMs < paidSinceMs || paidAtMs > paidUntilMs) continue;

    const value =
      typeof ch.paid_amount === "number" && ch.paid_amount > 0
        ? ch.paid_amount
        : typeof ch.amount === "number"
          ? ch.amount
          : 0;
    amountCents += value;
    matched++;
  }

  return { amountCents, matched, scanned };
}
