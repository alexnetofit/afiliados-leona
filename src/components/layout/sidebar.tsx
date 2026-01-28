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
} from "lucide-react";

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
}

export function Sidebar({ open, onClose, onLogout }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div 
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed top-0 left-0 z-50 h-screen
          w-[240px] bg-white border-r border-[#E8EAF0]
          flex flex-col
          transition-transform duration-200 ease-out
          lg:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#F1F3F7]">
          <Link href="/dashboard">
            <Image
              src="/logo-leona-roxa.png"
              alt="Leona"
              width={90}
              height={28}
              className="object-contain"
              priority
            />
          </Link>
          <button 
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-[#F8F9FC] text-[#6B7280]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-6 px-3 overflow-y-auto">
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl
                    text-sm font-medium transition-colors
                    ${isActive 
                      ? "bg-[#EDE9FE] text-[#5B21B6]" 
                      : "text-[#6B7280] hover:bg-[#F8F9FC] hover:text-[#111827]"
                    }
                  `}
                >
                  <item.icon className="h-5 w-5" strokeWidth={1.75} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-[#F1F3F7]">
          <button
            onClick={onLogout}
            className="
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
              text-sm font-medium text-[#6B7280]
              hover:bg-[#FEE2E2] hover:text-[#DC2626]
              transition-colors
            "
          >
            <LogOut className="h-5 w-5" strokeWidth={1.75} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
