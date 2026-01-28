-- ============================================
-- Migration 005: Transactions
-- ============================================

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id),
  subscription_id UUID REFERENCES subscriptions(id),
  stripe_invoice_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('commission', 'refund', 'dispute', 'adjustment')),
  amount_gross_cents INTEGER NOT NULL,
  commission_percent INTEGER NOT NULL,
  commission_amount_cents INTEGER NOT NULL,
  paid_at TIMESTAMPTZ,
  available_at TIMESTAMPTZ,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_affiliate ON transactions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_transactions_subscription ON transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_transactions_available ON transactions(available_at);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_paid_at ON transactions(paid_at);

-- Função para criar transaction de comissão
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
  -- Verificar se já existe transaction para este invoice (idempotência)
  SELECT id INTO v_transaction_id
  FROM transactions
  WHERE stripe_invoice_id = p_stripe_invoice_id;
  
  IF v_transaction_id IS NOT NULL THEN
    RETURN v_transaction_id;
  END IF;
  
  -- Buscar tier atual do afiliado
  SELECT commission_tier INTO v_commission_tier
  FROM affiliates
  WHERE id = p_affiliate_id;
  
  v_commission_percent := get_commission_percent(v_commission_tier);
  v_commission_amount := ROUND(p_amount_gross_cents * v_commission_percent / 100.0);
  v_available_at := p_paid_at + INTERVAL '15 days';
  
  -- Criar transaction
  INSERT INTO transactions (
    affiliate_id,
    subscription_id,
    stripe_invoice_id,
    stripe_charge_id,
    type,
    amount_gross_cents,
    commission_percent,
    commission_amount_cents,
    paid_at,
    available_at,
    description
  ) VALUES (
    p_affiliate_id,
    p_subscription_id,
    p_stripe_invoice_id,
    p_stripe_charge_id,
    'commission',
    p_amount_gross_cents,
    v_commission_percent,
    v_commission_amount,
    p_paid_at,
    v_available_at,
    'Comissão de venda'
  )
  RETURNING id INTO v_transaction_id;
  
  -- Verificar se é primeira invoice da subscription (para incrementar contador)
  SELECT NOT EXISTS(
    SELECT 1 FROM transactions 
    WHERE subscription_id = p_subscription_id 
      AND type = 'commission'
      AND id != v_transaction_id
  ) INTO v_is_first_invoice;
  
  IF v_is_first_invoice AND p_subscription_id IS NOT NULL THEN
    -- Incrementar contador de assinaturas pagas
    UPDATE affiliates
    SET paid_subscriptions_count = paid_subscriptions_count + 1
    WHERE id = p_affiliate_id;
  END IF;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Função para criar transaction negativa (refund/dispute)
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
  -- Buscar percentual da transação original
  SELECT commission_percent INTO v_original_percent
  FROM transactions
  WHERE stripe_invoice_id = p_original_invoice_id
    AND type = 'commission';
  
  -- Se não encontrar a original, usar o tier atual
  IF v_original_percent IS NULL THEN
    SELECT get_commission_percent(commission_tier) INTO v_original_percent
    FROM affiliates
    WHERE id = p_affiliate_id;
  END IF;
  
  v_commission_amount := -1 * ROUND(p_amount_refunded_cents * v_original_percent / 100.0);
  
  -- Criar transaction negativa
  INSERT INTO transactions (
    affiliate_id,
    subscription_id,
    stripe_charge_id,
    type,
    amount_gross_cents,
    commission_percent,
    commission_amount_cents,
    paid_at,
    available_at,
    description
  ) VALUES (
    p_affiliate_id,
    p_subscription_id,
    p_stripe_charge_id,
    p_type,
    -1 * p_amount_refunded_cents,
    v_original_percent,
    v_commission_amount,
    NOW(),
    NOW(), -- Disponível imediatamente (débito)
    CASE p_type 
      WHEN 'refund' THEN 'Estorno de comissão - Refund'
      WHEN 'dispute' THEN 'Estorno de comissão - Disputa'
      ELSE 'Ajuste de comissão'
    END
  )
  RETURNING id INTO v_transaction_id;
  
  -- Marcar subscription com flag
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

-- View para resumo de saldos por afiliado
CREATE OR REPLACE VIEW affiliate_balance_summary AS
SELECT 
  t.affiliate_id,
  -- Pendente: comissões onde available_at > NOW()
  COALESCE(SUM(t.commission_amount_cents) FILTER (
    WHERE t.type = 'commission' AND t.available_at > NOW()
  ), 0) AS pending_cents,
  -- Disponível: comissões disponíveis que ainda não foram pagas
  COALESCE(SUM(t.commission_amount_cents) FILTER (
    WHERE t.available_at <= NOW()
      AND NOT EXISTS (
        SELECT 1 FROM monthly_payouts mp 
        WHERE mp.affiliate_id = t.affiliate_id 
          AND mp.status = 'paid'
          AND t.paid_at >= mp.month 
          AND t.paid_at < mp.month + INTERVAL '1 month'
      )
  ), 0) AS available_cents,
  -- Total pago via monthly_payouts
  COALESCE((
    SELECT SUM(mp.total_payable_cents)
    FROM monthly_payouts mp
    WHERE mp.affiliate_id = t.affiliate_id AND mp.status = 'paid'
  ), 0) AS paid_cents
FROM transactions t
GROUP BY t.affiliate_id;
