import type { SupabaseClient } from "@supabase/supabase-js";

/** Resolve afiliado por `affiliates.affiliate_code` ou `affiliate_links.alias` (sem gravar customer_affiliates). */
export async function resolveAffiliateIdByCode(
  supabase: SupabaseClient,
  code: string
): Promise<string | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("id")
    .eq("affiliate_code", trimmed)
    .single();

  if (affiliate) return affiliate.id;

  const { data: link } = await supabase
    .from("affiliate_links")
    .select("affiliate_id")
    .eq("alias", trimmed)
    .single();

  return link?.affiliate_id ?? null;
}
