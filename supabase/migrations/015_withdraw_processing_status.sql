-- ============================================
-- Migration 015: Add processing/failed status to withdraw_requests
-- ============================================

ALTER TABLE withdraw_requests DROP CONSTRAINT IF EXISTS withdraw_requests_status_check;
ALTER TABLE withdraw_requests ADD CONSTRAINT withdraw_requests_status_check
  CHECK (status IN ('pending', 'processing', 'paid', 'rejected', 'failed'));
