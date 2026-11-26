function commissionPercent(tier: number): number {
  if (tier === 3) return 40;
  if (tier === 2) return 35;
  return 30;
}

/**
 * Mensalidade cheia do plano Starter.
 * 1 instância R$ 127, da 2ª à 3ª R$ 99, da 4ª em diante R$ 79.
 * Pró-rata de upgrade não entra aqui.
 */
export function monthlyPlanCents(instances: number): number {
  const qty = Number(instances);
  if (!Number.isInteger(qty) || qty < 1) return 0;
  const unit = qty === 1 ? 12700 : qty <= 3 ? 9900 : 7900;
  return unit * qty;
}

export function planCommissionCents(monthlyCents: number, tier: number): number {
  if (!(monthlyCents > 0)) return 0;
  return Math.round((monthlyCents * 0.93 * commissionPercent(tier)) / 100);
}

export type PlanSubscription = {
  status?: string | null;
  plan_instances?: number | null;
  plan_monthly_cents?: number | null;
};

export type PlanPayment = {
  subscription_id: string | null;
  commission_amount_cents?: number | null;
};

/**
 * MRR de comissão das assinaturas ativas.
 * Com o plano gravado, usa a mensalidade cheia. Sem plano, cai na última
 * comissão para não zerar quem ainda não foi sincronizado.
 */
export function activePlanMrrCents<T extends PlanSubscription & { id: string }>(
  subscriptions: T[],
  lastCommissionCents: (subscriptionId: string) => number,
  tier: number
): number {
  let total = 0;
  for (const subscription of subscriptions) {
    if (subscription.status !== "active") continue;
    if (subscription.plan_instances == null) {
      total += lastCommissionCents(subscription.id);
      continue;
    }
    total += planCommissionCents(subscription.plan_monthly_cents || 0, tier);
  }
  return total;
}
