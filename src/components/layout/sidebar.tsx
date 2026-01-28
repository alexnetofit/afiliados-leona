"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Link2,
  DollarSign,
  CreditCard,
  User,
  Users,
  FileText,
  Wallet,
  Settings,
  LogOut,
  TrendingUp,
  Award,
  Zap,
  X,
  ChevronRight,
} from "lucide-react";

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const affiliateNavItems: SidebarItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Links", href: "/links", icon: Link2 },
  { name: "Vendas", href: "/vendas", icon: DollarSign },
  { name: "Assinaturas", href: "/assinaturas", icon: CreditCard },
  { name: "Perfil", href: "/perfil", icon: User },
];

const adminNavItems: SidebarItem[] = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Afiliados", href: "/admin/afiliados", icon: Users },
  { name: "Relatórios", href: "/admin/relatorios", icon: FileText },
  { name: "Pagamentos", href: "/admin/pagamentos", icon: Wallet },
  { name: "Configurações", href: "/admin/configuracoes", icon: Settings },
];

interface SidebarProps {
  isAdmin?: boolean;
  onLogout?: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  tierData?: {
    tier: number;
    percent: number;
    subscriptions: number;
    nextTierSubs: number;
  };
}

const tierConfig = {
  1: { name: "Bronze", icon: TrendingUp, color: "#CD7F32", gradient: "from-amber-500/20 to-amber-600/20", textColor: "text-amber-700" },
  2: { name: "Prata", icon: Award, color: "#C0C0C0", gradient: "from-slate-300/20 to-slate-400/20", textColor: "text-slate-700" },
  3: { name: "Ouro", icon: Zap, color: "#FFD700", gradient: "from-yellow-400/20 to-yellow-500/20", textColor: "text-yellow-700" },
};

export function Sidebar({ 
  isAdmin = false, 
  onLogout, 
  isMobileOpen = false,
  onMobileClose,
  tierData = { tier: 1, percent: 30, subscriptions: 0, nextTierSubs: 20 }
}: SidebarProps) {
  const pathname = usePathname();
  const navItems = isAdmin ? adminNavItems : affiliateNavItems;
  const currentTier = tierConfig[tierData.tier as keyof typeof tierConfig] || tierConfig[1];
  const TierIcon = currentTier.icon;
  const progress = tierData.tier < 3 
    ? Math.min((tierData.subscriptions / tierData.nextTierSubs) * 100, 100)
    : 100;

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-[280px] bg-white border-r border-slate-100 transition-all duration-300 ease-in-out shadow-xl lg:shadow-none",
          "lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo Section */}
          <div className="flex h-24 items-center justify-between px-8">
            <Link href={isAdmin ? "/admin" : "/dashboard"} className="flex items-center">
              <div className="relative h-10 w-32">
                <Image
                  src="/logo-leona-roxa.png"
                  alt="Leona"
                  fill
                  className="object-contain object-left"
                  priority
                />
              </div>
            </Link>
            <button 
              onClick={onMobileClose}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
            <p className="px-4 text-[11px] font-bold text-slate-400 uppercase tracking-[2px] mb-4">
              Menu Principal
            </p>
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/dashboard" && item.href !== "/admin" && pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onMobileClose}
                  className={cn(
                    "group flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200",
                    isActive
                      ? "bg-[#3A1D7A] text-white shadow-lg shadow-[#3A1D7A]/20"
                      : "text-slate-500 hover:bg-slate-50 hover:text-[#3A1D7A]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={cn(
                      "h-5 w-5 transition-colors",
                      isActive ? "text-white" : "text-slate-400 group-hover:text-[#3A1D7A]"
                    )} />
                    {item.name}
                  </div>
                  {isActive && <ChevronRight className="h-4 w-4 text-white/50" />}
                </Link>
              );
            })}
          </nav>

          {/* Tier Progress Card */}
          {!isAdmin && (
            <div className="px-4 mb-6">
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn("p-2 rounded-xl bg-gradient-to-br shadow-sm", currentTier.gradient)}>
                    <TierIcon className={cn("h-5 w-5", currentTier.textColor)} />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Seu Nível</p>
                    <p className="text-sm font-bold text-slate-900">
                      {currentTier.name} • {tierData.percent}%
                    </p>
                  </div>
                </div>
                
                {tierData.tier < 3 ? (
                  <div className="space-y-2">
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-gradient-to-r from-[#3A1D7A] to-[#8E7EEA] transition-all duration-1000 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">
                        {tierData.subscriptions} / {tierData.nextTierSubs} vendas
                      </p>
                      <p className="text-[10px] font-bold text-[#3A1D7A] uppercase">
                        {Math.round(progress)}%
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-1">
                    <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                    <p className="text-[11px] font-bold text-yellow-700 uppercase tracking-tight">
                      Nível Máximo Atingido
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* User & Logout */}
          <div className="p-4 border-t border-slate-50">
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-slate-400 hover:bg-red-50 hover:text-red-600 transition-all duration-200 group"
            >
              <div className="p-2 rounded-lg bg-slate-50 group-hover:bg-red-100 transition-colors">
                <LogOut className="h-4 w-4" />
              </div>
              Sair da Conta
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
