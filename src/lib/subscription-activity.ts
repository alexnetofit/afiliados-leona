/**
 * Status exibido no painel de parceiros.
 *
 * A maior parte da base é cobrada pela Leona com cartão tokenizado na
 * Pagar.me, sem assinatura "active" na Paddle ou na Guru. O status do
 * gateway fica vazio ou cancelado mesmo com o cliente em dia.
 *
 * A referência passa a ser o último pagamento que não foi estornado:
 *   até 31 dias  → ativa
 *   até 35 dias  → vencida
 *   depois disso → cancelada
 */

export const SUBSCRIPTION_ACTIVE_DAYS = 31;
export const SUBSCRIPTION_CANCELED_AFTER_DAYS = 35;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ActivityStatus = "trialing" | "active" | "past_due" | "canceled";

export type ActivityPayment = {
  subscription_id: string | null;
  type: string;
  paid_at: string | null;
  guru_transaction_id?: string | null;
  stripe_invoice_id?: string | null;
};

export type ActivitySubscription = {
  id: string;
  status?: string | null;
  is_trial?: boolean | null;
  trial_end?: string | null;
};

function reversedPaymentKeys(payments: ActivityPayment[]): Set<string> {
  const keys = new Set<string>();
  for (const payment of payments) {
    if (payment.type !== "refund" && payment.type !== "dispute") continue;
    const invoiceId = payment.stripe_invoice_id || "";
    if (invoiceId.startsWith("guru_refund:") || invoiceId.startsWith("guru_dispute:")) {
      const sourceId = invoiceId.slice(invoiceId.indexOf(":") + 1);
      if (sourceId) keys.add(sourceId);
      continue;
    }
    if (invoiceId.endsWith("_refund")) {
      keys.add(invoiceId.slice(0, -"_refund".length));
    } else if (invoiceId.endsWith("_dispute")) {
      keys.add(invoiceId.slice(0, -"_dispute".length));
    }
  }
  return keys;
}

function paymentWasReversed(payment: ActivityPayment, reversed: Set<string>): boolean {
  if (payment.guru_transaction_id && reversed.has(payment.guru_transaction_id)) return true;
  if (payment.stripe_invoice_id && reversed.has(payment.stripe_invoice_id)) return true;
  return false;
}

export function lastKeptPayment<T extends ActivityPayment>(
  subscriptionId: string,
  payments: T[]
): T | null {
  const reversed = reversedPaymentKeys(payments);
  let best: T | null = null;
  let bestAt = -1;
  for (const payment of payments) {
    if (payment.subscription_id !== subscriptionId) continue;
    if (payment.type !== "commission") continue;
    if (!payment.paid_at) continue;
    if (paymentWasReversed(payment, reversed)) continue;
    const at = new Date(payment.paid_at).getTime();
    if (!Number.isFinite(at)) continue;
    if (!best || at > bestAt) {
      best = payment;
      bestAt = at;
    }
  }
  return best;
}

export function lastKeptPaymentAt(
  subscriptionId: string,
  payments: ActivityPayment[]
): number | null {
  const payment = lastKeptPayment(subscriptionId, payments);
  if (!payment?.paid_at) return null;
  const at = new Date(payment.paid_at).getTime();
  return Number.isFinite(at) ? at : null;
}

export function activityStatus(
  subscription: ActivitySubscription,
  payments: ActivityPayment[],
  now = Date.now()
): ActivityStatus {
  const paidAt = lastKeptPaymentAt(subscription.id, payments);
  if (paidAt != null) {
    const age = now - paidAt;
    if (age <= SUBSCRIPTION_ACTIVE_DAYS * DAY_MS) return "active";
    if (age <= SUBSCRIPTION_CANCELED_AFTER_DAYS * DAY_MS) return "past_due";
    return "canceled";
  }

  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end).getTime() : NaN;
  const inTrial =
    (subscription.is_trial || subscription.status === "trialing") &&
    Number.isFinite(trialEnd) &&
    trialEnd > now;
  return inTrial ? "trialing" : "canceled";
}

export async function fetchAllPages<T>(
  makeQuery: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let page = 0; page < 200; page++) {
    const from = page * pageSize;
    const { data, error } = await makeQuery(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

export function activityStatusForSubscriptions<T extends ActivitySubscription>(
  subscriptions: T[],
  payments: ActivityPayment[],
  now = Date.now()
): Map<string, ActivityStatus> {
  const bySubscription = new Map<string, ActivityPayment[]>();
  for (const payment of payments) {
    if (!payment.subscription_id) continue;
    const bucket = bySubscription.get(payment.subscription_id);
    if (bucket) bucket.push(payment);
    else bySubscription.set(payment.subscription_id, [payment]);
  }

  const statuses = new Map<string, ActivityStatus>();
  for (const subscription of subscriptions) {
    statuses.set(
      subscription.id,
      activityStatus(subscription, bySubscription.get(subscription.id) || [], now)
    );
  }
  return statuses;
}
