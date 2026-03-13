-- ============================================
-- Migration 012: Recalcular comissões sobre valor líquido (bruto - 7%)
-- Atualiza todas as transações EXCETO as que pertencem a payouts já pagos
-- ============================================

-- Atualizar comissões (commission, refund, dispute) que NÃO foram pagas
UPDATE transactions t
SET commission_amount_cents = CASE
  WHEN t.type = 'commission' THEN
    ROUND(t.amount_gross_cents * 0.93 * t.commission_percent / 100.0)
  WHEN t.type IN ('refund', 'dispute') THEN
    -1 * ROUND(ABS(t.amount_gross_cents) * 0.93 * t.commission_percent / 100.0)
  ELSE t.commission_amount_cents
END
WHERE NOT EXISTS (
  SELECT 1 FROM monthly_payouts mp
  WHERE mp.affiliate_id = t.affiliate_id
    AND mp.status = 'paid'
    AND t.available_at >= mp.month
    AND t.available_at < (mp.month + INTERVAL '1 month')
);

-- Recalcular totais dos monthly_payouts pendentes com base nas transactions atualizadas
UPDATE monthly_payouts mp
SET
  total_commission_cents = sub.total_commission,
  total_negative_cents = sub.total_negative,
  total_payable_cents = GREATEST(sub.total_commission - sub.total_negative, 0)
FROM (
  SELECT
    t.affiliate_id,
    date_trunc('month', t.available_at)::DATE AS month_start,
    COALESCE(SUM(t.commission_amount_cents) FILTER (WHERE t.type = 'commission'), 0) AS total_commission,
    COALESCE(SUM(ABS(t.commission_amount_cents)) FILTER (WHERE t.type IN ('refund', 'dispute')), 0) AS total_negative
  FROM transactions t
  GROUP BY t.affiliate_id, date_trunc('month', t.available_at)::DATE
) sub
WHERE mp.affiliate_id = sub.affiliate_id
  AND mp.month = sub.month_start
  AND mp.status != 'paid';

-- Atualizar funções SQL para usar valor líquido

CREATE OR REPLACE FUNCTION create_commission_transaction(
  p_affiliate_id UUID,
  p_subscription_id UUID,
  p_stripe_invoice_id TEXT,
  p_stripe_charge_id TEXT,
  p_amount_gross_cents INTEGER,
  p_paid_at TIMESTAMPTZ
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_commission_tier INTEGER;
  v_commission_percent INTEGER;
  v_commission_amount INTEGER;
  v_available_at TIMESTAMPTZ;
  v_is_first_invoice BOOLEAN;
BEGIN
  SELECT id INTO v_transaction_id
  FROM transactions
  WHERE stripe_invoice_id = p_stripe_invoice_id;
  
  IF v_transaction_id IS NOT NULL THEN
    RETURN v_transaction_id;
  END IF;
  
  SELECT commission_tier INTO v_commission_tier
  FROM affiliates
  WHERE id = p_affiliate_id;
  
  v_commission_percent := get_commission_percent(v_commission_tier);
  v_commission_amount := ROUND(p_amount_gross_cents * 0.93 * v_commission_percent / 100.0);
  v_available_at := p_paid_at + INTERVAL '15 days';
  
  INSERT INTO transactions (
    affiliate_id, subscription_id, stripe_invoice_id, stripe_charge_id,
    type, amount_gross_cents, commission_percent, commission_amount_cents,
    paid_at, available_at, description
  ) VALUES (
    p_affiliate_id, p_subscription_id, p_stripe_invoice_id, p_stripe_charge_id,
    'commission', p_amount_gross_cents, v_commission_percent, v_commission_amount,
    p_paid_at, v_available_at, 'Comissão de venda'
  )
  RETURNING id INTO v_transaction_id;
  
  SELECT NOT EXISTS(
    SELECT 1 FROM transactions 
    WHERE subscription_id = p_subscription_id 
      AND type = 'commission'
      AND id != v_transaction_id
  ) INTO v_is_first_invoice;
  
  IF v_is_first_invoice AND p_subscription_id IS NOT NULL THEN
    UPDATE affiliates
    SET paid_subscriptions_count = paid_subscriptions_count + 1
    WHERE id = p_affiliate_id;
  END IF;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

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
  v_commission_amount INTEGER;
BEGIN
  SELECT commission_percent INTO v_original_percent
  FROM transactions
  WHERE stripe_invoice_id = p_original_invoice_id
    AND type = 'commission';
  
  IF v_original_percent IS NULL THEN
    SELECT get_commission_percent(commission_tier) INTO v_original_percent
    FROM affiliates
    WHERE id = p_affiliate_id;
  END IF;
  
  v_commission_amount := -1 * ROUND(p_amount_refunded_cents * 0.93 * v_original_percent / 100.0);
  
  INSERT INTO transactions (
    affiliate_id, subscription_id, stripe_charge_id,
    type, amount_gross_cents, commission_percent, commission_amount_cents,
    paid_at, available_at, description
  ) VALUES (
    p_affiliate_id, p_subscription_id, p_stripe_charge_id,
    p_type, -1 * p_amount_refunded_cents, v_original_percent, v_commission_amount,
    NOW(), NOW(),
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
