-- ============================================
-- Migration 027: fecha leitura pública de PII
-- ============================================
--
-- Tudo em `public` é exposto pelo PostgREST e a anon key está no bundle JS,
-- então qualquer tabela sem RLS ou view SECURITY DEFINER é dump em 1 request.
-- Fecha:
--  1) withdraw_requests — RLS nunca foi habilitada (migration 011): 630 linhas
--     com pix_key, affiliate_email e valor de TODOS os afiliados abertas pro anon.
--  2) manager_affiliates — RLS nunca foi habilitada (migration 012): mapa
--     manager -> afiliado + % de comissão aberto pro anon.
--  3) payout_report — view SECURITY DEFINER que junta auth.users e
--     affiliates.payout_pix_key/payout_wise_details: e-mail + chave PIX de
--     todos os afiliados. Só service_role/postgres precisa ler.
--  4) affiliate_balance_summary / affiliate_subscription_stats /
--     fraud_analysis_by_ip — views SECURITY DEFINER (bypassam RLS de
--     transactions, subscriptions e anti_fraud_logs). Nenhuma é usada pelo app.
--
-- Escritas nessas tabelas continuam só via service_role (webhooks Asaas/Guru,
-- cron e rotas /api/*), que tem BYPASSRLS — por isso nenhuma policy de
-- INSERT/UPDATE/DELETE é criada aqui.
--
-- ATENÇÃO: as default privileges do Supabase concedem tudo a anon/authenticated
-- em objetos novos de `public`. CREATE OR REPLACE VIEW preserva a ACL, mas um
-- DROP + CREATE reabre o acesso — ao mexer nessas views, repetir os REVOKE.
-- ============================================

-- --------- helpers usados pelas policies ---------
-- Fixa search_path: SECURITY DEFINER sem search_path fixo é sequestrável por
-- schema no search_path do chamador (lint 0011_function_search_path_mutable).

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION get_current_affiliate_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT id FROM affiliates WHERE user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- --------- 1. withdraw_requests ---------

ALTER TABLE withdraw_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "withdraw_requests_select_own" ON withdraw_requests;
CREATE POLICY "withdraw_requests_select_own" ON withdraw_requests
  FOR SELECT USING (affiliate_id = get_current_affiliate_id() OR is_admin());

-- --------- 2. manager_affiliates ---------
-- Só o manager vê seus vínculos. O afiliado gerenciado não precisa saber quem
-- o gerencia nem o % que o manager recebe.

ALTER TABLE manager_affiliates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manager_affiliates_select_own" ON manager_affiliates;
CREATE POLICY "manager_affiliates_select_own" ON manager_affiliates
  FOR SELECT USING (manager_id = get_current_affiliate_id() OR is_admin());

-- --------- 3. payout_report ---------
-- Mantida como SECURITY DEFINER de propósito: ela lê auth.users, e nem anon nem
-- authenticated nem service_role têm SELECT lá. Fechar o acesso via REVOKE tira
-- a view do PostgREST; segue legível por postgres (SQL editor / relatórios).

REVOKE ALL ON payout_report FROM anon, authenticated;

COMMENT ON VIEW payout_report IS
  'Relatório de payouts com PII (e-mail, chave PIX, Wise). NÃO conceder a anon/authenticated: expõe dados bancários de todos os afiliados. Migration 027.';

-- --------- 4. views agregadas não usadas pelo app ---------
-- security_invoker faz a view respeitar a RLS de quem consulta, então se
-- voltarem a ser usadas pelo front cada afiliado só vê as próprias linhas.

ALTER VIEW affiliate_balance_summary SET (security_invoker = true);
ALTER VIEW affiliate_subscription_stats SET (security_invoker = true);
ALTER VIEW fraud_analysis_by_ip SET (security_invoker = true);

REVOKE ALL ON affiliate_balance_summary FROM anon;
REVOKE ALL ON affiliate_subscription_stats FROM anon;
REVOKE ALL ON fraud_analysis_by_ip FROM anon, authenticated;
