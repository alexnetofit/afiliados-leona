"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  const { user, profile, affiliate, isLoading, isAdmin } = useUser();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#3A1D7A]" />
          <p className="text-gray-500 text-sm">Carregando...</p>
        </div>
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
    <div className="min-h-screen bg-gray-50">
      <Sidebar 
        onLogout={handleLogout}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
        tierData={tierData}
      />
      
      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
