-- ============================================
-- Migration 009: CRON Jobs Configuration
-- ============================================

-- Enable pg_cron extension (must be done in Supabase dashboard or via support)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================
-- Function to generate monthly payouts
-- Runs on the 1st of each month
-- ============================================

CREATE OR REPLACE FUNCTION cron_generate_monthly_payouts()
RETURNS void AS $$
DECLARE
  v_last_month DATE;
  v_affiliate RECORD;
  v_total_commission INTEGER;
  v_total_negative INTEGER;
  v_total_payable INTEGER;
BEGIN
  -- Calculate last month's first day
  v_last_month := date_trunc('month', NOW() - INTERVAL '1 month')::DATE;
  
  -- Loop through all active affiliates
  FOR v_affiliate IN 
    SELECT id FROM affiliates WHERE is_active = TRUE
  LOOP
    -- Calculate totals for the month
    SELECT 
      COALESCE(SUM(commission_amount_cents) FILTER (WHERE type = 'commission'), 0),
      COALESCE(SUM(ABS(commission_amount_cents)) FILTER (WHERE type IN ('refund', 'dispute')), 0)
    INTO v_total_commission, v_total_negative
    FROM transactions
    WHERE affiliate_id = v_affiliate.id
      AND available_at >= v_last_month
      AND available_at < v_last_month + INTERVAL '1 month';
    
    v_total_payable := GREATEST(v_total_commission - v_total_negative, 0);
    
    -- Skip if no payable amount
    IF v_total_payable = 0 THEN
      CONTINUE;
    END IF;
    
    -- Insert or update payout record
    INSERT INTO monthly_payouts (
      month,
      affiliate_id,
      total_commission_cents,
      total_negative_cents,
      total_payable_cents,
      status
    ) VALUES (
      v_last_month,
      v_affiliate.id,
      v_total_commission,
      v_total_negative,
      v_total_payable,
      'pending'
    )
    ON CONFLICT (month, affiliate_id) DO UPDATE SET
      total_commission_cents = EXCLUDED.total_commission_cents,
      total_negative_cents = EXCLUDED.total_negative_cents,
      total_payable_cents = EXCLUDED.total_payable_cents,
      updated_at = NOW()
    WHERE monthly_payouts.status = 'pending';
  END LOOP;
  
  RAISE NOTICE 'Monthly payouts generated for %', v_last_month;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to update affiliate tiers
-- Runs daily to ensure tiers are always current
-- ============================================

CREATE OR REPLACE FUNCTION cron_update_affiliate_tiers()
RETURNS void AS $$
DECLARE
  v_affiliate RECORD;
  v_paid_count INTEGER;
  v_new_tier INTEGER;
BEGIN
  FOR v_affiliate IN 
    SELECT id, commission_tier, paid_subscriptions_count FROM affiliates
  LOOP
    -- Count unique paid subscriptions
    SELECT COUNT(DISTINCT subscription_id)
    INTO v_paid_count
    FROM transactions
    WHERE affiliate_id = v_affiliate.id
      AND type = 'commission'
      AND subscription_id IS NOT NULL;
    
    -- Calculate tier
    IF v_paid_count >= 50 THEN
      v_new_tier := 3;
    ELSIF v_paid_count >= 20 THEN
      v_new_tier := 2;
    ELSE
      v_new_tier := 1;
    END IF;
    
    -- Update if changed
    IF v_affiliate.commission_tier != v_new_tier OR v_affiliate.paid_subscriptions_count != v_paid_count THEN
      UPDATE affiliates
      SET 
        commission_tier = v_new_tier,
        paid_subscriptions_count = v_paid_count,
        updated_at = NOW()
      WHERE id = v_affiliate.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to clean old stripe events
-- Runs weekly to remove events older than 90 days
-- ============================================

CREATE OR REPLACE FUNCTION cron_cleanup_old_events()
RETURNS void AS $$
BEGIN
  DELETE FROM stripe_events
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND status IN ('processed', 'skipped');
  
  RAISE NOTICE 'Cleaned up old stripe events';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CRON Job Scheduling
-- Note: These commands require pg_cron extension
-- Run in Supabase SQL Editor or via CLI
-- ============================================

-- Schedule monthly payout generation (1st of each month at 00:05)
-- SELECT cron.schedule(
--   'generate-monthly-payouts',
--   '5 0 1 * *',
--   'SELECT cron_generate_monthly_payouts()'
-- );

-- Schedule daily tier update (every day at 01:00)
-- SELECT cron.schedule(
--   'update-affiliate-tiers',
--   '0 1 * * *',
--   'SELECT cron_update_affiliate_tiers()'
-- );

-- Schedule weekly cleanup (every Sunday at 02:00)
-- SELECT cron.schedule(
--   'cleanup-old-events',
--   '0 2 * * 0',
--   'SELECT cron_cleanup_old_events()'
-- );

-- ============================================
-- Manual CRON via Edge Functions
-- If pg_cron is not available, use external scheduler
-- to call these Edge Functions:
-- 
-- Daily: POST /functions/v1/cron-reconcile
-- Monthly: POST /functions/v1/cron-monthly-payouts
-- ============================================

COMMENT ON FUNCTION cron_generate_monthly_payouts IS 
  'Generates monthly payout records for all affiliates. Should run on 1st of each month.';

COMMENT ON FUNCTION cron_update_affiliate_tiers IS 
  'Updates affiliate commission tiers based on paid subscriptions. Should run daily.';

COMMENT ON FUNCTION cron_cleanup_old_events IS 
  'Removes old processed stripe events. Should run weekly.';
