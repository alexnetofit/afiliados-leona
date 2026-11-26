import assert from "node:assert/strict";
import test from "node:test";
import { clearPtaxCache, sumWiseBrl, usdToBrlPtax } from "./ptax.ts";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function quote(rate) {
  return jsonResponse({ value: [{ cotacaoVenda: rate }] });
}

test("dia sem cotação não soma como real zero", () => {
  const total = sumWiseBrl(
    [
      { amountUsd: 10, day: "2026-03-06" },
      { amountUsd: 5, day: "2026-03-07" },
    ],
    (day) => (day === "2026-03-06" ? 5.2 : null)
  );
  assert.equal(total, null);

  const ok = sumWiseBrl(
    [
      { amountUsd: 10, day: "2026-03-06" },
      { amountUsd: -5, day: "2026-03-08" },
    ],
    (day) => (day === "2026-03-06" ? 5.2 : 5.1)
  );
  assert.equal(ok, 10 * 5.2 + 5 * 5.1);
});

test("429 no dia do gasto não usa a cotação de outro dia nem fica no cache", async () => {
  clearPtaxCache();
  const original = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (urls.length < 3) return jsonResponse({ value: [] }, 429);
    return quote(5.2878);
  };

  try {
    const rate = await usdToBrlPtax("2026-03-06");
    assert.equal(rate, 5.2878);
    assert.equal(urls.length, 3);
    for (const url of urls) {
      assert.match(url, /03-06-2026/);
      assert.doesNotMatch(url, /03-05-2026/);
    }

    urls.length = 0;
    const again = await usdToBrlPtax("2026-03-06");
    assert.equal(again, 5.2878);
    assert.equal(urls.length, 0);
  } finally {
    globalThis.fetch = original;
    clearPtaxCache();
  }
});

test("fim de semana cai no dia útil anterior e falha de rede não fica gravada", async () => {
  clearPtaxCache();
  const original = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    const text = String(url);
    urls.push(text);
    if (text.includes("03-08-2026") || text.includes("03-07-2026")) {
      return jsonResponse({ value: [] });
    }
    if (text.includes("03-06-2026")) return quote(5.2878);
    return jsonResponse({ value: [] }, 429);
  };

  try {
    const weekend = await usdToBrlPtax("2026-03-08");
    assert.equal(weekend, 5.2878);
    assert.match(urls[0], /03-08-2026/);
    assert.match(urls.at(-1), /03-06-2026/);

    urls.length = 0;
    const failed = await usdToBrlPtax("2026-05-04");
    assert.equal(failed, null);
    const callsAfterFailure = urls.length;
    assert.ok(callsAfterFailure >= 3);

    const retried = await usdToBrlPtax("2026-05-04");
    assert.equal(retried, null);
    assert.ok(urls.length > callsAfterFailure);
  } finally {
    globalThis.fetch = original;
    clearPtaxCache();
  }
});
