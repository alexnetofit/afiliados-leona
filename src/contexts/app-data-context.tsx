"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type {
  Profile,
  Affiliate,
  AffiliateLink,
  Subscription,
  Transaction,
  MonthlyPayout,
  AffiliateSummary,
} from "@/types";

// ============================================
// Types
// ============================================

interface AppData {
  // User data
  user: User | null;
  profile: Profile | null;
  affiliate: Affiliate | null;
  isAdmin: boolean;

  // Affiliate data
  links: AffiliateLink[];
  subscriptions: Subscription[];
  transactions: Transaction[];
  payouts: MonthlyPayout[];
  summary: AffiliateSummary | null;
  withdrawnDateLabels: Set<string>;

  // State
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  refetch: () => Promise<void>;
  refetchLinks: () => Promise<void>;
  logout: () => Promise<void>;
}

const defaultAppData: AppData = {
  user: null,
  profile: null,
  affiliate: null,
  isAdmin: false,
  links: [],
  subscriptions: [],
  transactions: [],
  payouts: [],
  summary: null,
  withdrawnDateLabels: new Set(),
  isLoading: true,
  isInitialized: false,
  refetch: async () => {},
  refetchLinks: async () => {},
  logout: async () => {},
};

const AppDataContext = createContext<AppData>(defaultAppData);

// ============================================
// Provider
// ============================================

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payouts, setPayouts] = useState<MonthlyPayout[]>([]);
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);
  const [withdrawnDateLabels, setWithdrawnDateLabels] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  const supabase = createClient();

  // Calculate summary from data
  const calculateSummary = useCallback(
    (txs: Transaction[], pays: MonthlyPayout[], subs: Subscription[]): AffiliateSummary => {
      const now = new Date();

      const pendingCents = txs
        .filter((t) => t.type === "commission" && t.available_at && new Date(t.available_at) > now)
        .reduce((sum, t) => sum + t.commission_amount_cents, 0);

      const availableCents = txs
        .filter((t) => t.available_at && new Date(t.available_at) <= now)
        .reduce((sum, t) => sum + t.commission_amount_cents, 0);

      const paidCents = pays
        .filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + p.total_payable_cents, 0);

      return {
        pending_cents: pendingCents,
        available_cents: Math.max(availableCents - paidCents, 0),
        paid_cents: paidCents,
        total_trials: subs.filter((s) => s.is_trial || s.status === "trialing").length,
        total_subscriptions: subs.length,
        active_subscriptions: subs.filter((s) => s.status === "active").length,
      };
    },
    []
  );

  // Fetch all affiliate data
  const fetchAffiliateData = useCallback(
    async (affiliateId: string) => {
      const [linksRes, subscriptionsRes, transactionsRes, payoutsRes] = await Promise.all([
        supabase
          .from("affiliate_links")
          .select("*")
          .eq("affiliate_id", affiliateId)
          .order("created_at", { ascending: false }),
        supabase
          .from("subscriptions")
          .select("*")
          .eq("affiliate_id", affiliateId)
          .order("created_at", { ascending: false }),
        supabase
          .from("transactions")
          .select("*")
          .eq("affiliate_id", affiliateId)
          .order("created_at", { ascending: false }),
        supabase
          .from("monthly_payouts")
          .select("*")
          .eq("affiliate_id", affiliateId)
          .order("month", { ascending: false }),
      ]);

      // Fetch withdrawn date labels via API (bypasses RLS)
      let wLabels = new Set<string>();
      try {
        const wRes = await fetch(`/api/withdraw/status?affiliateId=${affiliateId}`);
        if (wRes.ok) {
          const wData = await wRes.json();
          wLabels = new Set<string>(wData.dateLabels || []);
        }
      } catch {
        // silently fail
      }

      const linksData = (linksRes.data || []) as AffiliateLink[];
      const subsData = (subscriptionsRes.data || []) as Subscription[];
      const txsData = (transactionsRes.data || []) as Transaction[];
      const paysData = (payoutsRes.data || []) as MonthlyPayout[];

      setLinks(linksData);
      setSubscriptions(subsData);
      setTransactions(txsData);
      setPayouts(paysData);
      setSummary(calculateSummary(txsData, paysData, subsData));
      setWithdrawnDateLabels(wLabels);
    },
    [supabase, calculateSummary]
  );

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    try {
      // Get user
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        setUser(null);
        setProfile(null);
        setAffiliate(null);
        setLinks([]);
        setSubscriptions([]);
        setTransactions([]);
        setPayouts([]);
        setSummary(null);
        setWithdrawnDateLabels(new Set());
        return;
      }

      setUser(currentUser);

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();

      const typedProfile = profileData as Profile | null;
      setProfile(typedProfile);

      // If not admin, fetch affiliate data
      if (typedProfile?.role !== "admin") {
        const { data: affiliateData } = await supabase
          .from("affiliates")
          .select("*")
          .eq("user_id", currentUser.id)
          .single();

        const typedAffiliate = affiliateData as Affiliate | null;
        setAffiliate(typedAffiliate);

        if (typedAffiliate?.id) {
          await fetchAffiliateData(typedAffiliate.id);
        }
      }
    } catch (error) {
      console.error("Error fetching app data:", error);
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, [supabase, fetchAffiliateData]);

  // Refetch links only (for when creating new links)
  const refetchLinks = useCallback(async () => {
    if (!affiliate?.id) return;

    const { data } = await supabase
      .from("affiliate_links")
      .select("*")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false });

    setLinks((data || []) as AffiliateLink[]);
  }, [supabase, affiliate?.id]);

  // Logout
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setAffiliate(null);
    setLinks([]);
    setSubscriptions([]);
    setTransactions([]);
    setPayouts([]);
    setSummary(null);
    setWithdrawnDateLabels(new Set());
  }, [supabase]);

  // Initial fetch
  useEffect(() => {
    fetchAllData();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // Only refetch if user changed
        if (session.user.id !== user?.id) {
          fetchAllData();
        }
      } else {
        setUser(null);
        setProfile(null);
        setAffiliate(null);
        setLinks([]);
        setSubscriptions([]);
        setTransactions([]);
        setPayouts([]);
        setSummary(null);
        setWithdrawnDateLabels(new Set());
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const value: AppData = {
    user,
    profile,
    affiliate,
    isAdmin: profile?.role === "admin",
    links,
    subscriptions,
    transactions,
    payouts,
    summary,
    withdrawnDateLabels,
    isLoading,
    isInitialized,
    refetch: fetchAllData,
    refetchLinks,
    logout,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

// ============================================
// Hook
// ============================================

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used within an AppDataProvider");
  }
  return context;
}
