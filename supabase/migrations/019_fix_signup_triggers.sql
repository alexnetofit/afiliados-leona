-- ============================================
-- Migration 019: Corrigir "Database error saving new user"
-- ============================================
-- Causa raiz:
--   No signup, o Supabase Auth executa as triggers em auth.users no contexto
--   do role supabase_auth_admin. As funções handle_new_user e handle_new_profile
--   foram criadas em 001 como SECURITY DEFINER, porém SEM search_path fixo e
--   SEM GRANT explícito para supabase_auth_admin nas tabelas alvo. Quando o
--   Supabase atualizou o modelo de permissões, o supabase_auth_admin perdeu
--   acesso ao schema public e qualquer INSERT da trigger passou a falhar,
--   fazendo o GoTrue devolver o erro genérico "Database error saving new user".
--
-- Esta migration:
--   1. Recria as funções com SECURITY DEFINER + search_path fixo.
--   2. Torna as triggers idempotentes (ON CONFLICT DO NOTHING) para evitar
--      bloqueio se o usuário tentar reenviar o cadastro.
--   3. Concede USAGE no schema public e privilégios nas tabelas profiles/
--      affiliates para supabase_auth_admin, que é quem roda a trigger.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := upper(substr(md5(random()::text), 1, 8));
    SELECT EXISTS(SELECT 1 FROM affiliates WHERE affiliate_code = new_code)
      INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;

  INSERT INTO public.affiliates (user_id, affiliate_code)
  VALUES (NEW.id, new_code)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE ON public.affiliates TO supabase_auth_admin;
