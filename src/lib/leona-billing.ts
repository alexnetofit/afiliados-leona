import type { LeonaBillingProfile } from "@/lib/guru-subscription-sync";

export type LeonaBillingResult =
  | { ok: true; profile: LeonaBillingProfile }
  | {
      ok: false;
      reason: "not_found" | "conflict" | "upstream";
      httpStatus?: number;
      conflictAccountIds?: Array<string | number>;
    };

type BillingProfileJson = {
  account_id?: string | number | null;
  subscription_status?: string | null;
  current_period_end?: string | null;
  rewardful_referral?: string | null;
  user?: { name?: string | null; email?: string | null } | null;
};

type ConflictResponseJson = {
  error?: string;
  account_ids?: Array<string | number>;
};

function normalizeProfile(json: BillingProfileJson): LeonaBillingProfile {
  const ref = json.rewardful_referral;
  return {
    account_id: json.account_id ?? null,
    subscription_status:
      json.subscription_status == null || json.subscription_status === ""
        ? null
        : String(json.subscription_status).trim(),
    current_period_end:
      json.current_period_end == null || json.current_period_end === ""
        ? null
        : String(json.current_period_end).trim(),
    rewardful_referral:
      ref == null || ref === "" ? null : String(ref).trim() || null,
    user: json.user ?? null,
  };
}

/**
 * GET /api/v1/integration/accounts/billing_profile?email=...&account_id=...
 * Documentação: perfil de cobrança Leona (Bearer compartilhado).
 *
 * Quando há múltiplas contas para o mesmo email, a API devolve 409 com
 * `account_ids: [...]`. Passe `accountId` pra desambiguar.
 */
export async function fetchBillingProfileByEmail(
  email: string,
  accountId?: string | number
): Promise<LeonaBillingResult> {
  const base = process.env.LEONA_INTEGRATION_BASE_URL?.replace(/\/$/, "");
  const token = process.env.LEONA_INTEGRATION_BILLING_BEARER_TOKEN;

  if (!base || !token) {
    console.error("[Leona billing] LEONA_INTEGRATION_BASE_URL ou LEONA_INTEGRATION_BILLING_BEARER_TOKEN ausente");
    return { ok: false, reason: "upstream", httpStatus: 503 };
  }

  const url = new URL(`${base}/api/v1/integration/accounts/billing_profile`);
  url.searchParams.set("email", email);
  if (accountId != null && String(accountId).trim() !== "") {
    url.searchParams.set("account_id", String(accountId));
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
  } catch (e) {
    console.error("[Leona billing] fetch falhou:", e);
    return { ok: false, reason: "upstream", httpStatus: 502 };
  }

  if (res.status === 200) {
    const json = (await res.json()) as BillingProfileJson;
    return { ok: true, profile: normalizeProfile(json) };
  }

  if (res.status === 404) {
    return { ok: false, reason: "not_found" };
  }

  if (res.status === 409) {
    let accountIds: Array<string | number> | undefined;
    try {
      const json = (await res.json()) as ConflictResponseJson;
      accountIds = Array.isArray(json.account_ids) ? json.account_ids : undefined;
    } catch {
      accountIds = undefined;
    }
    return { ok: false, reason: "conflict", conflictAccountIds: accountIds };
  }

  console.error("[Leona billing] resposta inesperada:", res.status, await res.text().catch(() => ""));
  return { ok: false, reason: "upstream", httpStatus: res.status };
}

/**
 * Quando `fetchBillingProfileByEmail` devolve `conflict` (multiple accounts
 * pro mesmo email), tenta desambiguar buscando cada `account_id` e
 * escolhendo o ÚNICO que tem `rewardful_referral` configurado. Caso comum:
 * cliente tem 1 conta ativa com referral + N contas duplicadas inativas
 * sem referral.
 *
 * Retorna:
 *  - { ok: true, profile } se conseguiu desambiguar (apenas 1 com referral).
 *  - { ok: false, reason: 'ambiguous', candidates } se 2+ contas têm
 *    referral (ambiguidade real, requer intervenção manual).
 *  - { ok: false, reason: 'no_referral' } se nenhuma das contas tem referral.
 *  - { ok: false, reason: 'upstream' } se algum lookup falhou.
 */
export type BillingDisambiguationResult =
  | { ok: true; profile: LeonaBillingProfile; chosenAccountId: string | number }
  | {
      ok: false;
      reason: "ambiguous" | "no_referral" | "upstream";
      candidates?: Array<{ accountId: string | number; rewardfulReferral: string | null }>;
    };

export async function disambiguateBillingProfile(
  email: string,
  accountIds: Array<string | number>
): Promise<BillingDisambiguationResult> {
  const profiles: Array<{
    accountId: string | number;
    profile: LeonaBillingProfile;
  }> = [];

  for (const accountId of accountIds) {
    const result = await fetchBillingProfileByEmail(email, accountId);
    if (!result.ok) {
      if (result.reason === "not_found") continue;
      return { ok: false, reason: "upstream" };
    }
    profiles.push({ accountId, profile: result.profile });
  }

  const withReferral = profiles.filter(
    (p) => !!p.profile.rewardful_referral
  );

  if (withReferral.length === 0) {
    return {
      ok: false,
      reason: "no_referral",
      candidates: profiles.map((p) => ({
        accountId: p.accountId,
        rewardfulReferral: p.profile.rewardful_referral,
      })),
    };
  }

  if (withReferral.length === 1) {
    return {
      ok: true,
      profile: withReferral[0].profile,
      chosenAccountId: withReferral[0].accountId,
    };
  }

  // 2+ contas com referral. Se TODAS apontam pro mesmo código, ainda dá
  // pra resolver (cliente trocou de plano mas manteve o mesmo afiliado).
  const referrals = new Set(
    withReferral.map((p) => p.profile.rewardful_referral!.trim().toLowerCase())
  );
  if (referrals.size === 1) {
    return {
      ok: true,
      profile: withReferral[0].profile,
      chosenAccountId: withReferral[0].accountId,
    };
  }

  return {
    ok: false,
    reason: "ambiguous",
    candidates: withReferral.map((p) => ({
      accountId: p.accountId,
      rewardfulReferral: p.profile.rewardful_referral,
    })),
  };
}
