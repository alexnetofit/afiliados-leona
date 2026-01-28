-- ============================================
-- Migration 008: Row Level Security Policies
-- ============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE anti_fraud_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Helper Functions
-- ============================================

-- Verifica se o usuário atual é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Retorna o affiliate_id do usuário atual
CREATE OR REPLACE FUNCTION get_current_affiliate_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT id FROM affiliates WHERE user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- Profiles Policies
-- ============================================

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "profiles_insert_self" ON profiles;
CREATE POLICY "profiles_insert_self" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- ============================================
-- Affiliates Policies
-- ============================================

DROP POLICY IF EXISTS "affiliates_select" ON affiliates;
CREATE POLICY "affiliates_select" ON affiliates
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "affiliates_update" ON affiliates;
CREATE POLICY "affiliates_update" ON affiliates
  FOR UPDATE USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "affiliates_insert" ON affiliates;
CREATE POLICY "affiliates_insert" ON affiliates
  FOR INSERT WITH CHECK (user_id = auth.uid() OR is_admin());

-- ============================================
-- Affiliate Links Policies
-- ============================================

DROP POLICY IF EXISTS "links_select" ON affiliate_links;
CREATE POLICY "links_select" ON affiliate_links
  FOR SELECT USING (affiliate_id = get_current_affiliate_id() OR is_admin());

DROP POLICY IF EXISTS "links_insert" ON affiliate_links;
CREATE POLICY "links_insert" ON affiliate_links
  FOR INSERT WITH CHECK (affiliate_id = get_current_affiliate_id());

DROP POLICY IF EXISTS "links_delete" ON affiliate_links;
CREATE POLICY "links_delete" ON affiliate_links
  FOR DELETE USING (affiliate_id = get_current_affiliate_id());

-- ============================================
-- Customer Affiliates Policies
-- ============================================

-- Apenas admin pode ver (afiliados não precisam ver a tabela diretamente)
DROP POLICY IF EXISTS "customer_affiliates_select_admin" ON customer_affiliates;
CREATE POLICY "customer_affiliates_select_admin" ON customer_affiliates
  FOR SELECT USING (is_admin());

-- Insert apenas via service role (webhook)
DROP POLICY IF EXISTS "customer_affiliates_insert_service" ON customer_affiliates;
CREATE POLICY "customer_affiliates_insert_service" ON customer_affiliates
  FOR INSERT WITH CHECK (is_admin());

-- ============================================
-- Subscriptions Policies
-- ============================================

DROP POLICY IF EXISTS "subscriptions_select" ON subscriptions;
CREATE POLICY "subscriptions_select" ON subscriptions
  FOR SELECT USING (affiliate_id = get_current_affiliate_id() OR is_admin());

-- Insert/Update apenas via service role
DROP POLICY IF EXISTS "subscriptions_insert_admin" ON subscriptions;
CREATE POLICY "subscriptions_insert_admin" ON subscriptions
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "subscriptions_update_admin" ON subscriptions;
CREATE POLICY "subscriptions_update_admin" ON subscriptions
  FOR UPDATE USING (is_admin());

-- ============================================
-- Transactions Policies
-- ============================================

DROP POLICY IF EXISTS "transactions_select" ON transactions;
CREATE POLICY "transactions_select" ON transactions
  FOR SELECT USING (affiliate_id = get_current_affiliate_id() OR is_admin());

-- Insert apenas via service role
DROP POLICY IF EXISTS "transactions_insert_admin" ON transactions;
CREATE POLICY "transactions_insert_admin" ON transactions
  FOR INSERT WITH CHECK (is_admin());

-- ============================================
-- Monthly Payouts Policies
-- ============================================

DROP POLICY IF EXISTS "payouts_select" ON monthly_payouts;
CREATE POLICY "payouts_select" ON monthly_payouts
  FOR SELECT USING (affiliate_id = get_current_affiliate_id() OR is_admin());

DROP POLICY IF EXISTS "payouts_insert_admin" ON monthly_payouts;
CREATE POLICY "payouts_insert_admin" ON monthly_payouts
  FOR INSERT WITH CHECK (is_admin());

DROP POLICY IF EXISTS "payouts_update_admin" ON monthly_payouts;
CREATE POLICY "payouts_update_admin" ON monthly_payouts
  FOR UPDATE USING (is_admin());

-- ============================================
-- Stripe Events Policies
-- ============================================

-- Apenas admin/service pode acessar
DROP POLICY IF EXISTS "stripe_events_all_admin" ON stripe_events;
CREATE POLICY "stripe_events_all_admin" ON stripe_events
  FOR ALL USING (is_admin());

-- ============================================
-- Anti-Fraud Logs Policies
-- ============================================

-- Apenas admin pode ver
DROP POLICY IF EXISTS "anti_fraud_select_admin" ON anti_fraud_logs;
CREATE POLICY "anti_fraud_select_admin" ON anti_fraud_logs
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "anti_fraud_insert_admin" ON anti_fraud_logs;
CREATE POLICY "anti_fraud_insert_admin" ON anti_fraud_logs
  FOR INSERT WITH CHECK (is_admin());

-- ============================================
-- Service Role Bypass
-- ============================================

-- Nota: O service_role key automaticamente bypassa RLS no Supabase
-- Isso é usado nas Edge Functions para operações administrativas
