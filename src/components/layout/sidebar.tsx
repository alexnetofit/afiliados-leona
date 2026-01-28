"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Link2,
  DollarSign,
  CreditCard,
  User,
  LogOut,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Links", href: "/links", icon: Link2 },
  { name: "Vendas", href: "/vendas", icon: DollarSign },
  { name: "Assinaturas", href: "/assinaturas", icon: CreditCard },
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
          className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed top-0 left-0 z-50 h-screen w-[280px]",
          "bg-white border-r border-zinc-200",
          "flex flex-col",
          "transition-transform duration-300 ease-out",
          "lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="h-[72px] flex items-center justify-between px-6 border-b border-zinc-100">
          <Link href="/dashboard" className="flex items-center gap-2">
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
            onClick={onClose}
            className="lg:hidden p-2 rounded-xl hover:bg-zinc-100 text-zinc-500 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Card */}
        {user && (
          <div className="mx-4 mt-6 p-4 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100/50 border border-primary-100">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-primary">
                <span className="text-sm font-semibold text-white">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-zinc-900 truncate">{user.name}</p>
                {user.email && (
                  <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-6 px-4 overflow-y-auto">
          <p className="px-3 mb-3 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
            Menu
          </p>
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl",
                    "text-sm font-medium",
                    "transition-all duration-200",
                    "group relative overflow-hidden",
                    isActive 
                      ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-primary" 
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  )}
                >
                  <item.icon 
                    className={cn(
                      "h-5 w-5 transition-transform group-hover:scale-110",
                      isActive ? "text-white" : "text-zinc-400 group-hover:text-primary-500"
                    )} 
                    strokeWidth={isActive ? 2 : 1.75} 
                  />
                  <span>{item.name}</span>
                  {isActive && (
                    <Sparkles className="h-3.5 w-3.5 absolute right-4 animate-pulse" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100">
          <button
            onClick={onLogout}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl",
              "text-sm font-medium text-zinc-500",
              "hover:bg-error-50 hover:text-error-600",
              "transition-all duration-200",
              "group"
            )}
          >
            <LogOut className="h-5 w-5 group-hover:text-error-500 transition-colors" strokeWidth={1.75} />
            <span>Sair da conta</span>
          </button>
        </div>
      </aside>
    </>
  );
}
