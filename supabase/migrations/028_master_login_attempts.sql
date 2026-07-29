-- ============================================
-- Migration 028: auditoria e rate limit do master-login
-- ============================================
--
-- /api/auth/master-login troca a senha mestra por uma sessão de qualquer
-- e-mail. É um endpoint anônimo por natureza (é o próprio login), então não dá
-- pra exigir sessão de admin. O que dá é: registrar cada tentativa e usar esse
-- registro pra travar brute force por IP.
--
-- Escrita só via service_role (a rota usa a service key). Leitura só admin.
-- ============================================

CREATE TABLE IF NOT EXISTS master_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_email TEXT,
  ip TEXT,
  user_agent TEXT,
  -- true = senha mestra aceita (impersonação autorizada); false = senha errada.
  success BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice do rate limit: falhas recentes por IP.
CREATE INDEX IF NOT EXISTS idx_master_login_attempts_ip
  ON master_login_attempts(ip, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_master_login_attempts_created
  ON master_login_attempts(created_at DESC);

ALTER TABLE master_login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "master_login_attempts_select_admin" ON master_login_attempts;
CREATE POLICY "master_login_attempts_select_admin" ON master_login_attempts
  FOR SELECT USING (is_admin());

COMMENT ON TABLE master_login_attempts IS
  'Trilha de auditoria de /api/auth/master-login: cada uso da senha mestra e cada tentativa falha. Base do rate limit por IP. Migration 028.';
