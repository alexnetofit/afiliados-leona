-- Assinaturas vindas da Guru / espelho Leona (sem Stripe)
ALTER TABLE subscriptions
  ALTER COLUMN stripe_subscription_id DROP NOT NULL,
  ALTER COLUMN stripe_customer_id DROP NOT NULL;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS guru_subscription_internal_id TEXT,
  ADD COLUMN IF NOT EXISTS leona_account_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_guru_internal
  ON subscriptions (guru_subscription_internal_id)
  WHERE guru_subscription_internal_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_leona_account
  ON subscriptions (leona_account_id)
  WHERE leona_account_id IS NOT NULL;

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_stripe_pair_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_stripe_pair_check CHECK (
  (stripe_subscription_id IS NULL AND stripe_customer_id IS NULL)
  OR (stripe_subscription_id IS NOT NULL AND stripe_customer_id IS NOT NULL)
);

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_external_ref_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_external_ref_check CHECK (
  (stripe_subscription_id IS NOT NULL AND stripe_customer_id IS NOT NULL)
  OR guru_subscription_internal_id IS NOT NULL
  OR leona_account_id IS NOT NULL
);
