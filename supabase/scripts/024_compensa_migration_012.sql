-- ============================================================================
-- Script 024: Compensação retroativa - Migration 012 vs withdraw_requests
-- ============================================================================
--
-- Para cada saque pago/processing cujo `amount_text` (gravado em valor BRUTO
-- antes do recálculo de 0.93 da migration 012) é maior que a soma atual das
-- transactions do mesmo `date_label` (já em valor LÍQUIDO), insere uma
-- entrada em `withdraw_balance_adjustments` por afiliado, agregando todas as
-- diferenças. Isso restaura o saldo disponível dos afetados.
--
-- Critério: só compensa diferenças >= 50 cents pra cortar ruído de
-- arredondamento. Idempotente via reference_code='migration-012-comp-v1'.
--
-- Pra rodar, copie o conteúdo no SQL Editor do Supabase ou aplique via
-- supabase db execute. Não é uma migration porque é one-shot de dados.
-- ============================================================================

WITH wr_parsed AS (
  SELECT
    wr.affiliate_id,
    wr.date_label,
    ROUND(
      replace(regexp_replace(wr.amount_text, '[^0-9,]', '', 'g'), ',', '.')::NUMERIC * 100
    )::INTEGER AS sacado_cents
  FROM withdraw_requests wr
  WHERE wr.status IN ('paid', 'processing')
    AND wr.amount_text IS NOT NULL
    AND wr.date_label IS NOT NULL
),
bucket_sums AS (
  SELECT
    t.affiliate_id,
    TO_CHAR(t.available_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY') AS date_label,
    SUM(t.commission_amount_cents)::INTEGER AS bucket_cents
  FROM transactions t
  WHERE t.available_at IS NOT NULL
  GROUP BY t.affiliate_id, TO_CHAR(t.available_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')
),
diffs AS (
  SELECT
    w.affiliate_id,
    SUM(w.sacado_cents - COALESCE(b.bucket_cents, 0))::INTEGER AS total_diff_cents
  FROM wr_parsed w
  LEFT JOIN bucket_sums b
    ON b.affiliate_id = w.affiliate_id AND b.date_label = w.date_label
  WHERE w.sacado_cents > COALESCE(b.bucket_cents, 0) + 50
  GROUP BY w.affiliate_id
)
INSERT INTO withdraw_balance_adjustments
  (affiliate_id, amount_cents, reason, reference_code, created_by_admin)
SELECT
  d.affiliate_id,
  d.total_diff_cents,
  'Compensação retroativa de saques anteriores ao recálculo automático da taxa do gateway (Migration 012, mar/2026). Os saques antigos foram pagos sobre o valor bruto e o sistema passou a deduzir o valor líquido — esta entrada zera essa diferença.',
  'migration-012-comp-v1',
  'system-script-024'
FROM diffs d
WHERE NOT EXISTS (
  SELECT 1 FROM withdraw_balance_adjustments wba
  WHERE wba.affiliate_id = d.affiliate_id
    AND wba.reference_code = 'migration-012-comp-v1'
);

-- Para auditoria, mostra o que foi inserido:
SELECT
  a.id AS affiliate_id,
  u.email,
  wba.amount_cents,
  (wba.amount_cents / 100.0)::TEXT AS amount_brl,
  wba.created_at
FROM withdraw_balance_adjustments wba
JOIN affiliates a ON a.id = wba.affiliate_id
JOIN auth.users u ON u.id = a.user_id
WHERE wba.reference_code = 'migration-012-comp-v1'
ORDER BY wba.amount_cents DESC;
