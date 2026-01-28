"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { Sidebar } from "@/components/layout/sidebar";
import { Loader2, Sparkles } from "lucide-react";

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
      <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-[#3A1D7A]" />
            <Sparkles className="h-5 w-5 text-indigo-400 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <p className="text-slate-500 font-bold text-sm uppercase tracking-[2px]">Carregando seu Universo...</p>
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
    <div className="min-h-screen bg-[#F8F9FC] selection:bg-indigo-100 selection:text-indigo-900">
      <Sidebar 
        onLogout={handleLogout}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
        tierData={tierData}
      />
      
      {/* Main Content Area */}
      <main className="lg:pl-[280px] min-h-screen flex flex-col transition-all duration-300">
        <div className="flex-1">
          {children}
        </div>
        
        {/* Subtle Footer */}
        <footer className="px-10 py-8 border-t border-slate-100 bg-white/50">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              © 2026 Leona Flow • Todos os direitos reservados
            </p>
            <div className="flex gap-6">
              <Link href="#" className="text-[10px] font-bold text-slate-400 hover:text-[#3A1D7A] uppercase tracking-widest transition-colors">Termos</Link>
              <Link href="#" className="text-[10px] font-bold text-slate-400 hover:text-[#3A1D7A] uppercase tracking-widest transition-colors">Privacidade</Link>
              <Link href="#" className="text-[10px] font-bold text-slate-400 hover:text-[#3A1D7A] uppercase tracking-widest transition-colors">Suporte</Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
