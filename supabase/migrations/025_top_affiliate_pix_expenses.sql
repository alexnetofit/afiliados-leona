-- ============================================================================
-- Migration 025: top_affiliate_pix_expenses
-- ============================================================================
-- Gastos Pix manuais por afiliado, lançados pelo admin na página Top Afiliados.
-- Complementa o gasto do cartão Wise (buscado direto na API) quando o admin
-- envia dinheiro pelo Pix em vez de gastar no cartão. Valores em BRL.
-- Apenas service_role escreve/lê: a UI passa pela API admin.
-- ============================================================================

CREATE TABLE IF NOT EXISTS top_affiliate_pix_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount_brl_cents INTEGER NOT NULL CHECK (amount_brl_cents > 0),
  paid_at TIMESTAMPTZ NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_admin TEXT
);

CREATE INDEX IF NOT EXISTS idx_top_affiliate_pix_expenses_affiliate
  ON top_affiliate_pix_expenses(affiliate_id, paid_at DESC);

ALTER TABLE top_affiliate_pix_expenses ENABLE ROW LEVEL SECURITY;
