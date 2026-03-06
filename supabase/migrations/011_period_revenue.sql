CREATE TABLE IF NOT EXISTS period_revenue (
  period_label TEXT PRIMARY KEY,
  stripe_revenue_usd_cents INTEGER NOT NULL DEFAULT 0,
  stripe_revenue_brl_cents INTEGER NOT NULL DEFAULT 0,
  abacate_revenue_cents INTEGER NOT NULL DEFAULT 0,
  usd_brl_rate NUMERIC(10,4) NOT NULL DEFAULT 1,
  cached_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE period_revenue ENABLE ROW LEVEL SECURITY;
