import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import Stripe from "stripe";
import { sumPagarmePaidAmountByProduct } from "@/lib/pagarme";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// v2 (lista de payouts/saques pro fechamento financeiro)
const ABACATEPAY_API_KEY_V2 = process.env.ABACATEPAY_API_KEY_V2 || process.env.ABACATEPAY_API_KEY;
const FIRST_PERIOD = "2026-01";

// PagarMe: só cobranças desse produto contam pro fechamento.
const PAGARME_API_KEY = process.env.PAGARME_API_KEY || "";
const PAGARME_PRODUCT_ID = "a1869b83-b28d-4257-a986-1df94558a152";

// --------------- helpers ---------------

interface AbacateWithdraw {
  id: string;
  amount: number;
  status: string;
  devMode: boolean;
  createdAt: string;
}

interface AbacateListResponse {
  success?: boolean;
  data?: AbacateWithdraw[];
  error?: string | null;
  pagination?: { hasMore?: boolean; next?: string | null };
}

let abacateCache: AbacateWithdraw[] | null = null;
let abacateCacheTs = 0;

/**
 * Lista todos os saques (payouts) na API v2 da AbacatePay, paginando até esgotar.
 * Endpoint: GET /v2/payouts/list (requer permissão WITHDRAW:READ).
 *
 * Observação: na prática a API não retorna o objeto `pagination` na resposta;
 * paginamos manualmente passando o `id` do último item em `after` enquanto
 * recebermos páginas cheias (== limit).
 */
