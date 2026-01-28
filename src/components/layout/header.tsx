"use client";

import { Menu } from "lucide-react";

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
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-[#E5E7F2]">
      <div className="flex h-16 items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-[#F8F9FC] transition-colors"
          >
            <Menu className="h-5 w-5 text-[#6B6F8D]" />
          </button>

          {/* Title */}
          <div>
            <h1 className="text-lg font-semibold text-[#1F1F2E] tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-sm text-[#6B6F8D]">{subtitle}</p>
            )}
          </div>
        </div>

        {/* User */}
        {userName && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-[#1F1F2E]">{userName}</p>
              <p className="text-xs text-[#6B6F8D]">Parceiro</p>
            </div>
            <div className="h-9 w-9 rounded-full bg-[#3A1D7A] flex items-center justify-center">
              <span className="text-sm font-medium text-white">{initials}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
