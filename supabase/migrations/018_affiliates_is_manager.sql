-- ============================================
-- Migration 018: flag is_manager em affiliates
-- ============================================
-- Permite designar um afiliado como gerente mesmo antes de recrutar alguém.
-- O contexto da app passa a derivar isManager de (affiliates.is_manager OR
-- exists row em manager_affiliates). A coluna não exige migration de dados:
-- todo afiliado já cadastrado fica com is_manager = false e segue funcionando
-- exatamente igual a antes (quem já tem linhas em manager_affiliates continua
-- sendo gerente pela regra derivada).

ALTER TABLE affiliates
  ADD COLUMN IF NOT EXISTS is_manager BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_affiliates_is_manager
  ON affiliates (is_manager)
  WHERE is_manager = TRUE;
