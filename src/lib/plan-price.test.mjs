import assert from "node:assert/strict";
import test from "node:test";
import { activePlanMrrCents, monthlyPlanCents, planCommissionCents } from "./plan-price.ts";

test("preço do plano por quantidade de instâncias", () => {
  assert.equal(monthlyPlanCents(0), 0);
  assert.equal(monthlyPlanCents(1), 12700);
  assert.equal(monthlyPlanCents(2), 19800);
  assert.equal(monthlyPlanCents(3), 29700);
  assert.equal(monthlyPlanCents(4), 31600);
  assert.equal(monthlyPlanCents(10), 79000);
  assert.equal(monthlyPlanCents(22), 173800);
});

test("comissão do plano usa a faixa atual", () => {
  assert.equal(planCommissionCents(12700, 3), 4724);
  assert.equal(planCommissionCents(12700, 1), 3543);
  assert.equal(planCommissionCents(0, 3), 0);
});

test("MRR soma o plano e ignora upgrade quando o plano está gravado", () => {
  const subs = [
    { id: "cheia", status: "active", plan_instances: 10, plan_monthly_cents: 79000 },
    { id: "upgrade", status: "active", plan_instances: 1, plan_monthly_cents: 12700 },
    { id: "zerada", status: "active", plan_instances: 0, plan_monthly_cents: 0 },
    { id: "antiga", status: "active", plan_instances: null, plan_monthly_cents: null },
    { id: "vencida", status: "past_due", plan_instances: 5, plan_monthly_cents: 39500 },
  ];
  const last = (id) => (id === "antiga" ? 4724 : 1300);
  assert.equal(activePlanMrrCents(subs, last, 3), 29388 + 4724 + 0 + 4724);
});
