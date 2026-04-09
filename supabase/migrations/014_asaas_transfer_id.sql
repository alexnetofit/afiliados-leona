-- ============================================
-- Migration 014: Add Asaas transfer tracking
-- ============================================

ALTER TABLE withdraw_requests ADD COLUMN IF NOT EXISTS asaas_transfer_id TEXT;
