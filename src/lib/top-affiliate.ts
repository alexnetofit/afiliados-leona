import type { SupabaseClient } from "@supabase/supabase-js";

// Top afiliados são pagos manualmente pela equipe (Wise/Pix), fora do fluxo
// de saque automático. Para eles, o dashboard esconde o botão "Solicitar
// Saque" e troca "Disponível para saque" por "Comissão acumulada", evitando
// pagamento duplicado. Identificação por email (mesmo critério do admin).
export const TOP_AFFILIATE_EMAIL = "tbnegociodigital@gmail.com";
export const TOP_AFFILIATE_CODE = "renata";

const TOP_AFFILIATE_EMAILS = new Set<string>([TOP_AFFILIATE_EMAIL]);

export function isTopAffiliateEmail(email?: string | null): boolean {
  if (!email) return false;
  return TOP_AFFILIATE_EMAILS.has(email.trim().toLowerCase());
}

export type TopAffiliateRow = {
  id: string;
  affiliate_code: string;
  commission_tier: number;
  paid_subscriptions_count: number;
  user_id: string;
};

/**
 * Não usar auth.admin.listUsers({ perPage: 1000 }): com 1000+ contas
 * o Adailton/Renata (user antigo) cai fora da 1ª página e a API devolve 404.
 */
export async function resolveTopAffiliate(
  admin: SupabaseClient
): Promise<TopAffiliateRow | null> {
  const { data, error } = await admin
    .from("affiliates")
    .select("id, affiliate_code, commission_tier, paid_subscriptions_count, user_id")
    .eq("affiliate_code", TOP_AFFILIATE_CODE)
    .maybeSingle();

  if (error) {
    console.error("[top-affiliate] resolve:", error.message);
    return null;
  }
  return (data as TopAffiliateRow | null) ?? null;
}
