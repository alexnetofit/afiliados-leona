import assert from "node:assert/strict";
import test from "node:test";
import { panelCashCents } from "./withdraw-balance.ts";

const released = 87011;
const buckets = {
  "20/05/2026": 11021,
  "05/06/2026": 5326,
  "20/06/2026": 17456,
  "05/07/2026": 9695,
  "05/08/2026": 17883,
  "20/08/2026": 1453,
  "05/09/2026": 12359,
  "05/10/2026": 3543,
  "05/11/2026": 3543,
  "20/11/2026": 4732,
};
const paid = [
  ["20/05/2026", "R$\u00a0110,21"],
  ["05/06/2026", "R$ 53,26"],
  ["20/06/2026", "R$ 174,56"],
  ["05/07/2026", "R$ 96,95"],
  ["05/08/2026", "R$ 178,83"],
  ["05/09/2026", "R$ 138,12"],
  ["05/10/2026", "R$ 35,43"],
].map(([date, amount_text]) => ({ status: "paid", amount_text, date }));

test("desconta o valor sacado, inclusive o período que saiu junto", () => {
  const cash = panelCashCents(
    released,
    paid.map(({ status, amount_text }) => ({ status, amount_text }))
  );
  assert.equal(cash.availableCents, 8275);
  assert.equal(cash.receivedCents, 78736);

  const byDateOnly = paid.reduce((sum, row) => sum + (buckets[row.date] || 0), 0);
  assert.equal(released - byDateOnly, 9728);
});

test("saque em processamento reserva o saldo e ainda não entra como recebido", () => {
  const cash = panelCashCents(released, [
    ...paid.map(({ status, amount_text }) => ({ status, amount_text })),
    { status: "processing", amount_text: "R$ 82,75" },
  ]);
  assert.equal(cash.availableCents, 0);
  assert.equal(cash.receivedCents, 78736);
});
