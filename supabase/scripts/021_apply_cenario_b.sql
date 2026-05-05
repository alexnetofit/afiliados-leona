-- =====================================================================
-- Cenário B — Aplicação consolidada (rodar TUDO de uma vez no SQL Editor)
-- =====================================================================
-- O que faz, em ordem:
--   1) Migration 021: adiciona coluna affiliates.tier_locked (default false)
--   2) Reescreve trigger update_affiliate_tier para respeitar tier_locked
--   3) Reescreve cron_update_affiliate_tiers para respeitar tier_locked
--   4) Marca tier_locked=TRUE em 40 afiliados que têm tier override admin
--      acima do tier natural (protege de rebaixamento futuro pelo cron/trigger)
--   5) Reconcilia paid_subscriptions_count em 104 afiliados desalinhados.
--      Como os 40 overrides já estão locked, NENHUM deles vai ser rebaixado.
--      Apenas o afiliado 826A8C75 (atual tier 1, real_count 33) é
--      auto-promovido para tier 2 pelo trigger — único ajuste financeiro.
--
-- Tudo dentro de uma única transação. Se algo falhar, rollback automático.
-- =====================================================================

BEGIN;

-- ============================================
-- 1) DDL: tier_locked
-- ============================================
ALTER TABLE affiliates
  ADD COLUMN IF NOT EXISTS tier_locked BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN affiliates.tier_locked IS
  'Quando TRUE, protege commission_tier de recálculo automático (trigger update_affiliate_tier e cron cron_update_affiliate_tiers). Use para overrides administrativos que não devem ser rebaixados pela regra automática (faixas 0-19/20-49/50+).';

-- ============================================
-- 2) Trigger atualizado: respeita tier_locked
-- ============================================
CREATE OR REPLACE FUNCTION update_affiliate_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tier_locked IS TRUE THEN
    NEW.commission_tier := OLD.commission_tier;
  ELSE
    NEW.commission_tier := calculate_commission_tier(NEW.paid_subscriptions_count);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3) Cron atualizado: respeita tier_locked
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

-- ============================================
-- 4) Lockar overrides admin (40 afiliados)
-- ============================================
UPDATE affiliates
SET tier_locked = TRUE,
    updated_at = NOW()
WHERE id IN (
  '530d7d04-37b3-49f5-99d0-e17dcd119510',
  '26ad07af-4402-4535-a093-3fc3a87c450c',
  '2bd772f2-322a-459d-8491-0a6dd8fb196b',
  'ef42531b-7e76-4839-83f6-c9119f049646',
  'b64d4262-faff-4be3-88e5-455941bdb204',
  '5661d79c-7627-4175-9a28-635a8ead0a93',
  '1893cc5e-21e9-4bc8-bc6c-ebefb326c3b7',
  '5af229b5-8427-4f6d-9a0d-67d53fe7fb8e',
  '88d28308-b506-4ddb-b73d-8a1b71a96dba',
  '7a7491f2-117e-46fc-b5f6-2632b126a205',
  'bfd582b0-7545-4346-997b-93e91608f07e',
  '2ad890d0-9437-4223-bcce-63420bb2e056',
  '329f4672-473e-42e9-acf6-e875dd0abab0',
  'e3a4304f-9a05-4a53-b35f-412942237aeb',
  '41090cbc-ab62-4825-a8d8-5115ab47d827',
  '52cbfe14-44f1-4b7a-bec2-905f771e8755',
  '8f7c93e7-2173-485d-9006-56cba24ff29b',
  'bd867edc-95df-4b25-8447-aacbc4bb667b',
  '4159be03-62a4-4819-a88a-39ed615a4591',
  '91c92e25-f56e-48f8-b889-ab98c8f80d1d',
  '88109ffe-e90a-4d15-8b9c-acec73e1d429',
  'a888104a-d073-4a4d-88be-64c2e46d9304',
  '884680d0-cc7b-4e14-bd00-383a0ca9beb8',
  '52803357-b599-48d0-bed6-22939fb9c0bf',
  'e0fae7a9-d652-484a-9353-04dc836d3e0e',
  '58b0beba-4a58-4339-973a-85809b7e0b7f',
  '595782aa-870e-49ad-af83-ee5e1677af90',
  'b940175c-db56-42dd-8c73-e47cb3a4f93b',
  '78e1f5f5-1034-4e7c-aa87-47822b84b0df',
  'c73e7b12-d668-481f-a2ef-a8a49120f587',
  '01601d26-dc91-4294-a4a1-6f64748852de',
  'a1414495-5c75-420b-ae20-f3cfb15a143b',
  'cae7b405-78e3-472f-9d29-4ccd46b978a0',
  '99fc6a1f-7aa6-48fa-aca2-f2ce09ca706a',
  '86658336-7aa6-4583-997f-2fd6517db9bf',
  '855900fa-445d-48ca-8d95-74214296adcc',
  '152f7969-18c7-48cd-9752-0315e77da7e5',
  '10623150-cc3b-4036-9f47-2b0e8aa4922d',
  'f5b7e331-0a30-4681-bb15-de8fe340df4e',
  '96ff7b74-0270-4de0-8320-2dbe8e93d4c6'
);

