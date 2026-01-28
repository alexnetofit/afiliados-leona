"use client";

import Link from "next/link";
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
} from "lucide-react";
import Image from "next/image";

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
}

export function Sidebar({ isAdmin = false, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const navItems = isAdmin ? adminNavItems : affiliateNavItems;

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-surface border-r border-border">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-border px-6">
          <Link href={isAdmin ? "/admin" : "/dashboard"} className="flex items-center gap-2">
            <div className="relative h-8 w-8">
              <Image
                src="/assets/brand/leona-logo.png"
                alt="Leona"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="text-xl font-bold bg-gradient-leona bg-clip-text text-transparent">
              Leona
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/dashboard" && item.href !== "/admin" && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:bg-background hover:text-text-primary"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Tier Progress (only for affiliates) */}
        {!isAdmin && (
          <div className="mx-3 mb-4 rounded-lg bg-gradient-leona p-4">
            <div className="flex items-center gap-2 text-white">
              <TrendingUp className="h-5 w-5" />
              <span className="text-sm font-medium">Seu Tier</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-white">30%</p>
            <p className="text-xs text-white/80">Próximo: 35% (20 assinaturas)</p>
            <div className="mt-2 h-2 w-full rounded-full bg-white/20">
              <div className="h-full w-1/4 rounded-full bg-white" />
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="border-t border-border p-3">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-background hover:text-error transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sair
          </button>
        </div>
      </div>
    </aside>
  );
}
