"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile, Affiliate } from "@/types";

interface UseUserReturn {
  user: User | null;
  profile: Profile | null;
  affiliate: Affiliate | null;
  isLoading: boolean;
  isAdmin: boolean;
  refetch: () => Promise<void>;
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  const fetchUserData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUser(null);
        setProfile(null);
        setAffiliate(null);
        return;
      }

      setUser(user);

      // Fetch profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(profileData);

      // Fetch affiliate if not admin
      if (profileData?.role !== "admin") {
        const { data: affiliateData } = await supabase
          .from("affiliates")
          .select("*")
          .eq("user_id", user.id)
          .single();

        setAffiliate(affiliateData);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserData();
      } else {
        setUser(null);
        setProfile(null);
        setAffiliate(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    profile,
    affiliate,
    isLoading,
    isAdmin: profile?.role === "admin",
    refetch: fetchUserData,
  };
}
