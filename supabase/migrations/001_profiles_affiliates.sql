-- ============================================
-- Migration 001: Profiles e Affiliates
-- ============================================

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'affiliate' CHECK (role IN ('affiliate', 'admin')),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para criar profile automaticamente quando user é criado
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Affiliates
-- ============================================

CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  affiliate_code TEXT NOT NULL UNIQUE,
  commission_tier INTEGER DEFAULT 1 CHECK (commission_tier IN (1, 2, 3)),
  paid_subscriptions_count INTEGER DEFAULT 0,
  payout_pix_key TEXT,
  payout_wise_details JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para busca por código
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_user ON affiliates(user_id);

DROP TRIGGER IF EXISTS update_affiliates_updated_at ON affiliates;
CREATE TRIGGER update_affiliates_updated_at
  BEFORE UPDATE ON affiliates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Funções de Comissão
-- ============================================

-- Função para calcular tier baseado em assinaturas pagas
CREATE OR REPLACE FUNCTION calculate_commission_tier(subs_count INTEGER)
RETURNS INTEGER AS $$
BEGIN
  IF subs_count >= 50 THEN RETURN 3; -- 40%
  ELSIF subs_count >= 20 THEN RETURN 2; -- 35%
  ELSE RETURN 1; -- 30%
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para obter percentual por tier
CREATE OR REPLACE FUNCTION get_commission_percent(tier INTEGER)
RETURNS INTEGER AS $$
BEGIN
  CASE tier
    WHEN 3 THEN RETURN 40;
    WHEN 2 THEN RETURN 35;
    ELSE RETURN 30;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar tier quando paid_subscriptions_count muda
CREATE OR REPLACE FUNCTION update_affiliate_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.commission_tier = calculate_commission_tier(NEW.paid_subscriptions_count);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_affiliate_tier_trigger ON affiliates;
CREATE TRIGGER update_affiliate_tier_trigger
  BEFORE UPDATE OF paid_subscriptions_count ON affiliates
  FOR EACH ROW EXECUTE FUNCTION update_affiliate_tier();

-- Função para criar affiliate automaticamente após profile (se role = affiliate)
CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Gerar código único
  LOOP
    new_code := upper(substr(md5(random()::text), 1, 8));
    SELECT EXISTS(SELECT 1 FROM affiliates WHERE affiliate_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  -- Criar affiliate
  INSERT INTO public.affiliates (user_id, affiliate_code)
  VALUES (NEW.id, new_code);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW 
  WHEN (NEW.role = 'affiliate')
  EXECUTE FUNCTION handle_new_profile();
