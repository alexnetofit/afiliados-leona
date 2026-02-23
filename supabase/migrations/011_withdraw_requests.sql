-- ============================================
-- Migration 011: Withdraw Requests
-- ============================================

CREATE TABLE IF NOT EXISTS withdraw_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL REFERENCES affiliates(id),
  affiliate_name TEXT,
  affiliate_email TEXT,
  amount_text TEXT NOT NULL,
  date_label TEXT,
  pix_key TEXT,
  wise_email TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdraw_requests_affiliate ON withdraw_requests(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_withdraw_requests_status ON withdraw_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdraw_requests_created ON withdraw_requests(created_at DESC);
