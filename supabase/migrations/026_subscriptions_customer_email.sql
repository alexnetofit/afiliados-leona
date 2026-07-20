-- E-mail do cliente (separado do nome) para exibição no painel do parceiro
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS customer_email TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_email
  ON subscriptions (customer_email)
  WHERE customer_email IS NOT NULL;

-- Legado Stripe: quando só havia e-mail, ele ficava em customer_name
UPDATE subscriptions
SET customer_email = lower(trim(customer_name))
WHERE customer_email IS NULL
  AND customer_name IS NOT NULL
  AND position('@' in customer_name) > 0;
