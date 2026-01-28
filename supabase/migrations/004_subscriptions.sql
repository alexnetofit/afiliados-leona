-- ============================================
-- Migration 004: Subscriptions
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id),
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  customer_name TEXT,
  price_id TEXT,
  amount_cents INTEGER,
  status TEXT NOT NULL CHECK (status IN (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'incomplete',
    'incomplete_expired'
  )),
  is_trial BOOLEAN DEFAULT FALSE,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  has_refund BOOLEAN DEFAULT FALSE,
  has_dispute BOOLEAN DEFAULT FALSE,
  last_event_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_affiliate ON subscriptions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para upsert subscription (usado pelo webhook)
CREATE OR REPLACE FUNCTION upsert_subscription(
  p_affiliate_id UUID,
  p_stripe_subscription_id TEXT,
  p_stripe_customer_id TEXT,
  p_customer_name TEXT,
  p_price_id TEXT,
  p_amount_cents INTEGER,
  p_status TEXT,
  p_is_trial BOOLEAN,
  p_trial_start TIMESTAMPTZ,
  p_trial_end TIMESTAMPTZ,
  p_started_at TIMESTAMPTZ,
  p_current_period_end TIMESTAMPTZ,
  p_canceled_at TIMESTAMPTZ
)
RETURNS UUID AS $$
DECLARE
  v_subscription_id UUID;
BEGIN
  INSERT INTO subscriptions (
    affiliate_id,
    stripe_subscription_id,
    stripe_customer_id,
    customer_name,
    price_id,
    amount_cents,
    status,
    is_trial,
    trial_start,
    trial_end,
    started_at,
    current_period_end,
    canceled_at,
    last_event_at
  ) VALUES (
    p_affiliate_id,
    p_stripe_subscription_id,
    p_stripe_customer_id,
    p_customer_name,
    p_price_id,
    p_amount_cents,
    p_status,
    p_is_trial,
    p_trial_start,
    p_trial_end,
    p_started_at,
    p_current_period_end,
    p_canceled_at,
    NOW()
  )
  ON CONFLICT (stripe_subscription_id) DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    price_id = EXCLUDED.price_id,
    amount_cents = EXCLUDED.amount_cents,
    status = EXCLUDED.status,
    is_trial = EXCLUDED.is_trial,
    trial_start = EXCLUDED.trial_start,
    trial_end = EXCLUDED.trial_end,
    started_at = COALESCE(subscriptions.started_at, EXCLUDED.started_at),
    current_period_end = EXCLUDED.current_period_end,
    canceled_at = EXCLUDED.canceled_at,
    last_event_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_subscription_id;
  
  RETURN v_subscription_id;
END;
$$ LANGUAGE plpgsql;

-- View para contagem de assinaturas por afiliado
CREATE OR REPLACE VIEW affiliate_subscription_stats AS
SELECT 
  a.id AS affiliate_id,
  COUNT(s.id) FILTER (WHERE s.status = 'trialing') AS trialing_count,
  COUNT(s.id) FILTER (WHERE s.status = 'active') AS active_count,
  COUNT(s.id) FILTER (WHERE s.status IN ('canceled', 'unpaid', 'past_due')) AS churned_count,
  COUNT(s.id) AS total_count
FROM affiliates a
LEFT JOIN subscriptions s ON s.affiliate_id = a.id
GROUP BY a.id;
