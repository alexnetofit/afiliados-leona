-- Admin costs table for manual expense tracking
CREATE TABLE IF NOT EXISTS admin_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_label TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  amount_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_costs_period ON admin_costs(period_label);

-- Only admins can access this table (via service role key in API routes)
ALTER TABLE admin_costs ENABLE ROW LEVEL SECURITY;
