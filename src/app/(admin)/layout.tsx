"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { LoadingScreen } from "@/components/ui/index";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Users,
  FileText,
  Wallet,
  Settings,
  LogOut,
  X,
  Menu,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Afiliados", href: "/admin/afiliados", icon: Users },
  { name: "Relatórios", href: "/admin/relatorios", icon: FileText },
  { name: "Pagamentos", href: "/admin/pagamentos", icon: Wallet },
  { name: "Configurações", href: "/admin/configuracoes", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { user, isLoading, isAdmin } = useUser();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-zinc-50 flex items-center justify-center">
        <LoadingScreen message="Carregando painel admin..." />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  if (!isAdmin) {
    router.push("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-screen w-[280px]",
        "bg-zinc-900 text-white",
        "flex flex-col",
        "transition-transform duration-300 ease-out",
        "lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="h-[72px] flex items-center justify-between px-6 border-b border-zinc-800">
          <Link href="/admin" className="flex items-center gap-3">
            <Image 
              src="/logo-leona-roxa.png" 
              alt="Leona" 
              width={100} 
              height={32} 
              className="object-contain brightness-0 invert" 
              priority 
            />
          </Link>
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="lg:hidden p-2 rounded-xl hover:bg-zinc-800 text-zinc-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Admin Badge */}
        <div className="mx-4 mt-6 p-4 rounded-2xl bg-gradient-to-br from-primary-500/20 to-primary-600/10 border border-primary-500/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary-500 flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Admin Panel</p>
              <p className="text-xs text-zinc-400">Acesso completo</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-6 px-4 overflow-y-auto">
          <p className="px-3 mb-3 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            Menu
          </p>
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/admin" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl",
                    "text-sm font-medium",
                    "transition-all duration-200",
                    "group",
                    isActive 
                      ? "bg-white text-zinc-900" 
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  )}
                >
                  <item.icon 
                    className={cn(
                      "h-5 w-5 transition-transform group-hover:scale-110",
                      isActive ? "text-primary-600" : "text-zinc-500 group-hover:text-primary-400"
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
        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl",
              "text-sm font-medium text-zinc-400",
              "hover:bg-error-500/10 hover:text-error-400",
              "transition-all duration-200",
              "group"
            )}
          >
            <LogOut className="h-5 w-5 group-hover:text-error-400 transition-colors" strokeWidth={1.75} />
            <span>Sair da conta</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-[280px] min-h-screen flex flex-col">
        {/* Mobile header */}
        <header className="h-[72px] bg-white/80 backdrop-blur-xl border-b border-zinc-200/50 sticky top-0 z-30 lg:hidden">
          <div className="h-full px-6 flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="p-2.5 -ml-2 rounded-xl hover:bg-zinc-100 text-zinc-600"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary-600" />
              <span className="font-semibold text-zinc-900">Admin</span>
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
