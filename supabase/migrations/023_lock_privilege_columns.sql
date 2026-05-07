-- ============================================
-- Migration 023: trava colunas privilegiadas
-- ============================================
--
-- Fecha vetores de escalada de privilégio:
--  1) UPDATE direto em profiles.role
--  2) UPDATE direto em campos sensíveis de affiliates
--     (commission_tier, tier_locked, is_manager, is_active,
--      affiliate_code, user_id, paid_subscriptions_count)
--
-- Defesa em 2 camadas:
--  - Trigger BEFORE UPDATE (lógica explícita; deixa service_role
--    e o owner do banco passarem porque auth.uid() é NULL).
--  - REVOKE column-level pra role `authenticated` (PostgREST
--    recusa a query antes de chegar ao trigger).
--
-- Webhooks Guru/Stripe e cron usam service_role / pg_cron,
-- então auth.uid() é NULL e a trigger libera. Mesmo assim,
-- o trigger update_affiliate_tier continua promovendo tier
-- automaticamente quando paid_subscriptions_count muda.
-- ============================================

-- --------- profiles.role ---------

CREATE OR REPLACE FUNCTION prevent_profiles_role_escalation()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.role IS DISTINCT FROM OLD.role
     AND NOT is_admin() THEN
    RAISE EXCEPTION 'permission denied: cannot change role';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS profiles_lock_role ON profiles;
CREATE TRIGGER profiles_lock_role
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_profiles_role_escalation();

-- --------- affiliates: campos privilegiados ---------

CREATE OR REPLACE FUNCTION prevent_affiliates_self_promote()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    IF NEW.commission_tier  IS DISTINCT FROM OLD.commission_tier
       OR NEW.tier_locked   IS DISTINCT FROM OLD.tier_locked
       OR NEW.is_manager    IS DISTINCT FROM OLD.is_manager
       OR NEW.is_active     IS DISTINCT FROM OLD.is_active
       OR NEW.affiliate_code IS DISTINCT FROM OLD.affiliate_code
       OR NEW.user_id       IS DISTINCT FROM OLD.user_id
       OR NEW.paid_subscriptions_count IS DISTINCT FROM OLD.paid_subscriptions_count THEN
      RAISE EXCEPTION 'permission denied: cannot change protected columns';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS affiliates_lock_protected ON affiliates;
CREATE TRIGGER affiliates_lock_protected
  BEFORE UPDATE ON affiliates
  FOR EACH ROW EXECUTE FUNCTION prevent_affiliates_self_promote();

-- --------- defesa em profundidade: REVOKE column-level ---------
-- service_role tem BYPASSRLS e mantém grants próprios; só authenticated perde.

REVOKE UPDATE (role) ON profiles FROM authenticated;
REVOKE UPDATE (commission_tier, tier_locked, is_manager, is_active,
               affiliate_code, user_id, paid_subscriptions_count)
  ON affiliates FROM authenticated;

COMMENT ON FUNCTION prevent_profiles_role_escalation IS
  'Bloqueia mudança de profiles.role por usuários autenticados não-admin. service_role bypassa (auth.uid() NULL). Migration 023.';

COMMENT ON FUNCTION prevent_affiliates_self_promote IS
  'Bloqueia mudança de campos sensíveis de affiliates (commission_tier, tier_locked, is_manager, is_active, affiliate_code, user_id, paid_subscriptions_count) por usuários autenticados não-admin. service_role bypassa. Migration 023.';
