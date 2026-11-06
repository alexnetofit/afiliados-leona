const ptaxByDay = new Map<string, number>();
let ptaxQueue: Promise<void> = Promise.resolve();

export function isValidDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function shiftDays(iso: string, amount: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/** Dia civil em America/Sao_Paulo a partir de um ISO ou YYYY-MM-DD. */
export function toBrtDay(isoOrDay: string): string {
  if (isValidDay(isoOrDay)) return isoOrDay;
  const date = new Date(isoOrDay);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function clearPtaxCache(): void {
  ptaxByDay.clear();
}

/**
 * Soma BRL pelo câmbio de cada dia. Dia sem cotação devolve null:
 * tratar dólar como R$ 0 faria o saldo do afiliado fechar zerado.
 */
export function sumWiseBrl(
  debits: { amountUsd: number; day: string }[],
  rateForDay: (day: string) => number | null
): number | null {
  let total = 0;
  for (const debit of debits) {
    const rate = rateForDay(debit.day);
    if (rate == null || !(rate > 0)) return null;
    total += Math.abs(debit.amountUsd) * rate;
  }
  return total;
}

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = ptaxQueue.then(job, job);
  ptaxQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ptaxUrl(day: string): string {
  const [year, month, date] = day.split("-");
  return (
    "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/" +
    `CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${month}-${date}-${year}'` +
    "&$top=1&$orderby=dataHoraCotacao%20desc&$format=json"
  );
}

type PtaxRead = number | "missing" | "unavailable";

/** 429 e erro de rede não andam o dia pra trás: isso gravaria a cotação errada. */
async function readPtaxVenda(day: string): Promise<PtaxRead> {
  const url = ptaxUrl(day);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.status === 429 || response.status >= 500) {
        if (attempt < 2) await sleep(200 * (attempt + 1));
        continue;
      }
      if (!response.ok) return "unavailable";
      const body = await response.json();
      const rate = Number(body?.value?.[0]?.cotacaoVenda);
      if (rate > 0) return rate;
      if (Array.isArray(body?.value) && body.value.length === 0) return "missing";
      return "unavailable";
    } catch {
      if (attempt < 2) await sleep(200 * (attempt + 1));
    }
  }
  return "unavailable";
}

async function frankfurterRate(day: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.frankfurter.app/${day}?from=USD&to=BRL`,
      { cache: "no-store" }
    );
    if (!response.ok) return null;
    const body = await response.json();
    const rate = Number(body?.rates?.BRL);
    return rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

/**
 * PTAX venda do Banco Central no dia do gasto. Fim de semana e feriado
 * caem no dia útil anterior (até 7 dias). Falha de rede não entra no cache.
 */
export async function usdToBrlPtax(day: string): Promise<number | null> {
  if (!isValidDay(day)) return null;
  const cached = ptaxByDay.get(day);
  if (cached) return cached;

  return enqueue(async () => {
    const again = ptaxByDay.get(day);
    if (again) return again;

    for (let back = 0; back < 7; back++) {
      const cursor = shiftDays(day, -back);
      const result = await readPtaxVenda(cursor);
      if (typeof result === "number") {
        ptaxByDay.set(day, result);
        return result;
      }
      if (result === "unavailable") return null;
    }

    const fallback = await frankfurterRate(day);
    if (fallback) {
      ptaxByDay.set(day, fallback);
      return fallback;
    }
    return null;
  });
}
