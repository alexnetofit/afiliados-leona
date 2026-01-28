"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";

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
  const supabase = createClient();
  const { user, isLoading, isAdmin } = useUser();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#F8F9FC] flex items-center justify-center">
        <LoadingScreen />
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
    <div className="min-h-screen bg-[#F8F9FC]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-screen w-[240px] bg-white border-r border-[#E8EAF0]
        flex flex-col transition-transform duration-200
        lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#F1F3F7]">
          <Link href="/admin">
            <Image src="/logo-leona-roxa.png" alt="Leona" width={90} height={28} className="object-contain" priority />
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg hover:bg-[#F8F9FC] text-[#6B7280]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 py-6 px-3 overflow-y-auto">
          <p className="px-3 mb-3 text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">Admin</p>
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#6B7280] hover:bg-[#F8F9FC] hover:text-[#111827] transition-colors"
              >
                <item.icon className="h-5 w-5" strokeWidth={1.75} />
                {item.name}
              </Link>
            ))}
          </div>
        </nav>

        <div className="p-3 border-t border-[#F1F3F7]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#DC2626] transition-colors"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.75} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-[240px] min-h-screen flex flex-col">
        {/* Mobile header */}
        <header className="h-16 bg-white border-b border-[#E8EAF0] sticky top-0 z-30 lg:hidden">
          <div className="h-full px-6 flex items-center">
            <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-[#F8F9FC] text-[#6B7280]">
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