-- ============================================
-- 5) Reconciliar paid_subscriptions_count (104 afiliados)
--    Locks aplicados acima protegem os overrides.
--    Apenas 826A8C75 (não locked) será auto-promovido tier 1 → 2.
-- ============================================
UPDATE affiliates a
SET paid_subscriptions_count = v.real_count,
    updated_at = NOW()
FROM (VALUES
  ('4a82d9eb-bce3-415d-86c8-c4c7fb9e60db'::uuid, 5),
  ('ff6b62a0-b7c2-4bf8-b653-f20570885b88'::uuid, 33),
  ('36d04762-262e-4ecb-b6e8-24b0d2bf6536'::uuid, 10),
  ('4ed3dd91-7360-4ddf-b1bc-e5bf54e7abde'::uuid, 2),
  ('b878cd87-e4c8-472f-b870-ed7e39542a14'::uuid, 1),
  ('9371c917-30bd-4b1e-9688-9910cff7487f'::uuid, 1),
  ('ef42531b-7e76-4839-83f6-c9119f049646'::uuid, 6),
  ('cc085b5b-cb06-46b2-b058-0f270c2296df'::uuid, 2),
  ('1e49e8ae-4048-4fad-9b37-07c041cbebcf'::uuid, 213),
  ('a9f8218c-b003-48c5-9886-578b3fb2eac6'::uuid, 2),
  ('71960584-b4d5-46a5-8c5d-d2473bd72bbe'::uuid, 5),
  ('8777cc50-8deb-48ac-956a-764e38433ad9'::uuid, 3),
  ('c9f00040-05d0-4ec1-bec4-3ba41b36420d'::uuid, 2),
  ('e2facde6-1a2c-4042-a5db-f5f09a569056'::uuid, 2),
  ('7f6cab47-141c-4759-b1a1-8feb73398289'::uuid, 17),
  ('a499592a-ac12-4328-8362-b301813e39e2'::uuid, 1),
  ('b7c207c0-f9c8-4c59-b579-51c1fc8e0c8d'::uuid, 2),
  ('09572a62-38f1-4fec-9cfd-be3c87fd28f9'::uuid, 5),
  ('8e4a6405-3003-4050-8ef1-acae8d4898f8'::uuid, 1),
  ('06358e8e-e3d2-4ea0-83cf-0b1daf64a83a'::uuid, 2),
  ('e3a4304f-9a05-4a53-b35f-412942237aeb'::uuid, 25),
  ('1dbee6cd-e3aa-403a-8652-8249918f87f8'::uuid, 2),
  ('99e09e3f-d4b1-4145-8fb6-cf71cf8cf753'::uuid, 7),
  ('8142bff8-a908-4a6e-b45c-1e619c3d9661'::uuid, 10),
  ('41b00d3b-ba0b-4809-b2cc-bf833d8b351d'::uuid, 4),
  ('5c1145b7-340d-43c9-a1d9-91d5dca215ad'::uuid, 5),
  ('9ac6e8cc-ecd6-4927-8762-5bd59db7b3bc'::uuid, 3),
  ('41090cbc-ab62-4825-a8d8-5115ab47d827'::uuid, 30),
  ('b686dca0-88b2-4273-8087-5a8800966462'::uuid, 11),
  ('082306f4-cdfd-485b-859f-97826d569d94'::uuid, 2),
  ('52cbfe14-44f1-4b7a-bec2-905f771e8755'::uuid, 10),
  ('82ecfc72-2ed8-4e7a-973b-0373f84949b9'::uuid, 19),
  ('4c8aad02-ecb6-435b-a579-8314cf6b3943'::uuid, 6),
  ('bd867edc-95df-4b25-8447-aacbc4bb667b'::uuid, 37),
  ('4159be03-62a4-4819-a88a-39ed615a4591'::uuid, 18),
  ('75f454b8-9712-4734-9f98-3279e6b3f815'::uuid, 8),
  ('83b52236-81bb-4765-8283-ecf22b764735'::uuid, 83),
  ('ce465971-10c3-45d2-8c6e-4ceb49baf5a0'::uuid, 3),
  ('97a813bc-ed6f-4ff7-b502-0d4d991bb022'::uuid, 5),
  ('d6c4e513-3e7e-45e4-99e2-f7f06ca3c0e4'::uuid, 5),
  ('91c92e25-f56e-48f8-b889-ab98c8f80d1d'::uuid, 19),
  ('88109ffe-e90a-4d15-8b9c-acec73e1d429'::uuid, 31),
  ('a888104a-d073-4a4d-88be-64c2e46d9304'::uuid, 14),
  ('26c885ac-b090-4d73-8cfd-6fa4b5f6fc87'::uuid, 8),
  ('884680d0-cc7b-4e14-bd00-383a0ca9beb8'::uuid, 47),
  ('b4a1ec8c-d450-4da8-8089-4b3a2608d9e1'::uuid, 394),
  ('2e58624c-341c-4a3a-b370-6447f3718306'::uuid, 6),
  ('e0fae7a9-d652-484a-9353-04dc836d3e0e'::uuid, 3),
  ('58b0beba-4a58-4339-973a-85809b7e0b7f'::uuid, 5),
  ('66aee3ca-8eee-46db-876b-053ac0145996'::uuid, 5),
  ('19d36129-cf6a-4be2-ac45-70accc6a77c0'::uuid, 3),
  ('1dd0ecce-c809-4ce6-a9bd-87d41c035d08'::uuid, 5),
  ('595782aa-870e-49ad-af83-ee5e1677af90'::uuid, 7),
  ('b940175c-db56-42dd-8c73-e47cb3a4f93b'::uuid, 2),
  ('78e1f5f5-1034-4e7c-aa87-47822b84b0df'::uuid, 2),
  ('01601d26-dc91-4294-a4a1-6f64748852de'::uuid, 4),
  ('a1414495-5c75-420b-ae20-f3cfb15a143b'::uuid, 10),
  ('cae7b405-78e3-472f-9d29-4ccd46b978a0'::uuid, 4),
  ('99fc6a1f-7aa6-48fa-aca2-f2ce09ca706a'::uuid, 24),
  ('70e48b3a-3839-4b5c-9544-34cd8de8aaba'::uuid, 2),
  ('b3f1de80-f102-43ef-b97b-a066b34494fe'::uuid, 6),
  ('3e5a56ce-a6dc-4ada-9b38-6a87baafdb6d'::uuid, 2),
  ('009691ce-7ac2-499a-927b-5165c47d4fd5'::uuid, 3),
  ('c19df4ec-643a-4957-9c5d-8c45361c25dc'::uuid, 2),
  ('e6953c45-acb0-46c1-8ada-ca68e443739e'::uuid, 2),
  ('25f21f78-98a7-46f9-877f-962fa960804a'::uuid, 4),
  ('f8db5a49-4634-4961-bf16-b07ab54aed2b'::uuid, 5),
  ('50710d91-fc55-4ab3-8467-79f2bb4da15c'::uuid, 6),
  ('df2c34c0-35ee-4d33-b57e-e2a72ed98e34'::uuid, 9),
  ('c3bc5837-ec7b-4abf-9ba1-e3f510d57f9e'::uuid, 4),
  ('86658336-7aa6-4583-997f-2fd6517db9bf'::uuid, 17),
  ('f68bd2af-7bfe-482e-890d-3e3797d217eb'::uuid, 5),
  ('01763c99-92bd-447b-894f-03ffd69e01bf'::uuid, 3),
  ('bd9da327-d207-4934-906c-517a8ea7d20c'::uuid, 2),
  ('e741c0b2-2639-4472-8e2a-6ae56e853df6'::uuid, 4),
  ('152f7969-18c7-48cd-9752-0315e77da7e5'::uuid, 1),
  ('426bd53c-2570-4a0c-a7d6-5d1de5bcfb07'::uuid, 9),
  ('51122f89-0ac6-4f68-bfdf-d4427f1a28e9'::uuid, 4),
  ('7c6348b1-5d01-4b04-8422-d2f227c650cf'::uuid, 1),
  ('10623150-cc3b-4036-9f47-2b0e8aa4922d'::uuid, 3),
  ('51b17fe8-83f1-4bd3-8aac-1ac4e748f1c9'::uuid, 1),
  ('67f3dc18-2e21-452b-a490-816e72342283'::uuid, 1),
  ('270d452d-d642-46bb-9055-8d274e35a4ac'::uuid, 213),
  ('d43b82eb-e68a-4730-9890-cfbcd84d656f'::uuid, 1),
  ('4223e20f-367d-452c-9e2d-cf4b39245cc5'::uuid, 10),
  ('ecaed42c-7dfb-47ff-8a75-2604e540950a'::uuid, 1),
  ('e823e826-0fbd-4668-a278-d7acefee01da'::uuid, 2),
  ('90e0584b-e9fc-4512-b65f-23f7c4d92887'::uuid, 1),
  ('5fb0870b-9033-4ffe-9c04-12a3639cfb5a'::uuid, 1),
  ('a9f367da-daa3-4265-9e81-0ce5851217d5'::uuid, 1),
  ('6742ae00-262a-4f92-8a3a-40a6f3d98532'::uuid, 65),
  ('bdd6626c-c490-4eef-8002-8ceecc842257'::uuid, 1),
  ('5498a139-9603-449b-9d22-98c1c79ca8e2'::uuid, 2),
  ('75432347-6cf0-4010-8036-efaf77009426'::uuid, 1),
  ('bbb8b085-73f0-4c1f-8b63-b324cd6e84f7'::uuid, 1),
  ('03bcff3c-6184-4d4a-b612-504cf4627302'::uuid, 1),
  ('aaa9a179-0523-4e4c-83fc-923077f09e7c'::uuid, 2),
  ('a90fd5c6-5f38-451d-a570-92d0aa6fd27a'::uuid, 2),
  ('d16666cb-0c1b-44f3-8134-c2ca7d068f6b'::uuid, 2),
  ('f5b7e331-0a30-4681-bb15-de8fe340df4e'::uuid, 1),
  ('f2b39ac1-0a20-4d14-ab5a-5cb364b572a6'::uuid, 1),
  ('46e04d4c-1333-447a-be78-a65736e1bd47'::uuid, 1),
  ('34766410-2560-4a58-82da-9f7b6cc84617'::uuid, 1),
  ('024b5271-9456-4207-abfb-2b5fc7a37c76'::uuid, 1)
) AS v(id, real_count)
WHERE a.id = v.id;

-- ============================================
-- Validações finais
-- ============================================
-- Quantos lockados?
DO $$
DECLARE
  v_locked INTEGER;
  v_826_tier INTEGER;
  v_826_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_locked FROM affiliates WHERE tier_locked = TRUE;
  RAISE NOTICE 'Afiliados com tier_locked = TRUE: %', v_locked;

  SELECT commission_tier, paid_subscriptions_count
    INTO v_826_tier, v_826_count
  FROM affiliates WHERE affiliate_code = '826A8C75';
  RAISE NOTICE '826A8C75: tier = %, count = % (esperado tier=2, count=33)', v_826_tier, v_826_count;
END $$;

COMMIT;
