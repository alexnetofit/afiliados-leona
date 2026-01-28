-- ============================================
-- Migration 007: Stripe Events e Anti-Fraud Logs
-- ============================================

-- Tabela para controle de eventos Stripe processados (idempotência)
CREATE TABLE IF NOT EXISTS stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'skipped')),
  error TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_events_stripe_id ON stripe_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_status ON stripe_events(status);
CREATE INDEX IF NOT EXISTS idx_stripe_events_created ON stripe_events(created_at);

-- Função para registrar evento Stripe (início do processamento)
CREATE OR REPLACE FUNCTION register_stripe_event(
  p_stripe_event_id TEXT,
  p_type TEXT,
  p_payload JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_existing_status TEXT;
BEGIN
  -- Verificar se evento já existe
  SELECT id, status INTO v_event_id, v_existing_status
  FROM stripe_events
  WHERE stripe_event_id = p_stripe_event_id;
  
  -- Se já foi processado, retornar NULL para indicar skip
  IF v_existing_status = 'processed' THEN
    RETURN NULL;
  END IF;
  
  -- Se existe mas falhou, atualizar para retry
  IF v_event_id IS NOT NULL THEN
    UPDATE stripe_events
    SET status = 'pending', error = NULL
    WHERE id = v_event_id;
    RETURN v_event_id;
  END IF;
  
  -- Criar novo registro
  INSERT INTO stripe_events (stripe_event_id, type, payload)
  VALUES (p_stripe_event_id, p_type, p_payload)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Função para marcar evento como processado
CREATE OR REPLACE FUNCTION mark_stripe_event_processed(p_event_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE stripe_events
  SET status = 'processed', processed_at = NOW()
  WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql;

-- Função para marcar evento como falho
CREATE OR REPLACE FUNCTION mark_stripe_event_failed(p_event_id UUID, p_error TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE stripe_events
  SET status = 'failed', error = p_error, processed_at = NOW()
  WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Anti-Fraud Logs
-- ============================================

CREATE TABLE IF NOT EXISTS anti_fraud_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES affiliates(id),
  stripe_customer_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  country TEXT,
  action TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_anti_fraud_affiliate ON anti_fraud_logs(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_anti_fraud_customer ON anti_fraud_logs(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_anti_fraud_ip ON anti_fraud_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_anti_fraud_created ON anti_fraud_logs(created_at);

-- Função para registrar log de anti-fraude
CREATE OR REPLACE FUNCTION log_anti_fraud(
  p_affiliate_id UUID,
  p_stripe_customer_id TEXT,
  p_ip_address TEXT,
  p_user_agent TEXT,
  p_country TEXT,
  p_action TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO anti_fraud_logs (
    affiliate_id,
    stripe_customer_id,
    ip_address,
    user_agent,
    country,
    action,
    metadata
  ) VALUES (
    p_affiliate_id,
    p_stripe_customer_id,
    p_ip_address,
    p_user_agent,
    p_country,
    p_action,
    p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- View para análise de fraude por IP
CREATE OR REPLACE VIEW fraud_analysis_by_ip AS
SELECT 
  ip_address,
  COUNT(DISTINCT affiliate_id) AS affiliates_count,
  COUNT(DISTINCT stripe_customer_id) AS customers_count,
  COUNT(*) AS total_actions,
  MIN(created_at) AS first_seen,
  MAX(created_at) AS last_seen
FROM anti_fraud_logs
WHERE ip_address IS NOT NULL
GROUP BY ip_address
HAVING COUNT(DISTINCT affiliate_id) > 1 OR COUNT(DISTINCT stripe_customer_id) > 3
ORDER BY total_actions DESC;