async function fetchAbacateWithdraws(): Promise<AbacateWithdraw[]> {
  if (!ABACATEPAY_API_KEY_V2) return [];
  if (abacateCache && Date.now() - abacateCacheTs < 5 * 60 * 1000) return abacateCache;

  const all: AbacateWithdraw[] = [];
  let after: string | null = null;
  const MAX_PAGES = 50;
  const LIMIT = 100;

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL("https://api.abacatepay.com/v2/payouts/list");
      url.searchParams.set("limit", String(LIMIT));
      if (after) url.searchParams.set("after", after);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${ABACATEPAY_API_KEY_V2}` },
      });
      const json = (await res.json()) as AbacateListResponse;
      if (!json.success || !Array.isArray(json.data)) {
        if (page === 0) {
          console.error("[AbacatePay v2] payouts/list error:", json.error || res.status);
        }
        break;
      }
      all.push(...json.data);
      const hasMore = json.pagination?.hasMore ?? json.data.length >= LIMIT;
      if (!hasMore) break;
      const nextCursor = json.pagination?.next ?? json.data[json.data.length - 1]?.id ?? null;
      if (!nextCursor) break;
      after = nextCursor;
    }
  } catch (e) {
    console.error("AbacatePay payouts list error:", e);
  }

  abacateCache = all;
  abacateCacheTs = Date.now();
  return all;
}

async function fetchUsdBrlRate(): Promise<number> {
  try {
    const res = await fetch(
      "https://economia.awesomeapi.com.br/json/last/USD-BRL",
      { cache: "no-store" }
    );
    const json = await res.json();
    return parseFloat(json.USDBRL?.bid || "0");
  } catch {
    return 0;
  }
}

function getPeriodRange(label: string): { start: Date; end: Date } {
  const [year, month] = label.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 6, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 5, 23, 59, 59)),
  };
}

/**
 * Versão BRT-aware (UTC-3) da janela de fechamento, usada SÓ pela PagarMe.
 *
 * Os outros provedores (Stripe / AbacatePay) continuam usando `getPeriodRange`
 * em UTC midnight pra preservar o comportamento atual do painel.
 *
 * Ex.: "2026-04" ⇒ 06/04 00:00 BRT (= 06/04 03:00 UTC) → 05/05 23:59:59 BRT
 * (= 06/05 02:59:59 UTC).
 */
function getPeriodRangeBRT(label: string): { start: Date; end: Date } {
  const [year, month] = label.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 6, 3, 0, 0)),
    end: new Date(Date.UTC(year, month, 6, 2, 59, 59)),
  };
}

/**
 * Calcula o total "sacado" da PagarMe pro período (em centavos BRL).
 *
 * Conceito: o que cai NA CONTA dentro do fechamento (alinhado com Stripe
 * payouts.arrival_date e AbacatePay withdraws.createdAt).
 *
 * Regras:
 *  - status == "paid"
 *  - metadata.product_id == PAGARME_PRODUCT_ID
 *  - `paid_at + delay` deve cair dentro da janela de saque BRT.
 *    Delay depende do método: pix=D+1, cartão=D+8 (default).
 *  - Janela de saque BRT: [dia 06 00:00, dia 05 do mês seguinte 23:59:59].
 */
async function fetchPagarmeRevenueForPeriod(label: string): Promise<number> {
  if (!PAGARME_API_KEY) return 0;
  const saqueRange = getPeriodRangeBRT(label);

  try {
    const { amountCents, grossCents, matched, scanned, byMethod } =
      await sumPagarmePaidAmountByProduct({
        apiKey: PAGARME_API_KEY,
        productId: PAGARME_PRODUCT_ID,
        saqueSince: saqueRange.start,
        saqueUntil: saqueRange.end,
      });
    const breakdown = Object.entries(byMethod)
      .map(([m, b]) => `${m}:${b.count}/${(b.grossCents / 100).toFixed(2)}→${(b.netCents / 100).toFixed(2)}`)
      .join(" ");
    console.log(
      `[PagarMe] período=${label} saque∈[${saqueRange.start.toISOString()}, ${saqueRange.end.toISOString()}] ` +
        `scanned=${scanned} matched=${matched} bruto_cents=${grossCents} liquido_cents=${amountCents} | ${breakdown}`
    );
    return amountCents;
  } catch (e) {
    console.error(`[PagarMe] erro no período ${label}:`, e);
    return 0;
  }
}

function getPeriodLabel(date: Date): string {
  const day = date.getUTCDate();
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth();
  if (day <= 5) {
    month -= 1;
    if (month < 0) { month = 11; year -= 1; }
  }
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function formatPeriodLabel(label: string): string {
  const [year, month] = label.split("-").map(Number);
  const names = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
  ];
  return `${names[month - 1]} ${year}`;
}

function generatePeriods(): string[] {
  const current = getPeriodLabel(new Date());
  const [curY, curM] = current.split("-").map(Number);
  const [firstY, firstM] = FIRST_PERIOD.split("-").map(Number);
  const periods: string[] = [];
  let y = curY, m = curM;
  while (y > firstY || (y === firstY && m >= firstM)) {
    periods.push(`${y}-${String(m).padStart(2, "0")}`);
    m--;
    if (m <= 0) { m = 12; y--; }
  }
  return periods;
}

async function verifyAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabaseAdmin
    .from("profiles").select("role").eq("id", user.id).single();
  return p?.role === "admin";
}

// --------------- types ---------------

interface PeriodData {
  label: string;
  startDate: string;
  endDate: string;
  stripeRevenueBrlCents: number;
  stripeRevenueUsdCents: number;
  abacateRevenueCents: number;
  pagarmeRevenueCents: number;
  usdBrlRate: number;
  affiliateCostCents: number;
  manualCosts: Array<{ id: string; category: string; description: string | null; amount_cents: number }>;
  manualCostsTotalCents: number;
  revenueCached: boolean;
}

// --------------- route ---------------

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const revenueParam = request.nextUrl.searchParams.get("revenue");

  // === Mode 1: Fetch live revenue for a specific period, save to DB ===
  if (revenueParam) {
    const { start, end } = getPeriodRange(revenueParam);
    const startTs = Math.floor(start.getTime() / 1000);
    const endTs = Math.floor(end.getTime() / 1000);
    const startMs = start.getTime();
    const endMs = end.getTime();

    // Shift payout query by +3h to align with BRT (UTC-3) boundaries.
    // Stripe stores arrival_date as UTC midnight; this ensures payouts
    // arriving at e.g. Apr 6 00:00 UTC (= Apr 5 21:00 BRT) fall in March.
    const BRT_OFFSET = 3 * 3600;
    const payoutStartTs = startTs + BRT_OFFSET;
    const payoutEndTs = endTs + BRT_OFFSET;

    const [stripeUsdCents, abacateList, usdBrlRate, pagarmeCentsLive] = await Promise.all([
      (async () => {
        let total = 0;
        try {
          for await (const payout of stripe.payouts.list({
            arrival_date: { gte: payoutStartTs, lte: payoutEndTs },
            status: "paid",
            limit: 100,
          })) {
            total += payout.amount;
          }
        } catch (e) {
          console.error(`Stripe payouts error (${revenueParam}):`, e);
        }
        return total;
      })(),
      fetchAbacateWithdraws(),
      fetchUsdBrlRate(),
      fetchPagarmeRevenueForPeriod(revenueParam),
    ]);

    let abacateCents = 0;
    console.log(`[AbacatePay] Total saques retornados: ${abacateList.length}`);
    if (abacateList.length > 0) {
      console.log(`[AbacatePay] Exemplo:`, JSON.stringify(abacateList[0]));
      console.log(`[AbacatePay] Statuses:`, [...new Set(abacateList.map(w => w.status))]);
    }
    for (const w of abacateList) {
      if (w.devMode) continue;
      const t = new Date(w.createdAt).getTime();
      if (t >= startMs && t <= endMs) {
        console.log(`[AbacatePay] Saque no período: status=${w.status} amount=${w.amount} date=${w.createdAt}`);
        if (w.status === "COMPLETE" || w.status === "PAID") {
          abacateCents += w.amount || 0;
        }
      }
    }

    const stripeBrlCents = Math.round(stripeUsdCents * usdBrlRate);

    // Se AbacatePay ou PagarMe retornaram 0 (ex.: API key fora do ar / sem permissão),
    // preserva o valor que já estava cacheado no banco em vez de zerar.
    let pagarmeCents = pagarmeCentsLive;
    if (abacateCents === 0 || pagarmeCents === 0) {
      const { data: existing } = await supabaseAdmin
        .from("period_revenue")
        .select("abacate_revenue_cents, pagarme_revenue_cents")
        .eq("period_label", revenueParam)
        .single();
      if (abacateCents === 0 && existing?.abacate_revenue_cents) {
        abacateCents = existing.abacate_revenue_cents;
      }
      if (pagarmeCents === 0 && existing?.pagarme_revenue_cents) {
        pagarmeCents = existing.pagarme_revenue_cents;
      }
    }

    // Salva no banco SEMPRE (inclusive período atual). Para o período atual
    // o usuário pode clicar em "Atualizar faturamento" pra forçar refresh,
    // mas o valor mais recente fica persistido pra evitar ter que buscar
    // de novo a cada page reload.
    const { error: upsertErr } = await supabaseAdmin.from("period_revenue").upsert({
      period_label: revenueParam,
      stripe_revenue_usd_cents: stripeUsdCents,
      stripe_revenue_brl_cents: stripeBrlCents,
      abacate_revenue_cents: abacateCents,
      pagarme_revenue_cents: pagarmeCents,
      usd_brl_rate: usdBrlRate,
      cached_at: new Date().toISOString(),
    });
    if (upsertErr) console.error("Erro ao salvar period_revenue:", upsertErr.message);

    return NextResponse.json({
      period: revenueParam,
      stripeRevenueUsdCents: stripeUsdCents,
      stripeRevenueBrlCents: stripeBrlCents,
      abacateRevenueCents: abacateCents,
      pagarmeRevenueCents: pagarmeCents,
      usdBrlRate,
    });
  }

  // === Mode 2: Load all periods from DB (fast) ===
  const currentPeriod = getPeriodLabel(new Date());
  const periods = generatePeriods();

  if (periods.length === 0) {
    return NextResponse.json({ currentPeriod, periods: [], formatLabel: {} });
  }

  const allRanges = periods.map((label) => ({ label, ...getPeriodRange(label) }));
  const globalStart = allRanges[allRanges.length - 1].start;
  const globalEnd = allRanges[0].end;

  type CachedRev = { period_label: string; stripe_revenue_usd_cents: number; stripe_revenue_brl_cents: number; abacate_revenue_cents: number; pagarme_revenue_cents: number; usd_brl_rate: number };

  // PostgREST tem limite default de 1000 linhas por request. Como esse fetch
  // varre TODAS as transações desde Jan/2026, a partir de ~1k transações
  // o resultado fica truncado e o "Custo afiliados" do mês mais recente
  // aparece subestimado. Paginamos manualmente em batches de 1000.
  const fetchAllTransactions = async () => {
    const PAGE = 1000;
    const out: Array<{ commission_amount_cents: number; available_at: string }> = [];
    let from = 0;
    for (let page = 0; page < 200; page++) {
      const { data, error } = await supabaseAdmin
        .from("transactions")
        .select("commission_amount_cents, available_at")
        .not("available_at", "is", null)
        .gte("available_at", globalStart.toISOString())
        .lte("available_at", globalEnd.toISOString())
        .order("available_at", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) {
        console.error("[financeiro] erro paginando transactions:", error.message);
        break;
      }
      const rows = data || [];
      out.push(...rows);
      if (rows.length < PAGE) break;
      from += PAGE;
    }
    return out;
  };

  const [allTxs, allCosts, cachedRevRows] = await Promise.all([
    fetchAllTransactions(),
    Promise.resolve(
      supabaseAdmin
        .from("admin_costs")
        .select("id, category, description, amount_cents, period_label")
        .in("period_label", periods)
        .order("created_at", { ascending: true })
    ).then((r) => r.data || []).catch(() => [] as Array<{ id: string; category: string; description: string | null; amount_cents: number; period_label: string }>),
    Promise.resolve(
      supabaseAdmin
        .from("period_revenue")
        .select("period_label, stripe_revenue_usd_cents, stripe_revenue_brl_cents, abacate_revenue_cents, pagarme_revenue_cents, usd_brl_rate")
        .in("period_label", periods)
    ).then((r) => (r.data || []) as CachedRev[])
      .catch(() => [] as CachedRev[]),
  ]);

  const revMap = new Map(cachedRevRows.map((r) => [r.period_label, r]));

  const results: PeriodData[] = allRanges.map(({ label, start, end }) => {
    const startMs = start.getTime();
    const endMs = end.getTime();

    const affiliateCostCents = (allTxs as Array<{ commission_amount_cents: number; available_at: string }>)
      .filter((tx) => {
        const t = new Date(tx.available_at).getTime();
        return t >= startMs && t <= endMs;
      })
      .reduce((sum, tx) => sum + tx.commission_amount_cents, 0);

    const manualCosts = (allCosts as Array<{ id: string; category: string; description: string | null; amount_cents: number; period_label: string }>)
      .filter((c) => c.period_label === label)
      .map(({ id, category, description, amount_cents }) => ({ id, category, description, amount_cents }));
    const manualCostsTotalCents = manualCosts.reduce((sum, c) => sum + c.amount_cents, 0);

    const cached = revMap.get(label);

    return {
      label,
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      stripeRevenueBrlCents: cached ? cached.stripe_revenue_brl_cents : 0,
      stripeRevenueUsdCents: cached ? cached.stripe_revenue_usd_cents : 0,
      abacateRevenueCents: cached ? cached.abacate_revenue_cents : 0,
      pagarmeRevenueCents: cached ? (cached.pagarme_revenue_cents ?? 0) : 0,
      usdBrlRate: cached ? Number(cached.usd_brl_rate) : 0,
      affiliateCostCents,
      manualCosts,
      manualCostsTotalCents,
      revenueCached: !!cached,
    };
  });

  return NextResponse.json({
    currentPeriod,
    periods: results,
    formatLabel: Object.fromEntries(periods.map((p) => [p, formatPeriodLabel(p)])),
  });
}

// PATCH/POST: persiste edições manuais do faturamento (AbacatePay) no DB.
// Necessário porque a API da AbacatePay nem sempre retorna os saques certos
// e o admin precisa ajustar manualmente sem perder o valor a cada reload.
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const periodLabel: string | undefined = body.period_label;
  const abacateCents: number | undefined = body.abacate_revenue_cents;

  if (!periodLabel || typeof abacateCents !== "number" || abacateCents < 0) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("period_revenue")
    .select("*")
    .eq("period_label", periodLabel)
    .single();

  const row = {
    period_label: periodLabel,
    stripe_revenue_usd_cents: existing?.stripe_revenue_usd_cents ?? 0,
    stripe_revenue_brl_cents: existing?.stripe_revenue_brl_cents ?? 0,
    abacate_revenue_cents: Math.round(abacateCents),
    pagarme_revenue_cents: existing?.pagarme_revenue_cents ?? 0,
    usd_brl_rate: existing?.usd_brl_rate ?? 0,
    cached_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin.from("period_revenue").upsert(row);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, abacateRevenueCents: row.abacate_revenue_cents });
}
