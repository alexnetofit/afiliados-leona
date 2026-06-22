const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
const WISE_PROFILE_ID = process.env.WISE_PROFILE_ID;
const WISE_BALANCE_ID = process.env.WISE_BALANCE_ID;

export const WISE_CARD_LAST_FOUR = "1421";

export function wiseConfigured(): boolean {
  return !!(WISE_API_TOKEN && WISE_PROFILE_ID && WISE_BALANCE_ID);
}

export interface WiseTransaction {
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: string;
  runningBalance: number;
}

export async function fetchWiseCardSpending(
  startDate: string,
  endDate: string
): Promise<{ transactions: WiseTransaction[]; totalSpent: number } | null> {
  if (!WISE_API_TOKEN || !WISE_PROFILE_ID || !WISE_BALANCE_ID) {
    return null;
  }

  try {
    const url = new URL(
      `https://api.wise.com/v1/profiles/${WISE_PROFILE_ID}/balance-statements/${WISE_BALANCE_ID}/statement`
    );
    url.searchParams.set("intervalStart", `${startDate}T00:00:00.000Z`);
    url.searchParams.set("intervalEnd", `${endDate}T23:59:59.999Z`);
    url.searchParams.set("type", "COMPACT");
    url.searchParams.set("currency", "USD");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${WISE_API_TOKEN}` },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[Wise] Error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const txs: WiseTransaction[] = [];
    let totalSpent = 0;

    for (const t of data.transactions || []) {
      if (t.type !== "DEBIT") continue;
      if (t.details?.type !== "CARD") continue;
      if (t.details?.cardLastFourDigits !== WISE_CARD_LAST_FOUR) continue;

      const amt = t.amount?.value || 0;
      const cur = t.amount?.currency || "USD";

      txs.push({
        date: t.date || "",
        description:
          t.details?.description || t.details?.merchant?.name || "Transação",
        amount: amt,
        currency: cur,
        type: t.type,
        runningBalance: t.runningBalance?.value || 0,
      });

      totalSpent += Math.abs(amt);
    }

    return { transactions: txs, totalSpent };
  } catch (err) {
    console.error("[Wise] Fetch error:", err);
    return null;
  }
}

// Cotação USD->BRL (mesma fonte usada no painel admin). Retorna 0 em falha.
export async function fetchUsdBrlRate(): Promise<number> {
  try {
    const res = await fetch(
      "https://economia.awesomeapi.com.br/json/last/USD-BRL",
      { cache: "no-store" }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    // Mesmo campo usado no painel admin (ask) pra os valores baterem.
    const ask = parseFloat(data?.USDBRL?.ask);
    return Number.isFinite(ask) ? ask : 0;
  } catch {
    return 0;
  }
}
