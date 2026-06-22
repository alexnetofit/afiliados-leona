// Top afiliados são pagos manualmente pela equipe (Wise/Pix), fora do fluxo
// de saque automático. Para eles, o dashboard esconde o botão "Solicitar
// Saque" e troca "Disponível para saque" por "Comissão acumulada", evitando
// pagamento duplicado. Identificação por email (mesmo critério do admin).
const TOP_AFFILIATE_EMAILS = new Set<string>(["tbnegociodigital@gmail.com"]);

export function isTopAffiliateEmail(email?: string | null): boolean {
  if (!email) return false;
  return TOP_AFFILIATE_EMAILS.has(email.trim().toLowerCase());
}
