"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { Sidebar } from "@/components/layout/sidebar";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { user, affiliate, isLoading, isAdmin } = useUser();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#3A1D7A]" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  if (isAdmin) {
    router.push("/admin");
    return null;
  }

  const tierData = affiliate ? {
    tier: affiliate.commission_tier || 1,
    percent: affiliate.commission_tier === 3 ? 40 : affiliate.commission_tier === 2 ? 35 : 30,
    subscriptions: affiliate.paid_subscriptions_count || 0,
    nextTierSubs: affiliate.commission_tier === 1 ? 20 : affiliate.commission_tier === 2 ? 50 : 50,
  } : undefined;

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      <Sidebar 
        onLogout={handleLogout}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
        tierData={tierData}
      />
      
      <main className="lg:pl-[260px] min-h-screen">
        {children}
      </main>
    </div>
  );
}
