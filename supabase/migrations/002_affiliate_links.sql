-- ============================================
-- Migration 002: Affiliate Links
-- ============================================

CREATE TABLE IF NOT EXISTS affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(affiliate_id, alias)
);

-- Index para busca por alias
CREATE INDEX IF NOT EXISTS idx_affiliate_links_alias ON affiliate_links(alias);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_affiliate ON affiliate_links(affiliate_id);

-- Trigger para limitar 3 links por afiliado
CREATE OR REPLACE FUNCTION check_affiliate_links_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM affiliate_links WHERE affiliate_id = NEW.affiliate_id) >= 3 THEN
    RAISE EXCEPTION 'Limite de 3 links por afiliado atingido';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_links_limit ON affiliate_links;
CREATE TRIGGER enforce_links_limit
  BEFORE INSERT ON affiliate_links
  FOR EACH ROW EXECUTE FUNCTION check_affiliate_links_limit();

-- Função para verificar se alias já existe (globalmente único)
CREATE OR REPLACE FUNCTION check_alias_unique()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se o alias já é usado como affiliate_code
  IF EXISTS(SELECT 1 FROM affiliates WHERE affiliate_code = NEW.alias) THEN
    RAISE EXCEPTION 'Este alias já está em uso como código de afiliado';
  END IF;
  
  -- Verificar se o alias já existe em outros afiliados
  IF EXISTS(SELECT 1 FROM affiliate_links WHERE alias = NEW.alias AND affiliate_id != NEW.affiliate_id) THEN
    RAISE EXCEPTION 'Este alias já está em uso por outro afiliado';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_alias_unique_trigger ON affiliate_links;
CREATE TRIGGER check_alias_unique_trigger
  BEFORE INSERT ON affiliate_links
  FOR EACH ROW EXECUTE FUNCTION check_alias_unique();
