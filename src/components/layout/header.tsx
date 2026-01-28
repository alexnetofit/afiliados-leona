"use client";

import { Menu } from "lucide-react";

interface HeaderProps {
  title: string;
  description?: string;
  user?: { name: string; email?: string };
  onMenuClick: () => void;
}

export function Header({ title, description, user, onMenuClick }: HeaderProps) {
  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <header className="h-16 bg-white border-b border-[#E8EAF0] sticky top-0 z-30">
      <div className="h-full px-6 lg:px-8 flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-[#F8F9FC] text-[#6B7280]"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-[#111827]">{title}</h1>
            {description && (
              <p className="text-sm text-[#6B7280]">{description}</p>
            )}
          </div>
        </div>

        {/* Right */}
        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-[#111827]">{user.name}</p>
              {user.email && (
                <p className="text-xs text-[#6B7280]">{user.email}</p>
              )}
            </div>
            <div className="h-9 w-9 rounded-full bg-[#5B21B6] flex items-center justify-center">
              <span className="text-sm font-medium text-white">{initials}</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
