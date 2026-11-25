import assert from "node:assert/strict";
import test from "node:test";
import {
  attachSubscriptionToUnlinkedSale,
  upsertSubscriptionFromLeonaAndGuru,
} from "./guru-subscription-sync.ts";

function profile(accountId = "19887") {
  return {
    account_id: accountId,
    subscription_status: "active",
    current_period_end: null,
    rewardful_referral: "raphaela-thaine",
    user: { email: "dono@leona.com", name: "Dono" },
  };
}

function fakeSupabase(handlers) {
  const calls = [];
  let read = 0;
  function from(table) {
    const query = { table, filters: [], op: "select" };
    const api = {
      select() {
        return api;
      },
      eq(column, value) {
        query.filters.push(["eq", column, value]);
        return api;
      },
      is(column, value) {
        query.filters.push(["is", column, value]);
        return api;
      },
      update(payload) {
        query.op = "update";
        query.payload = payload;
        return api;
      },
      insert(payload) {
        query.op = "insert";
        query.payload = payload;
        return api;
      },
      maybeSingle() {
        calls.push({ ...query, filters: [...query.filters] });
        return Promise.resolve(handlers.read(read++, query));
      },
      single() {
        calls.push({ ...query, filters: [...query.filters] });
        return Promise.resolve(handlers.insert(query));
      },
      then(resolve, reject) {
        calls.push({ ...query, filters: [...query.filters] });
        return Promise.resolve(
          query.op === "update" ? handlers.update(query) : { error: null }
        ).then(resolve, reject);
      },
    };
    return api;
  }
  return { from, calls };
}

test("corrida no índice único devolve a assinatura que o outro webhook criou", async () => {
  const db = fakeSupabase({
    read(n) {
      if (n === 0) return { data: null, error: null };
      return { data: { id: "sub-criada", stripe_subscription_id: null }, error: null };
    },
    insert() {
      return { data: null, error: { code: "23505", message: "duplicate leona_account_id" } };
    },
    update() {
      return { error: null };
    },
  });

  const id = await upsertSubscriptionFromLeonaAndGuru(db, {
    affiliateId: "aff-1",
    profile: profile(),
    amountCentsFromGuru: 12700,
  });

  assert.equal(id, "sub-criada");
  assert.equal(db.calls.filter((call) => call.op === "update").length, 1);
});

test("assinatura Stripe existente recebe a comissão sem ser reescrita", async () => {
  const db = fakeSupabase({
    read() {
      return { data: { id: "sub-stripe", stripe_subscription_id: "sub_stripe" }, error: null };
    },
    insert() {
      throw new Error("não deveria inserir");
    },
    update() {
      throw new Error("não deveria atualizar");
    },
  });

  const id = await upsertSubscriptionFromLeonaAndGuru(db, {
    affiliateId: "aff-1",
    profile: profile(),
    amountCentsFromGuru: 12700,
  });

  assert.equal(id, "sub-stripe");
  assert.equal(db.calls.length, 1);
});

test("reenvio pendura a comissão solta e a do gerente", async () => {
  const db = fakeSupabase({
    read() {
      return { data: null, error: null };
    },
    insert() {
      return { data: null, error: null };
    },
    update() {
      return { error: null };
    },
  });

  await attachSubscriptionToUnlinkedSale(db, "pagou:pagarme:or_1", "sub-1");

  const updates = db.calls.filter((call) => call.op === "update");
  assert.equal(updates.length, 2);
  assert.deepEqual(updates[0].filters, [
    ["eq", "guru_transaction_id", "pagou:pagarme:or_1"],
    ["is", "subscription_id", null],
  ]);
  assert.deepEqual(updates[1].filters, [
    ["eq", "stripe_invoice_id", "guru:pagou:pagarme:or_1_mgr"],
    ["is", "subscription_id", null],
  ]);
  assert.equal(updates[0].payload.subscription_id, "sub-1");
});
