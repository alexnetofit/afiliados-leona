const ptaxByDay = new Map<string, number | null>();

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

/**
 * PTAX venda do Banco Central no dia. Fim de semana e feriado caem no
 * dia útil anterior (até 7 dias). Sem PTAX, usa Frankfurter do mesmo dia.
 */
export async function usdToBrlPtax(day: string): Promise<number | null> {
  if (!isValidDay(day)) return null;
  if (ptaxByDay.has(day)) return ptaxByDay.get(day) ?? null;

  for (let back = 0; back < 7; back++) {
    const cursor = shiftDays(day, -back);
    const [year, month, date] = cursor.split("-");
    const url =
      "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/" +
      `CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${month}-${date}-${year}'` +
      "&$top=1&$orderby=dataHoraCotacao desc&$format=json";
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const body = await response.json();
      const rate = Number(body?.value?.[0]?.cotacaoVenda);
      if (rate > 0) {
        ptaxByDay.set(day, rate);
        return rate;
      }
    } catch {
      // tenta o dia útil anterior
    }
  }

  try {
    const response = await fetch(
      `https://api.frankfurter.app/${day}?from=USD&to=BRL`,
      { cache: "no-store" }
    );
    if (response.ok) {
      const body = await response.json();
      const rate = Number(body?.rates?.BRL);
      if (rate > 0) {
        ptaxByDay.set(day, rate);
        return rate;
      }
    }
  } catch {
    // sem câmbio: não inventa cotação
  }

  ptaxByDay.set(day, null);
  return null;
}
