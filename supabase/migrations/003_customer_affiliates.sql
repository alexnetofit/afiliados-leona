-- ============================================
-- Migration 003: Customer Affiliates (First Touch)
-- ============================================

-- Tabela para armazenar a relação fixa entre customer e affiliate
-- Uma vez criado, NUNCA deve ser alterado (First Touch Attribution)
CREATE TABLE IF NOT EXISTS customer_affiliates (
  stripe_customer_id TEXT PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para busca por affiliate
CREATE INDEX IF NOT EXISTS idx_customer_affiliates_affiliate ON customer_affiliates(affiliate_id);

-- Garantir que não há updates nesta tabela
CREATE OR REPLACE FUNCTION prevent_customer_affiliate_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'customer_affiliates não pode ser atualizado (First Touch Attribution)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_update_customer_affiliates ON customer_affiliates;
CREATE TRIGGER prevent_update_customer_affiliates
  BEFORE UPDATE ON customer_affiliates
  FOR EACH ROW EXECUTE FUNCTION prevent_customer_affiliate_update();

-- Função para resolver affiliate de um customer (First Touch)
-- Retorna affiliate_id se existir, ou NULL
CREATE OR REPLACE FUNCTION get_affiliate_for_customer(p_stripe_customer_id TEXT)
RETURNS UUID AS $$
DECLARE
  v_affiliate_id UUID;
BEGIN
  SELECT affiliate_id INTO v_affiliate_id
  FROM customer_affiliates
  WHERE stripe_customer_id = p_stripe_customer_id;
  
  RETURN v_affiliate_id;
END;
$$ LANGUAGE plpgsql;

-- Função para criar customer_affiliate se não existir
-- Usado pelo webhook quando detecta novo customer com affiliate code
CREATE OR REPLACE FUNCTION create_customer_affiliate_if_not_exists(
  p_stripe_customer_id TEXT,
  p_affiliate_code TEXT
)
RETURNS UUID AS $$
DECLARE
  v_affiliate_id UUID;
  v_existing_affiliate_id UUID;
BEGIN
  -- Verificar se já existe (First Touch - não alterar)
  SELECT affiliate_id INTO v_existing_affiliate_id
  FROM customer_affiliates
  WHERE stripe_customer_id = p_stripe_customer_id;
  
  IF v_existing_affiliate_id IS NOT NULL THEN
    RETURN v_existing_affiliate_id;
  END IF;
  
  -- Buscar affiliate pelo código
  SELECT id INTO v_affiliate_id
  FROM affiliates
  WHERE affiliate_code = p_affiliate_code
     OR id IN (SELECT affiliate_id FROM affiliate_links WHERE alias = p_affiliate_code);
  
  IF v_affiliate_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Criar o vínculo
  INSERT INTO customer_affiliates (stripe_customer_id, affiliate_id)
  VALUES (p_stripe_customer_id, v_affiliate_id)
  ON CONFLICT (stripe_customer_id) DO NOTHING;
  
  RETURN v_affiliate_id;
END;
$$ LANGUAGE plpgsql;
