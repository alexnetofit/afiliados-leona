/**
 * Configuração das contas Asaas usadas para pagar comissão dos afiliados.
 *
 * - 'solucoes' (An Soluções Digitais, CNPJ 56.021.532/0001-60) é a PRIMÁRIA.
 *    Mesmo CNPJ que figura como producer no Guru, então é o titular natural
 *    das vendas.
 * - 'cursos' é legado — usada só para validar webhooks de transferência.
 *   Saques de afiliados usam exclusivamente 'solucoes' (sem failover).
 *
 * Compatibilidade: enquanto o deploy nas envs novas (`_SOLUCOES`/`_CURSOS`)
 * não é concluído, ainda lemos as envs antigas (`ASAAS_API_KEY` /
 * `ASAAS_WEBHOOK_TOKEN`) como fallback pra não dar downtime.
 */

export type AsaasAccountId = "solucoes" | "cursos";

export type AsaasAccount = {
  id: AsaasAccountId;
  label: string;
  apiKey: string;
  webhookToken: string | null;
};

const ASAAS_BASE_URL = "https://api.asaas.com";

function readAccount(
  id: AsaasAccountId,
  label: string,
  apiKeyEnvs: string[],
  tokenEnvs: string[]
): AsaasAccount | null {
  const apiKey = apiKeyEnvs.map((k) => process.env[k]).find((v) => v && v.trim().length > 0);
  if (!apiKey) return null;
  const webhookToken =
    tokenEnvs.map((k) => process.env[k]).find((v) => v && v.trim().length > 0) ?? null;
  return { id, label, apiKey, webhookToken };
}

function readSolucoesAccount(): AsaasAccount | null {
  return readAccount(
    "solucoes",
    "Asaas An Soluções",
    ["ASAAS_API_KEY_SOLUCOES"],
    ["ASAAS_WEBHOOK_TOKEN_SOLUCOES"]
  );
}

function readCursosAccount(): AsaasAccount | null {
  return readAccount(
    "cursos",
    "Asaas An Cursos",
    ["ASAAS_API_KEY_CURSOS", "ASAAS_API_KEY"],
    ["ASAAS_WEBHOOK_TOKEN_CURSOS", "ASAAS_WEBHOOK_TOKEN"]
  );
}

/** Conta usada para pagar comissões de afiliados (somente An Soluções). */
export function getWithdrawAsaasAccounts(): AsaasAccount[] {
  const solucoes = readSolucoesAccount();
  return solucoes ? [solucoes] : [];
}

/**
 * Todas as contas com webhook configurado (Soluções + Cursos legado).
 * Usado pelo endpoint de webhook do Asaas para reconhecer o token.
 */
export function getOrderedAsaasAccounts(): AsaasAccount[] {
  const accounts: AsaasAccount[] = [];
  const solucoes = readSolucoesAccount();
  if (solucoes) accounts.push(solucoes);
  const cursos = readCursosAccount();
  if (cursos) accounts.push(cursos);
  return accounts;
}

export function getAsaasAccountById(id: AsaasAccountId): AsaasAccount | null {
  return getOrderedAsaasAccounts().find((a) => a.id === id) ?? null;
}

export function getAsaasBaseUrl(): string {
  return ASAAS_BASE_URL;
}

/**
 * Quando um webhook do Asaas chega, o token vem no header `asaas-access-token`.
 * Como temos duas contas, qualquer um dos dois tokens cadastrados é válido.
 * Devolve a conta dona do token, ou null se inválido.
 */
export function findAccountByWebhookToken(token: string | null): AsaasAccount | null {
  if (!token) return null;
  const accounts = getOrderedAsaasAccounts();
  return accounts.find((a) => a.webhookToken && a.webhookToken === token) ?? null;
}
