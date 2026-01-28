-- ============================================
-- Migration 010: Sync Logs Table
-- Registra histórico de sincronizações com Stripe
-- ============================================

CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'error')),
  days_synced INTEGER,
  customers_scanned INTEGER DEFAULT 0,
  customers_linked INTEGER DEFAULT 0,
  subscriptions_synced INTEGER DEFAULT 0,
  invoices_synced INTEGER DEFAULT 0,
  refunds_synced INTEGER DEFAULT 0,
  error_message TEXT,
  triggered_by TEXT CHECK (triggered_by IN ('manual', 'cron'))
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);

-- RLS Policies (only admins can read)
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read sync_logs"
  ON sync_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Service role can manage sync_logs"
  ON sync_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE sync_logs IS 'Histórico de sincronizações com Stripe';
