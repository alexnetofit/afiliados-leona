-- =====================================================================
-- Compensação do fechamento de Março/2026 no fechamento de Abril/2026
-- =====================================================================
--
-- Contexto:
--   Antes da paginação ser implementada em /admin/financeiro, a query de
--   transações era truncada em 1000 linhas pelo PostgREST. Isso fazia o
--   "Custo afiliados" do fechamento aparecer SUBESTIMADO. Em Março/2026,
--   o número que apareceu no momento da distribuição de lucro foi
--   R$ 37.097,09, mas o real era R$ 44.980,31. Diferença = R$ 7.883,22
--   pagos a mais aos sócios.
--
--   Em vez de pedir o dinheiro de volta dos sócios, o ajuste é lançado
--   como custo manual no fechamento de Abril/2026 — o lucro de Abril
--   fica reduzido em R$ 7.883,22, compensando o excedente distribuído
--   em Março.
--
-- Roda este bloco UMA ÚNICA VEZ no SQL Editor do Supabase.
-- =====================================================================

INSERT INTO admin_costs (period_label, category, description, amount_cents)
VALUES (
  '2026-04',
  'Pessoal',
  'Ajuste do fechamento de Março/2026 (custo de afiliados estava subestimado em R$ 7.883,22 por bug de paginação)',
  788322
);

-- Verificação
SELECT id, period_label, category, description, amount_cents / 100.0 AS valor_brl, created_at
FROM admin_costs
WHERE period_label = '2026-04'
ORDER BY created_at DESC
LIMIT 5;
