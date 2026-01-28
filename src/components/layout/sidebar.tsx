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
  1: { name: "Bronze", icon: TrendingUp, bgColor: "bg-amber-100", textColor: "text-amber-700" },
  2: { name: "Prata", icon: Award, bgColor: "bg-gray-200", textColor: "text-gray-700" },
  3: { name: "Ouro", icon: Zap, bgColor: "bg-yellow-100", textColor: "text-yellow-700" },
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
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-64 bg-white border-r border-gray-200 transition-transform duration-300 flex flex-col",
          "lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
          <Link href={isAdmin ? "/admin" : "/dashboard"}>
            <Image
              src="/logo-leona-roxa.png"
              alt="Leona"
              width={100}
              height={32}
              className="object-contain"
              priority
            />
          </Link>
          <button 
            onClick={onMobileClose}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Menu
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
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#3A1D7A] text-white"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <item.icon className={cn("h-5 w-5", isActive ? "text-white" : "text-gray-400")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Tier Card */}
        {!isAdmin && (
          <div className="p-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", currentTier.bgColor)}>
                  <TierIcon className={cn("h-5 w-5", currentTier.textColor)} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase">Seu Nível</p>
                  <p className="text-sm font-bold text-gray-900">{currentTier.name} • {tierData.percent}%</p>
                </div>
              </div>
              
              {tierData.tier < 3 && (
                <>
                  <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-[#3A1D7A]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {tierData.subscriptions}/{tierData.nextTierSubs} vendas • {Math.round(progress)}%
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sair da Conta
          </button>
        </div>
      </aside>
    </>
  );
}
