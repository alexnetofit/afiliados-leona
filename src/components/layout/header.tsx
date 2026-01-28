"use client";

import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  description?: string;
  user?: { name: string; email?: string };
  onMenuClick: () => void;
  actions?: React.ReactNode;
}

export function Header({ title, description, onMenuClick, actions }: HeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-zinc-200 sticky top-0 z-30">
      <div className="h-full px-4 lg:px-5 flex items-center justify-between gap-4">
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-1.5 -ml-1 rounded-md hover:bg-zinc-100 text-zinc-600 transition-colors"
          >
            <Menu className="h-4 w-4" />
          </button>
          
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-zinc-900 tracking-tight truncate">{title}</h1>
            {description && (
              <p className="text-xs text-zinc-500 truncate">{description}</p>
            )}
          </div>
        </div>

        {/* Right - Actions slot */}
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
