-- ============================================
-- Migration 021: Proteção de overrides manuais de tier (tier_locked)
-- ============================================
-- Contexto:
--   O trigger update_affiliate_tier_trigger e o cron cron_update_affiliate_tiers
--   recalculam commission_tier automaticamente a partir de paid_subscriptions_count.
--   Isso ferra promoções administrativas manuais (admin sobe alguém pra tier 3
--   com poucas vendas), porque qualquer UPDATE em paid_subscriptions_count
--   ou rodada do cron força o cálculo automático e rebaixa de volta.
--
--   Esta migration adiciona a flag tier_locked. Quando TRUE:
--     - Trigger BEFORE UPDATE preserva commission_tier (não recalcula).
--     - Cron diário só atualiza paid_subscriptions_count e ignora tier.
--   O caminho de upgrade automático em código TS (webhook Stripe etc.) continua
--   funcionando para afiliados não locked, e como o JS dispara UPDATE em
--   paid_subscriptions_count, o trigger respeita o lock corretamente.
-- ============================================

ALTER TABLE affiliates
  ADD COLUMN IF NOT EXISTS tier_locked BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN affiliates.tier_locked IS
  'Quando TRUE, protege commission_tier de recálculo automático (trigger update_affiliate_tier e cron cron_update_affiliate_tiers). Use para overrides administrativos que não devem ser rebaixados pela regra automática (faixas 0-19/20-49/50+).';

-- ============================================
-- Trigger atualizado: respeita tier_locked
-- ============================================
CREATE OR REPLACE FUNCTION update_affiliate_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tier_locked IS TRUE THEN
    NEW.commission_tier = OLD.commission_tier;
  ELSE
    NEW.commission_tier = calculate_commission_tier(NEW.paid_subscriptions_count);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Cron atualizado: respeita tier_locked
-- Locked: só sincroniza paid_subscriptions_count.
-- Unlocked: atualiza tier + count normalmente.
-- ============================================
CREATE OR REPLACE FUNCTION cron_update_affiliate_tiers()
RETURNS void AS $$
DECLARE
  v_affiliate RECORD;
  v_paid_count INTEGER;
  v_new_tier INTEGER;
BEGIN
  FOR v_affiliate IN
    SELECT id, commission_tier, paid_subscriptions_count, tier_locked
    FROM affiliates
  LOOP
    SELECT COUNT(DISTINCT subscription_id)
    INTO v_paid_count
    FROM transactions
    WHERE affiliate_id = v_affiliate.id
      AND type = 'commission'
      AND subscription_id IS NOT NULL;

    IF v_paid_count >= 50 THEN
      v_new_tier := 3;
    ELSIF v_paid_count >= 20 THEN
      v_new_tier := 2;
    ELSE
      v_new_tier := 1;
    END IF;

    IF v_affiliate.tier_locked THEN
      IF v_affiliate.paid_subscriptions_count <> v_paid_count THEN
        UPDATE affiliates
        SET paid_subscriptions_count = v_paid_count,
            updated_at = NOW()
        WHERE id = v_affiliate.id;
      END IF;
    ELSE
      IF v_affiliate.commission_tier <> v_new_tier
         OR v_affiliate.paid_subscriptions_count <> v_paid_count THEN
        UPDATE affiliates
        SET commission_tier = v_new_tier,
            paid_subscriptions_count = v_paid_count,
            updated_at = NOW()
        WHERE id = v_affiliate.id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cron_update_affiliate_tiers IS
  'Atualiza commission_tier e paid_subscriptions_count diariamente. Respeita affiliates.tier_locked: quando TRUE, mantém o tier intocado e só sincroniza o contador.';
