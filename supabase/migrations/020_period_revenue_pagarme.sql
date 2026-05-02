-- Adiciona coluna pra cachear o faturamento (saques considerados) da Pagar.me
-- por período no fechamento financeiro.
--
-- Regra: saque PagarMe = cobrança paga (status = paid) com metadata.product_id
-- = "9f335cab-b137-4d18-bf59-935a6e46b30c" e paid_at + 8 dias dentro do mês
-- calendário em BRT (UTC-3). Ver src/app/api/admin/financeiro/route.ts.

ALTER TABLE period_revenue
  ADD COLUMN IF NOT EXISTS pagarme_revenue_cents BIGINT NOT NULL DEFAULT 0;
