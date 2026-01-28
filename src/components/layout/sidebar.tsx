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

export function Sidebar({ 
  isAdmin = false, 
  onLogout, 
  isMobileOpen = false,
  onMobileClose,
  tierData = { tier: 1, percent: 30, subscriptions: 0, nextTierSubs: 20 }
}: SidebarProps) {
  const pathname = usePathname();
  const navItems = isAdmin ? adminNavItems : affiliateNavItems;
  const progress = tierData.tier < 3 
    ? Math.min((tierData.subscriptions / tierData.nextTierSubs) * 100, 100)
    : 100;

  const tierNames = { 1: "Bronze", 2: "Prata", 3: "Ouro" };
  const tierName = tierNames[tierData.tier as keyof typeof tierNames] || "Bronze";

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-[#1F1F2E]/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-[260px] bg-white border-r border-[#E5E7F2] flex flex-col transition-transform duration-300",
          "lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#E5E7F2]">
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
            className="lg:hidden p-2 rounded-lg hover:bg-[#F8F9FC] transition-colors"
          >
            <X className="h-5 w-5 text-[#6B6F8D]" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 overflow-y-auto">
          <p className="px-3 mb-3 text-[11px] font-semibold text-[#6B6F8D] uppercase tracking-wider">
            Menu
          </p>
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/dashboard" && item.href !== "/admin" && pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={onMobileClose}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                    isActive
                      ? "bg-[#3A1D7A]/10 text-[#3A1D7A]"
                      : "text-[#6B6F8D] hover:bg-[#F8F9FC] hover:text-[#1F1F2E]"
                  )}
                >
                  <item.icon className={cn(
                    "h-[18px] w-[18px]",
                    isActive ? "text-[#3A1D7A]" : "text-[#6B6F8D]"
                  )} strokeWidth={1.75} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Tier Card - somente afiliados */}
        {!isAdmin && (
          <div className="px-3 pb-3">
            <div className="rounded-xl bg-[#F8F9FC] border border-[#E5E7F2] p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-[#6B6F8D]">Seu nível</p>
                  <p className="text-sm font-semibold text-[#1F1F2E]">{tierName}</p>
                </div>
                <div className="px-2.5 py-1 rounded-lg bg-[#3A1D7A] text-white text-xs font-semibold">
                  {tierData.percent}%
                </div>
              </div>
              
              {tierData.tier < 3 && (
                <div className="space-y-2">
                  <div className="h-1.5 w-full rounded-full bg-[#E5E7F2] overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-[#3A1D7A] transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#6B6F8D]">
                    {tierData.subscriptions} de {tierData.nextTierSubs} vendas
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="p-3 border-t border-[#E5E7F2]">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#6B6F8D] hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
