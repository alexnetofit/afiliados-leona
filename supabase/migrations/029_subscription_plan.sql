-- Plano atual da conta Leona (instâncias), separado do último pagamento.
-- O último pagamento pode ser só um pró-rata de upgrade.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS plan_instances INTEGER,
  ADD COLUMN IF NOT EXISTS plan_monthly_cents INTEGER;
