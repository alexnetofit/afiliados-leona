// ============================================
// Database Types
// ============================================

export type UserRole = 'affiliate' | 'admin';

export type CommissionTier = 1 | 2 | 3;

export type SubscriptionStatus = 
  | 'trialing' 
  | 'active' 
  | 'past_due' 
  | 'canceled' 
  | 'unpaid' 
  | 'incomplete' 
  | 'incomplete_expired';

export type TransactionType = 'commission' | 'refund' | 'dispute' | 'adjustment';

export type PayoutStatus = 'pending' | 'processing' | 'paid';

export type StripeEventStatus = 'pending' | 'processed' | 'failed' | 'skipped';

// ============================================
// Database Tables
// ============================================

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Affiliate {
  id: string;
  user_id: string;
  affiliate_code: string;
  commission_tier: CommissionTier;
  paid_subscriptions_count: number;
  payout_pix_key: string | null;
  payout_wise_details: WiseDetails | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WiseDetails {
  email?: string;
  account_holder_name?: string;
  currency?: string;
  iban?: string;
  swift_bic?: string;
}

export interface AffiliateLink {
  id: string;
  affiliate_id: string;
  alias: string;
  created_at: string;
}

export interface CustomerAffiliate {
  stripe_customer_id: string;
  affiliate_id: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  affiliate_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  customer_name: string | null;
  price_id: string | null;
  amount_cents: number | null;
  status: SubscriptionStatus;
  is_trial: boolean;
  trial_start: string | null;
  trial_end: string | null;
  started_at: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  has_refund: boolean;
  has_dispute: boolean;
  last_event_at: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  affiliate_id: string;
  subscription_id: string | null;
  stripe_invoice_id: string | null;
  stripe_charge_id: string | null;
  type: TransactionType;
  amount_gross_cents: number;
  commission_percent: number;
  commission_amount_cents: number;
  paid_at: string | null;
  available_at: string | null;
  description: string | null;
  created_at: string;
}

export interface MonthlyPayout {
  id: string;
  month: string;
  affiliate_id: string;
  total_commission_cents: number;
  total_negative_cents: number;
  total_payable_cents: number;
  status: PayoutStatus;
  paid_at: string | null;
  paid_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface StripeEvent {
  id: string;
  stripe_event_id: string;
  type: string;
  status: StripeEventStatus;
  error: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  processed_at: string | null;
}

export interface AntiFraudLog {
  id: string;
  affiliate_id: string | null;
  stripe_customer_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  country: string | null;
  created_at: string;
}

// ============================================
// Computed/Aggregated Types
// ============================================

export interface AffiliateSummary {
  pending_cents: number;
  available_cents: number;
  paid_cents: number;
  total_trials: number;
  total_subscriptions: number;
  active_subscriptions: number;
}

export interface AffiliateWithProfile extends Affiliate {
  profile: Profile;
}

export interface TransactionWithSubscription extends Transaction {
  subscription?: Subscription;
}

// ============================================
// Commission Tier Configuration
// ============================================

export const COMMISSION_TIERS: Record<CommissionTier, { percent: number; minSubscriptions: number }> = {
  1: { percent: 30, minSubscriptions: 0 },
  2: { percent: 35, minSubscriptions: 20 },
  3: { percent: 40, minSubscriptions: 50 },
};

export function getCommissionPercent(tier: CommissionTier): number {
  return COMMISSION_TIERS[tier].percent;
}

export function calculateTier(paidSubscriptions: number): CommissionTier {
  if (paidSubscriptions >= 50) return 3;
  if (paidSubscriptions >= 20) return 2;
  return 1;
}

// ============================================
// Database Type Helper (for Supabase client)
// ============================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id'>>;
      };
      affiliates: {
        Row: Affiliate;
        Insert: Omit<Affiliate, 'id' | 'created_at' | 'updated_at' | 'commission_tier' | 'paid_subscriptions_count'>;
        Update: Partial<Omit<Affiliate, 'id'>>;
      };
      affiliate_links: {
        Row: AffiliateLink;
        Insert: Omit<AffiliateLink, 'id' | 'created_at'>;
        Update: Partial<Omit<AffiliateLink, 'id'>>;
      };
      customer_affiliates: {
        Row: CustomerAffiliate;
        Insert: Omit<CustomerAffiliate, 'created_at'>;
        Update: never;
      };
      subscriptions: {
        Row: Subscription;
        Insert: Omit<Subscription, 'id' | 'created_at' | 'updated_at' | 'last_event_at'>;
        Update: Partial<Omit<Subscription, 'id'>>;
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, 'id' | 'created_at'>;
        Update: Partial<Omit<Transaction, 'id'>>;
      };
      monthly_payouts: {
        Row: MonthlyPayout;
        Insert: Omit<MonthlyPayout, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<MonthlyPayout, 'id'>>;
      };
      stripe_events: {
        Row: StripeEvent;
        Insert: Omit<StripeEvent, 'id' | 'created_at'>;
        Update: Partial<Omit<StripeEvent, 'id'>>;
      };
      anti_fraud_logs: {
        Row: AntiFraudLog;
        Insert: Omit<AntiFraudLog, 'id' | 'created_at'>;
        Update: never;
      };
    };
  };
}
