export function getCommissionPercent(tier: number): number {
  switch (tier) {
    case 3:
      return 40;
    case 2:
      return 35;
    default:
      return 30;
  }
}

function getDateInBRT(date: Date): { day: number; month: number; year: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
  return {
    day: parseInt(parts.find((p) => p.type === "day")?.value || "1"),
    month: parseInt(parts.find((p) => p.type === "month")?.value || "1") - 1,
    year: parseInt(parts.find((p) => p.type === "year")?.value || "2026"),
  };
}

/** Data de liberação da comissão conforme calendário BRT (igual ao webhook Stripe). */
export function calculateAvailableAtBRT(paidAt: Date): Date {
  const brt = getDateInBRT(paidAt);
  const nextMonth = new Date(Date.UTC(brt.year, brt.month + 1, 1));

  if (brt.day <= 15) {
    return new Date(
      Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), 5, 12, 0, 0)
    );
  }
  return new Date(
    Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth(), 20, 12, 0, 0)
  );
}
