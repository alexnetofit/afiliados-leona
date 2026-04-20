-- ============================================
-- Migration 018: Track which Asaas account processed each withdraw
-- ============================================
-- Two accounts in use:
--   'solucoes' = An Soluções Digitais (primary, CNPJ 56.021.532/0001-60)
--   'cursos'   = An Cursos (secondary, fallback)

ALTER TABLE withdraw_requests
  ADD COLUMN IF NOT EXISTS asaas_account TEXT;

-- Backfill: every saque já existente foi pela conta antiga (Cursos)
UPDATE withdraw_requests
   SET asaas_account = 'cursos'
 WHERE asaas_account IS NULL;

ALTER TABLE withdraw_requests
  ALTER COLUMN asaas_account SET DEFAULT 'solucoes';

ALTER TABLE withdraw_requests
  ADD CONSTRAINT withdraw_requests_asaas_account_chk
  CHECK (asaas_account IN ('solucoes', 'cursos'));

CREATE INDEX IF NOT EXISTS idx_withdraw_requests_asaas_account
  ON withdraw_requests(asaas_account);
