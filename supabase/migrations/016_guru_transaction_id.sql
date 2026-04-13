-- Idempotência para comissões originadas no webhook Digital Manager Guru
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS guru_transaction_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_guru_transaction_id
  ON transactions (guru_transaction_id)
  WHERE guru_transaction_id IS NOT NULL;
