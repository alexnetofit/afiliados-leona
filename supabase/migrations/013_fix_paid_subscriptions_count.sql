-- ============================================
-- Migration 013: Recalcular paid_subscriptions_count
-- ============================================

UPDATE affiliates a
SET paid_subscriptions_count = sub.real_count
FROM (
  SELECT affiliate_id, COUNT(DISTINCT subscription_id) AS real_count
  FROM transactions
  WHERE type = 'commission' AND subscription_id IS NOT NULL
  GROUP BY affiliate_id
) sub
WHERE a.id = sub.affiliate_id;
