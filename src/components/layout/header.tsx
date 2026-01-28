"use client";

import { Menu, Bell, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  description?: string;
  user?: { name: string; email?: string };
  onMenuClick: () => void;
  actions?: React.ReactNode;
}

export function Header({ title, description, user, onMenuClick, actions }: HeaderProps) {
  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <header className="h-[72px] bg-white/80 backdrop-blur-xl border-b border-zinc-200/50 sticky top-0 z-30">
      <div className="h-full px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Left */}
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2.5 -ml-2 rounded-xl hover:bg-zinc-100 text-zinc-600 transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight truncate">{title}</h1>
            {description && (
              <p className="text-sm text-zinc-500 truncate mt-0.5">{description}</p>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          {/* Actions slot */}
          {actions && (
            <div className="hidden sm:flex items-center gap-2">
              {actions}
            </div>
          )}

          {/* Notifications */}
          <button className={cn(
            "relative p-2.5 rounded-xl",
            "bg-zinc-100 hover:bg-zinc-200",
            "text-zinc-600 hover:text-zinc-900",
            "transition-all duration-200"
          )}>
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary-500 ring-2 ring-white" />
          </button>

          {/* User */}
          {user && (
            <div className="flex items-center gap-3 pl-3 border-l border-zinc-200">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-zinc-900">{user.name}</p>
                {user.email && (
                  <p className="text-xs text-zinc-500 truncate max-w-[140px]">{user.email}</p>
                )}
              </div>
              <div className={cn(
                "h-10 w-10 rounded-xl",
                "bg-gradient-to-br from-primary-500 to-primary-700",
                "flex items-center justify-center",
                "shadow-primary",
                "ring-2 ring-white"
              )}>
                <span className="text-sm font-semibold text-white">{initials}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
