"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { 
  Affiliate, 
  AffiliateLink, 
  Subscription, 
  Transaction, 
  MonthlyPayout,
  AffiliateSummary 
} from "@/types";

interface UseAffiliateDataReturn {
  affiliate: Affiliate | null;
  links: AffiliateLink[];
  subscriptions: Subscription[];
  transactions: Transaction[];
  payouts: MonthlyPayout[];
  summary: AffiliateSummary | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export function useAffiliateData(affiliateId?: string): UseAffiliateDataReturn {
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payouts, setPayouts] = useState<MonthlyPayout[]>([]);
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  const fetchData = async () => {
    if (!affiliateId) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch all data in parallel
      const [
        affiliateRes,
        linksRes,
        subscriptionsRes,
        transactionsRes,
        payoutsRes,
      ] = await Promise.all([
        supabase.from("affiliates").select("*").eq("id", affiliateId).single(),
        supabase.from("affiliate_links").select("*").eq("affiliate_id", affiliateId).order("created_at", { ascending: false }),
        supabase.from("subscriptions").select("*").eq("affiliate_id", affiliateId).order("created_at", { ascending: false }),
        supabase.from("transactions").select("*").eq("affiliate_id", affiliateId).order("created_at", { ascending: false }),
        supabase.from("monthly_payouts").select("*").eq("affiliate_id", affiliateId).order("month", { ascending: false }),
      ]);

      setAffiliate(affiliateRes.data as Affiliate | null);
      setLinks((linksRes.data || []) as AffiliateLink[]);
      setSubscriptions((subscriptionsRes.data || []) as Subscription[]);
      setTransactions((transactionsRes.data || []) as Transaction[]);
      setPayouts((payoutsRes.data || []) as MonthlyPayout[]);

      // Calculate summary
      const now = new Date();
      const txs = (transactionsRes.data || []) as Transaction[];
      
      const pendingCents = txs
        .filter(t => t.type === 'commission' && t.available_at && new Date(t.available_at) > now)
        .reduce((sum, t) => sum + t.commission_amount_cents, 0);

      const availableCents = txs
        .filter(t => t.available_at && new Date(t.available_at) <= now)
        .reduce((sum, t) => sum + t.commission_amount_cents, 0);

      const paidCents = ((payoutsRes.data || []) as MonthlyPayout[])
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + p.total_payable_cents, 0);

      const subs = (subscriptionsRes.data || []) as Subscription[];
      
      setSummary({
        pending_cents: pendingCents,
        available_cents: Math.max(availableCents - paidCents, 0),
        paid_cents: paidCents,
        total_trials: subs.filter(s => s.is_trial || s.status === 'trialing').length,
        total_subscriptions: subs.length,
        active_subscriptions: subs.filter(s => s.status === 'active').length,
      });
    } catch (error) {
      console.error("Error fetching affiliate data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [affiliateId]);

  return {
    affiliate,
    links,
    subscriptions,
    transactions,
    payouts,
    summary,
    isLoading,
    refetch: fetchData,
  };
}
