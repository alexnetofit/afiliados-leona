import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubscriptionStatus } from "@/types";

export type LeonaBillingProfile = {
  account_id: string | number | null;
  subscription_status: string | null;
  current_period_end: string | null;
  rewardful_referral: string | null;
  user?: { name?: string | null; email?: string | null } | null;
};

export type GuruSubscriptionPayload = {
  internal_id?: string | null;
  last_status?: string | null;
  last_status_at?: string | null;
  started_at?: string | null;
  canceled_at?: string | null;
  trial_started_at?: string | null;
  trial_finished_at?: string | null;
};

/**
 * Mapeia texto do GET Leona (ou last_status Guru) para o CHECK da tabela subscriptions.
 *
 * Status oficiais de assinatura Guru:
 * https://docs.digitalmanager.guru/developers/status-de-assinaturas
 *   active, canceled, expired, inactive, pastdue, started, trial
 *
 * Status do Leona podem vir como active, canceled, past_due, inactive.
 */
export function mapToSubscriptionStatus(
  status: string | null | undefined
): SubscriptionStatus | null {
  if (status == null) return null;
  const s = String(status).toLowerCase().trim().replace(/\s+/g, "_");
  const map: Record<string, SubscriptionStatus> = {
    active: "active",
    started: "active",
    trialing: "trialing",
    trial: "trialing",
    canceled: "canceled",
    cancelled: "canceled",
    expired: "canceled",
    past_due: "past_due",
    pastdue: "past_due",
    inactive: "unpaid",
    unpaid: "unpaid",
    incomplete: "incomplete",
    incomplete_expired: "incomplete_expired",
  };
  return map[s] ?? null;
}

function parseIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Cria ou atualiza linha de assinatura só para clientes Guru/Leona (sem IDs Stripe).
 * Status prioriza `profile.subscription_status` (Leona); fallback em `guruSubscription.last_status`.
 */
export async function upsertSubscriptionFromLeonaAndGuru(
  supabase: SupabaseClient,
  input: {
    affiliateId: string;
    profile: LeonaBillingProfile;
    guruSubscription?: GuruSubscriptionPayload | null;
    customerNameFromGuru?: string | null;
    amountCentsFromGuru?: number | null;
  }
): Promise<string | null> {
  const leonaKey =
    input.profile.account_id != null && String(input.profile.account_id).trim() !== ""
      ? String(input.profile.account_id)
      : null;
  const guruInternal = input.guruSubscription?.internal_id?.trim() || null;

  if (!leonaKey && !guruInternal) {
    return null;
  }

  let rowId: string | null = null;

  if (guruInternal) {
    const { data } = await supabase
      .from("subscriptions")
      .select("id, stripe_subscription_id")
      .eq("guru_subscription_internal_id", guruInternal)
      .maybeSingle();
    if (data && !data.stripe_subscription_id) {
      rowId = data.id;
    }
  }

  if (!rowId && leonaKey) {
    const { data } = await supabase
      .from("subscriptions")
      .select("id, stripe_subscription_id")
      .eq("leona_account_id", leonaKey)
      .maybeSingle();
    if (data && !data.stripe_subscription_id) {
      rowId = data.id;
    }
  }

  const fromLeona = mapToSubscriptionStatus(input.profile.subscription_status);
  const fromGuru = mapToSubscriptionStatus(input.guruSubscription?.last_status ?? undefined);
  const statusResolved: SubscriptionStatus =
    fromLeona ?? fromGuru ?? "active";

  const periodEnd = parseIso(input.profile.current_period_end ?? undefined);

  const customerName =
    input.customerNameFromGuru?.trim() ||
    input.profile.user?.name?.trim() ||
    null;

  const trialStart = parseIso(input.guruSubscription?.trial_started_at ?? undefined);
  const trialEnd = parseIso(input.guruSubscription?.trial_finished_at ?? undefined);
  const startedAt = parseIso(input.guruSubscription?.started_at ?? undefined);
  const canceledAt = parseIso(input.guruSubscription?.canceled_at ?? undefined);

  const isTrial =
    statusResolved === "trialing" ||
    (!!trialStart && !!trialEnd && new Date(trialEnd) > new Date());

  const now = new Date().toISOString();

  const basePatch: Record<string, unknown> = {
    affiliate_id: input.affiliateId,
    status: statusResolved,
    current_period_end: periodEnd,
    customer_name: customerName,
    is_trial: isTrial,
    trial_start: trialStart,
    trial_end: trialEnd,
    started_at: startedAt,
    last_event_at: now,
    updated_at: now,
  };

  if (input.amountCentsFromGuru != null && input.amountCentsFromGuru > 0) {
    basePatch.amount_cents = input.amountCentsFromGuru;
  }

  if (guruInternal) basePatch.guru_subscription_internal_id = guruInternal;
  if (leonaKey) basePatch.leona_account_id = leonaKey;

  if (statusResolved === "canceled" && canceledAt) {
    basePatch.canceled_at = canceledAt;
  }

  if (rowId) {
    const { error } = await supabase.from("subscriptions").update(basePatch).eq("id", rowId);
    if (error) {
      console.error("[Guru sync] update subscription:", error);
      return null;
    }
    return rowId;
  }

  const insertRow = {
    ...basePatch,
    stripe_subscription_id: null,
    stripe_customer_id: null,
    price_id: null,
    has_refund: false,
    has_dispute: false,
    canceled_at: statusResolved === "canceled" ? canceledAt ?? now : null,
  };

  const { data: inserted, error: insErr } = await supabase
    .from("subscriptions")
    .insert(insertRow as never)
    .select("id")
    .single();

  if (insErr) {
    console.error("[Guru sync] insert subscription:", insErr);
    return null;
  }

  return inserted?.id ?? null;
}
