import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Timezone padrão do sistema: São Paulo (UTC-3)
const TIMEZONE = 'America/Sao_Paulo';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TIMEZONE,
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  }).format(new Date(date));
}

export function formatMonth(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: TIMEZONE,
  }).format(new Date(date));
}

/**
 * Get current date/time in São Paulo timezone
 */
export function getNowBRT(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

/**
 * Convert a date to São Paulo timezone
 */
export function toBRT(date: Date | string): Date {
  const d = new Date(date);
  return new Date(d.toLocaleString('en-US', { timeZone: TIMEZONE }));
}

export function getAffiliateLink(code: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_REGISTER_URL || 'https://app.leonasolutions.io/register';
  return `${baseUrl}?via=${code}`;
}

export function generateAffiliateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getFirstDayOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getLastDayOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function isDateAvailable(availableAt: string | Date): boolean {
  const available = toBRT(availableAt);
  const now = getNowBRT();
  return available <= now;
}

/**
 * Calculate when a commission becomes available for payout
 * - Payments from day 01-15 → available on day 05 of next month
 * - Payments from day 16-31 → available on day 20 of next month
 * Uses São Paulo timezone for all calculations
 */
export function calculateAvailableAt(paidAt: Date): Date {
  const paidBRT = toBRT(paidAt);
  const day = paidBRT.getDate();
  const nextMonth = new Date(paidBRT.getFullYear(), paidBRT.getMonth() + 1, 1);
  
  if (day <= 15) {
    // Available on day 05 of next month
    return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 5);
  } else {
    // Available on day 20 of next month
    return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 20);
  }
}

/**
 * Get the payout period for a given date
 * Returns which payout cycle this payment belongs to
 * Uses São Paulo timezone for all calculations
 */
export function getPayoutPeriod(paidAt: Date): { payoutDate: Date; label: string } {
  const paidBRT = toBRT(paidAt);
  const day = paidBRT.getDate();
  const nextMonth = new Date(paidBRT.getFullYear(), paidBRT.getMonth() + 1, 1);
  
  if (day <= 15) {
    const payoutDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 5);
    return { 
      payoutDate, 
      label: `05/${String(nextMonth.getMonth() + 1).padStart(2, '0')}/${nextMonth.getFullYear()}` 
    };
  } else {
    const payoutDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 20);
    return { 
      payoutDate, 
      label: `20/${String(nextMonth.getMonth() + 1).padStart(2, '0')}/${nextMonth.getFullYear()}` 
    };
  }
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    trialing: 'bg-blue-100 text-blue-800',
    active: 'bg-green-100 text-green-800',
    past_due: 'bg-yellow-100 text-yellow-800',
    canceled: 'bg-gray-100 text-gray-800',
    unpaid: 'bg-red-100 text-red-800',
    incomplete: 'bg-orange-100 text-orange-800',
    incomplete_expired: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    trialing: 'Trial',
    active: 'Ativo',
    past_due: 'Atrasado',
    canceled: 'Cancelado',
    unpaid: 'Não Pago',
    incomplete: 'Incompleto',
    incomplete_expired: 'Expirado',
    pending: 'Pendente',
    processing: 'Processando',
    paid: 'Pago',
  };
  return labels[status] || status;
}

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
