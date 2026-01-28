"use client";

import { Bell, Menu } from "lucide-react";

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
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            <Menu className="h-5 w-5 text-gray-600" />
          </button>

          {/* Title */}
          <div>
            <h1 className="text-lg font-bold text-gray-900">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button className="relative p-2 rounded-lg hover:bg-gray-100">
            <Bell className="h-5 w-5 text-gray-500" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>

          {/* User */}
          {userName && (
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-gray-900">{userName}</p>
                <p className="text-xs text-gray-500">Parceiro</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-[#3A1D7A] flex items-center justify-center">
                <span className="text-sm font-bold text-white">{initials}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
