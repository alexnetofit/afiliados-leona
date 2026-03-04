-- ============================================
-- Migration 012: Manager Affiliates
-- ============================================
-- Permite que um afiliado "gerente" receba comissão
-- sobre as vendas de afiliados que ele recruta.

CREATE TABLE IF NOT EXISTS manager_affiliates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  manager_id UUID NOT NULL REFERENCES affiliates(id),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id),
  commission_percent INTEGER DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(manager_id, affiliate_id)
);

CREATE INDEX IF NOT EXISTS idx_manager_affiliates_affiliate ON manager_affiliates(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_manager_affiliates_manager ON manager_affiliates(manager_id);
