import assert from "node:assert/strict";
import test from "node:test";
import {
  activityStatus,
  activityStatusForSubscriptions,
} from "./subscription-activity.ts";

const NOW = Date.parse("2026-11-25T15:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function paidDaysAgo(days, extra = {}) {
  return {
    subscription_id: "sub-1",
    type: "commission",
    paid_at: new Date(NOW - days * DAY).toISOString(),
    guru_transaction_id: "tx-1",
    stripe_invoice_id: null,
    ...extra,
  };
}

test("pagamento nos últimos 31 dias fica ativo", () => {
  assert.equal(activityStatus({ id: "sub-1" }, [paidDaysAgo(10)], NOW), "active");
  assert.equal(activityStatus({ id: "sub-1" }, [paidDaysAgo(31)], NOW), "active");
});

test("entre 31 e 35 dias fica vencido e depois cancelado", () => {
  assert.equal(
    activityStatus({ id: "sub-1" }, [paidDaysAgo(31 + 1 / 24)], NOW),
    "past_due"
  );
  assert.equal(activityStatus({ id: "sub-1" }, [paidDaysAgo(35)], NOW), "past_due");
  assert.equal(
    activityStatus({ id: "sub-1" }, [paidDaysAgo(35 + 1 / 24)], NOW),
    "canceled"
  );
});

test("estorno e disputa tiram o pagamento da conta", () => {
  const refunded = [
    paidDaysAgo(5),
    {
      subscription_id: "sub-1",
      type: "refund",
      paid_at: new Date(NOW - 1 * DAY).toISOString(),
      stripe_invoice_id: "guru_refund:tx-1",
    },
  ];
  assert.equal(activityStatus({ id: "sub-1" }, refunded, NOW), "canceled");

  const disputed = [
    paidDaysAgo(3, { guru_transaction_id: "tx-d", stripe_invoice_id: "in_1" }),
    {
      subscription_id: "sub-1",
      type: "dispute",
      paid_at: new Date(NOW).toISOString(),
      stripe_invoice_id: "guru_dispute:tx-d",
    },
  ];
  assert.equal(activityStatus({ id: "sub-1" }, disputed, NOW), "canceled");

  const stripeRefund = [
    paidDaysAgo(4, { guru_transaction_id: null, stripe_invoice_id: "in_9" }),
    {
      subscription_id: "sub-1",
      type: "refund",
      paid_at: new Date(NOW).toISOString(),
      stripe_invoice_id: "in_9_refund",
    },
  ];
  assert.equal(activityStatus({ id: "sub-1" }, stripeRefund, NOW), "canceled");
});

test("estorno do ciclo atual usa o pagamento anterior que ficou de pé", () => {
  const payments = [
    paidDaysAgo(40, { guru_transaction_id: "tx-old" }),
    paidDaysAgo(6, { guru_transaction_id: "tx-new" }),
    {
      subscription_id: "sub-1",
      type: "refund",
      paid_at: new Date(NOW - 1 * DAY).toISOString(),
      stripe_invoice_id: "guru_refund:tx-new",
    },
  ];
  assert.equal(activityStatus({ id: "sub-1" }, payments, NOW), "canceled");

  const keptRecent = [
    paidDaysAgo(20, { guru_transaction_id: "tx-old" }),
    paidDaysAgo(2, { guru_transaction_id: "tx-new" }),
    {
      subscription_id: "sub-1",
      type: "refund",
      paid_at: new Date(NOW).toISOString(),
      stripe_invoice_id: "guru_refund:tx-new",
    },
  ];
  assert.equal(activityStatus({ id: "sub-1" }, keptRecent, NOW), "active");
});

test("trial sem pagamento segue em trial só enquanto não venceu", () => {
  assert.equal(
    activityStatus(
      { id: "sub-1", is_trial: true, trial_end: new Date(NOW + DAY).toISOString() },
      [],
      NOW
    ),
    "trialing"
  );
  assert.equal(
    activityStatus(
      { id: "sub-1", status: "trialing", trial_end: new Date(NOW - DAY).toISOString() },
      [],
      NOW
    ),
    "canceled"
  );
});

test("pagamento recente vence o status antigo do gateway", () => {
  const map = activityStatusForSubscriptions(
    [{ id: "sub-1", status: "canceled" }, { id: "sub-2", status: "active" }],
    [paidDaysAgo(2)],
    NOW
  );
  assert.equal(map.get("sub-1"), "active");
  assert.equal(map.get("sub-2"), "canceled");
});
