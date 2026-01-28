-- ============================================
-- Migration 006: Monthly Payouts
-- ============================================

CREATE TABLE IF NOT EXISTS monthly_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL, -- primeiro dia do mês (2025-01-01)
  affiliate_id UUID NOT NULL REFERENCES affiliates(id),
  total_commission_cents INTEGER DEFAULT 0,
  total_negative_cents INTEGER DEFAULT 0,
  total_payable_cents INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid')),
  paid_at TIMESTAMPTZ,
  paid_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(month, affiliate_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_monthly_payouts_affiliate ON monthly_payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_monthly_payouts_month ON monthly_payouts(month);
CREATE INDEX IF NOT EXISTS idx_monthly_payouts_status ON monthly_payouts(status);

DROP TRIGGER IF EXISTS update_monthly_payouts_updated_at ON monthly_payouts;
CREATE TRIGGER update_monthly_payouts_updated_at
  BEFORE UPDATE ON monthly_payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para gerar/atualizar payout mensal de um afiliado
CREATE OR REPLACE FUNCTION generate_monthly_payout(
  p_affiliate_id UUID,
  p_month DATE
)
RETURNS UUID AS $$
DECLARE
  v_payout_id UUID;
  v_total_commission INTEGER;
  v_total_negative INTEGER;
  v_total_payable INTEGER;
  v_month_start DATE;
  v_month_end DATE;
BEGIN
  -- Normalizar para primeiro dia do mês
  v_month_start := date_trunc('month', p_month)::DATE;
  v_month_end := (v_month_start + INTERVAL '1 month')::DATE;
  
  -- Calcular totais do mês
  SELECT 
    COALESCE(SUM(commission_amount_cents) FILTER (WHERE type = 'commission'), 0),
    COALESCE(SUM(ABS(commission_amount_cents)) FILTER (WHERE type IN ('refund', 'dispute')), 0)
  INTO v_total_commission, v_total_negative
  FROM transactions
  WHERE affiliate_id = p_affiliate_id
    AND available_at >= v_month_start
    AND available_at < v_month_end;
  
  v_total_payable := GREATEST(v_total_commission - v_total_negative, 0);
  
  -- Upsert payout
  INSERT INTO monthly_payouts (
    month,
    affiliate_id,
    total_commission_cents,
    total_negative_cents,
    total_payable_cents
  ) VALUES (
    v_month_start,
    p_affiliate_id,
    v_total_commission,
    v_total_negative,
    v_total_payable
  )
  ON CONFLICT (month, affiliate_id) DO UPDATE SET
    total_commission_cents = EXCLUDED.total_commission_cents,
    total_negative_cents = EXCLUDED.total_negative_cents,
    total_payable_cents = EXCLUDED.total_payable_cents,
    updated_at = NOW()
  WHERE monthly_payouts.status = 'pending' -- Só atualiza se ainda não foi pago
  RETURNING id INTO v_payout_id;
  
  RETURN v_payout_id;
END;
$$ LANGUAGE plpgsql;

-- Função para gerar payouts de todos os afiliados de um mês
CREATE OR REPLACE FUNCTION generate_all_monthly_payouts(p_month DATE)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_affiliate RECORD;
BEGIN
  FOR v_affiliate IN SELECT id FROM affiliates WHERE is_active = TRUE
  LOOP
    PERFORM generate_monthly_payout(v_affiliate.id, p_month);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Função para marcar payout como pago
CREATE OR REPLACE FUNCTION mark_payout_as_paid(
  p_payout_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE monthly_payouts
  SET 
    status = 'paid',
    paid_at = NOW(),
    paid_note = p_note
  WHERE id = p_payout_id
    AND status != 'paid';
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Função para marcar múltiplos payouts como pagos (lote)
CREATE OR REPLACE FUNCTION mark_payouts_as_paid_batch(
  p_payout_ids UUID[],
  p_note TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE monthly_payouts
  SET 
    status = 'paid',
    paid_at = NOW(),
    paid_note = p_note
  WHERE id = ANY(p_payout_ids)
    AND status != 'paid';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- View para relatório de pagamentos com dados do afiliado
CREATE OR REPLACE VIEW payout_report AS
SELECT 
  mp.id,
  mp.month,
  mp.total_commission_cents,
  mp.total_negative_cents,
  mp.total_payable_cents,
  mp.status,
  mp.paid_at,
  mp.paid_note,
  a.id AS affiliate_id,
  a.affiliate_code,
  a.payout_pix_key,
  a.payout_wise_details,
  p.full_name,
  u.email
FROM monthly_payouts mp
JOIN affiliates a ON a.id = mp.affiliate_id
JOIN profiles p ON p.id = a.user_id
JOIN auth.users u ON u.id = p.id
ORDER BY mp.month DESC, p.full_name;
