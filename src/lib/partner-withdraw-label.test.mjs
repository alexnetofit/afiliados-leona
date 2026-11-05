import assert from "node:assert/strict";
import test from "node:test";
import { partnerWithdrawLabel } from "./withdraw-balance.ts";

test("saque ainda pendente no Asaas não aparece como pago", () => {
  assert.equal(partnerWithdrawLabel("paid", "processing"), "pendente");
  assert.equal(partnerWithdrawLabel("available", "processing"), "pendente");
  assert.equal(partnerWithdrawLabel("paid", "pending"), "pendente");
});

test("depois da aprovação no Asaas fica aprovado", () => {
  assert.equal(partnerWithdrawLabel("paid", "paid"), "aprovado");
  assert.equal(partnerWithdrawLabel("available", "paid"), "aprovado");
});

test("período antigo sem saque aberto continua pago ou disponível", () => {
  assert.equal(partnerWithdrawLabel("paid", undefined), "pago");
  assert.equal(partnerWithdrawLabel("available", undefined), "disponivel");
  assert.equal(partnerWithdrawLabel("pending", undefined), "aguardando_liberacao");
  assert.equal(partnerWithdrawLabel("available", "failed"), "falhou");
});
