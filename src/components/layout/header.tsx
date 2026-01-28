"use client";

import { Bell, Menu, Search } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  userName?: string;
  onMenuClick?: () => void;
}

export function Header({
  title,
  subtitle,
  userName,
  onMenuClick,
}: HeaderProps) {
  const initials = userName
    ? userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="flex h-20 items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-6">
          {/* Mobile menu button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <Menu className="h-5 w-5 text-slate-600" />
          </button>

          {/* Title Section */}
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-5">
          {/* Subtle Search Icon (Visual Only) */}
          <button className="hidden sm:flex p-2.5 rounded-xl hover:bg-slate-50 text-slate-400 transition-all">
            <Search className="h-5 w-5" />
          </button>

          {/* Notifications */}
          <button className="relative p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all group">
            <Bell className="h-5 w-5 text-slate-500 group-hover:scale-110 transition-transform" />
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
          </button>

          {/* User Profile */}
          {userName && (
            <div className="flex items-center gap-4 pl-5 border-l border-slate-100">
              <div className="hidden md:block text-right">
                <p className="text-sm font-black text-slate-900 leading-none">{userName}</p>
                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-1">Parceiro VIP</p>
              </div>
              <div className="relative group">
                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#3A1D7A] to-[#8E7EEA] flex items-center justify-center shadow-lg shadow-[#3A1D7A]/20 group-hover:rotate-3 transition-transform cursor-pointer">
                  <span className="text-sm font-black text-white">
                    {initials}
                  </span>
                </div>
                <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white" />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
