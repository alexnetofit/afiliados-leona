-- ============================================================================
-- Migration 024: withdraw_balance_adjustments
-- ============================================================================
--
-- Tabela dedicada a ajustes manuais de saldo de afiliados que NÃO derivam de
-- vendas/refunds (que ficam em `transactions`). Caso de uso atual:
--
--   Migration 012 (mar/2026) recalculou `commission_amount_cents` de todas as
--   transactions sob o fator 0.93 (taxa do gateway). Mas os
--   `withdraw_requests.amount_text` salvos antes de 12/03/2026 ficaram com o
--   valor BRUTO (≈7% maior que o líquido). Quando o POST /api/withdraw passou
--   a validar saldo (commit 302cfd9, 05/05/2026), o cálculo
--   `liquidoLiberado - sacado` ficou cronicamente negativo em ~7% pra esses
--   afiliados — e a diferença NUNCA se zerava porque cada saque novo entra
--   com amount_text já líquido (não compensa o legado).
--
--   Solução: registrar uma compensação contábil positiva por afiliado afetado
--   nesta tabela. O `getWithdrawBalance` soma esses ajustes ao
--   `liquidoLiberado`, restaurando o saldo correto sem precisar mexer
--   retroativamente nos `withdraw_requests` (que continuam refletindo o que
--   foi pago à epoca, preservando audit trail) nem em `transactions` (que
--   continuam refletindo apenas vendas).
--
-- Quem pode escrever: apenas service_role (admin).
-- Quem pode ler: o próprio afiliado vê os SEUS ajustes; admin vê todos.
-- ============================================================================

CREATE TABLE IF NOT EXISTS withdraw_balance_adjustments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_admin TEXT
);

CREATE INDEX IF NOT EXISTS idx_wba_affiliate
  ON withdraw_balance_adjustments(affiliate_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wba_affiliate_reference
  ON withdraw_balance_adjustments(affiliate_id, reference_code)
  WHERE reference_code IS NOT NULL;

ALTER TABLE withdraw_balance_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wba_self_select" ON withdraw_balance_adjustments;
CREATE POLICY "wba_self_select" ON withdraw_balance_adjustments
  FOR SELECT TO authenticated
  USING (
    affiliate_id IN (
      SELECT id FROM affiliates WHERE user_id = auth.uid()
    )
    OR is_admin()
  );

-- Apenas service_role escreve (BYPASSRLS). Sem policy de INSERT/UPDATE/DELETE
-- pra authenticated, então PostgREST recusa. Defesa em profundidade.

COMMENT ON TABLE withdraw_balance_adjustments IS
  'Ajustes contábeis de saldo de afiliados, somados ao liquidoLiberado em getWithdrawBalance. Usado para compensações administrativas (e.g., recálculo retroativo de comissões). Migration 024.';

COMMENT ON COLUMN withdraw_balance_adjustments.amount_cents IS
  'Valor em centavos. Positivo = aumenta saldo disponível do afiliado. Negativo = reduz.';

COMMENT ON COLUMN withdraw_balance_adjustments.reference_code IS
  'Código opcional pra evitar duplicidade ao re-rodar scripts (e.g., "migration-012-compensation").';
