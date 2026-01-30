"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AppDataProvider, useAppData } from "@/contexts";
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
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Afiliados", href: "/admin/afiliados", icon: Users },
  { name: "Relatórios", href: "/admin/relatorios", icon: FileText },
  { name: "Pagamentos", href: "/admin/pagamentos", icon: Wallet },
  { name: "Emails", href: "/admin/emails", icon: Mail },
  { name: "Configurações", href: "/admin/configuracoes", icon: Settings },
];

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isInitialized, isAdmin, logout } = useAppData();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  // Handle redirects in useEffect to avoid setState during render
  useEffect(() => {
    if (isInitialized && !user) {
      router.push("/login");
    }
  }, [isInitialized, user, router]);

  useEffect(() => {
    if (isInitialized && user && !isAdmin) {
      router.push("/dashboard");
    }
  }, [isInitialized, user, isAdmin, router]);

  // Loading state
  if (isLoading && !isInitialized) {
    return (
      <div className="h-screen w-screen bg-zinc-50 flex items-center justify-center">
        <div className="relative">
          <div className="h-8 w-8 rounded-full border-2 border-zinc-200" />
          <div className="absolute top-0 left-0 h-8 w-8 rounded-full border-2 border-transparent border-t-primary-600 animate-spin" />
        </div>
      </div>
    );
  }

  // Show loading while redirect is pending
  if (!user || !isAdmin) {
    return (
      <div className="h-screen w-screen bg-zinc-50 flex items-center justify-center">
        <div className="relative">
          <div className="h-8 w-8 rounded-full border-2 border-zinc-200" />
          <div className="absolute top-0 left-0 h-8 w-8 rounded-full border-2 border-transparent border-t-primary-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-zinc-900/50 z-40 lg:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar - 220px width for production density */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-screen w-[220px]",
        "bg-zinc-900 text-white",
        "flex flex-col",
        "transition-transform duration-200",
        "lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-zinc-800">
          <Link href="/admin" className="flex items-center">
            <Image 
              src="/logo-leona-roxa.png" 
              alt="Leona" 
              width={80} 
              height={26} 
              className="object-contain brightness-0 invert" 
              priority 
            />
          </Link>
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="lg:hidden p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Admin Badge */}
        <div className="mx-3 mt-4 p-3 rounded-lg bg-primary-500/10 border border-primary-500/20">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-primary-600 flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Admin</p>
              <p className="text-[11px] text-zinc-400">Acesso completo</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <p className="px-2 mb-2 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
            Menu
          </p>
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/admin" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-md",
                    "text-sm font-medium",
                    "transition-colors duration-100",
                    isActive 
                      ? "bg-white text-zinc-900" 
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  )}
                >
                  <item.icon 
                    className={cn(
                      "h-4 w-4",
                      isActive ? "text-primary-600" : "text-zinc-500"
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
        <div className="p-3 border-t border-zinc-800">
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md",
              "text-sm font-medium text-zinc-400",
              "hover:bg-zinc-800 hover:text-zinc-200",
              "transition-colors duration-100"
            )}
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main - 220px sidebar offset */}
      <div className="lg:pl-[220px] min-h-screen flex flex-col">
        {/* Mobile header */}
        <header className="h-14 bg-white border-b border-zinc-200 sticky top-0 z-30 lg:hidden">
          <div className="h-full px-4 flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="p-1.5 -ml-1 rounded-md hover:bg-zinc-100 text-zinc-600"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-primary-600" />
              <span className="text-sm font-semibold text-zinc-900">Admin</span>
            </div>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AppDataProvider>
  );
}
