-- ============================================================================
-- Migration 022: Refund/Dispute herda available_at da comissão original
-- ============================================================================
--
-- Problema:
--   create_negative_transaction gravava paid_at e available_at com NOW(),
--   o que jogava o estorno em uma data avulsa (ex.: 12/04). A página
--   /pagamentos do afiliado agrupa por data exata de available_at, então
--   o refund formava um "grupo isolado" com valor negativo que o afiliado
--   nunca clicava em "Sacar" — resultado: estornos não eram descontados
--   dos saques futuros e alguns afiliados acabaram sacando a mais.
--
-- Fix:
--   Buscar a transação original (pelo p_original_invoice_id) e reusar o
--   available_at dela. Assim o refund cai no mesmo bucket (dia 5 ou 20)
--   da comissão original e desconta automaticamente do mesmo grupo.
--
--   Mantém paid_at = NOW() porque essa coluna serve só para histórico
--   "quando o estorno foi processado" — não influencia agrupamento/saque.
-- ============================================================================

CREATE OR REPLACE FUNCTION create_negative_transaction(
  p_affiliate_id UUID,
  p_subscription_id UUID,
  p_stripe_charge_id TEXT,
  p_type TEXT,
  p_amount_refunded_cents INTEGER,
  p_original_invoice_id TEXT
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_original_percent INTEGER;
  v_original_available_at TIMESTAMPTZ;
  v_commission_amount INTEGER;
BEGIN
  SELECT commission_percent, available_at
    INTO v_original_percent, v_original_available_at
  FROM transactions
  WHERE stripe_invoice_id = p_original_invoice_id
    AND type = 'commission';

  IF v_original_percent IS NULL THEN
    SELECT get_commission_percent(commission_tier) INTO v_original_percent
    FROM affiliates
    WHERE id = p_affiliate_id;
  END IF;

  -- Fallback: se por algum motivo não achar a transação original,
  -- usa NOW() (comportamento anterior) pra não perder o registro.
  IF v_original_available_at IS NULL THEN
    v_original_available_at := NOW();
  END IF;

  v_commission_amount := -1 * ROUND(p_amount_refunded_cents * 0.93 * v_original_percent / 100.0);

  INSERT INTO transactions (
    affiliate_id, subscription_id, stripe_charge_id,
    type, amount_gross_cents, commission_percent, commission_amount_cents,
    paid_at, available_at, description
  ) VALUES (
    p_affiliate_id, p_subscription_id, p_stripe_charge_id,
    p_type, -1 * p_amount_refunded_cents, v_original_percent, v_commission_amount,
    NOW(), v_original_available_at,
    CASE p_type
      WHEN 'refund' THEN 'Estorno de comissão - Refund'
      WHEN 'dispute' THEN 'Estorno de comissão - Disputa'
      ELSE 'Ajuste de comissão'
    END
  )
  RETURNING id INTO v_transaction_id;

  IF p_subscription_id IS NOT NULL THEN
    IF p_type = 'refund' THEN
      UPDATE subscriptions SET has_refund = TRUE WHERE id = p_subscription_id;
    ELSIF p_type = 'dispute' THEN
      UPDATE subscriptions SET has_dispute = TRUE WHERE id = p_subscription_id;
    END IF;
  END IF;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_negative_transaction IS
  'Cria transaction de refund/dispute. available_at é herdado da comissão original (via stripe_invoice_id) pra que o estorno fique no mesmo bucket de liberação e desconte automaticamente do saque do afiliado. Migration 022.';
