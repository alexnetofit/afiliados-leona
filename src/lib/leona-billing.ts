import type { LeonaBillingProfile } from "@/lib/guru-subscription-sync";

export type LeonaBillingResult =
  | { ok: true; profile: LeonaBillingProfile }
  | { ok: false; reason: "not_found" | "conflict" | "upstream"; httpStatus?: number };

type BillingProfileJson = {
  account_id?: string | number | null;
  subscription_status?: string | null;
  current_period_end?: string | null;
  rewardful_referral?: string | null;
  user?: { name?: string | null; email?: string | null } | null;
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
 * GET /api/v1/integration/accounts/billing_profile?email=...
 * Documentação: perfil de cobrança Leona (Bearer compartilhado).
 */
export async function fetchBillingProfileByEmail(
  email: string
): Promise<LeonaBillingResult> {
  const base = process.env.LEONA_INTEGRATION_BASE_URL?.replace(/\/$/, "");
  const token = process.env.LEONA_INTEGRATION_BILLING_BEARER_TOKEN;

  if (!base || !token) {
    console.error("[Leona billing] LEONA_INTEGRATION_BASE_URL ou LEONA_INTEGRATION_BILLING_BEARER_TOKEN ausente");
    return { ok: false, reason: "upstream", httpStatus: 503 };
  }

  const url = new URL(`${base}/api/v1/integration/accounts/billing_profile`);
  url.searchParams.set("email", email);

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
    return { ok: false, reason: "conflict" };
  }

  console.error("[Leona billing] resposta inesperada:", res.status, await res.text().catch(() => ""));
  return { ok: false, reason: "upstream", httpStatus: res.status };
}
