"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Link2,
  DollarSign,
  CreditCard,
  Wallet,
  User,
  LogOut,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Links", href: "/links", icon: Link2 },
  { name: "Vendas", href: "/vendas", icon: DollarSign },
  { name: "Assinaturas", href: "/assinaturas", icon: CreditCard },
  { name: "Pagamentos", href: "/pagamentos", icon: Wallet },
  { name: "Perfil", href: "/perfil", icon: User },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  user?: { name: string; email?: string };
}

export function Sidebar({ open, onClose, onLogout, user }: SidebarProps) {
  const pathname = usePathname();

  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div 
          className="fixed inset-0 bg-zinc-900/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed top-0 left-0 z-50 h-screen w-[220px]",
          "bg-white border-r border-zinc-200",
          "flex flex-col",
          "transition-transform duration-200",
          "lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-zinc-100">
          <Link href="/dashboard" className="flex items-center">
            <Image
              src="/logo-leona-roxa.png"
              alt="Leona"
              width={80}
              height={26}
              className="object-contain"
              priority
            />
          </Link>
          <button 
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* User Card */}
        {user && (
          <div className="mx-3 mt-4 p-3 rounded-lg bg-zinc-50 border border-zinc-100">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-md bg-primary-100 flex items-center justify-center">
                <span className="text-xs font-medium text-primary-700">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 truncate">{user.name}</p>
                {user.email && (
                  <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <p className="px-2 mb-2 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
            Menu
          </p>
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-md",
                    "text-sm font-medium",
                    "transition-colors duration-100",
                    isActive 
                      ? "bg-primary-50 text-primary-700" 
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  )}
                >
                  <item.icon 
                    className={cn(
                      "h-4 w-4",
                      isActive ? "text-primary-600" : "text-zinc-400"
                    )} 
                    strokeWidth={isActive ? 2 : 1.75} 
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-100">
          <button
            onClick={onLogout}
            className={cn(
              "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md",
              "text-sm font-medium text-zinc-500",
              "hover:bg-zinc-50 hover:text-zinc-700",
              "transition-colors duration-100"
            )}
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
