"use client";

import { Bell, Search, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  title: string;
  subtitle?: string;
  userName?: string;
  onMenuClick?: () => void;
  showSearch?: boolean;
}

export function Header({
  title,
  subtitle,
  userName,
  onMenuClick,
  showSearch = false,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface px-6">
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Title */}
        <div>
          <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
          {subtitle && (
            <p className="text-sm text-text-secondary">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        {showSearch && (
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <Input
              placeholder="Buscar..."
              className="w-64 pl-9"
            />
          </div>
        )}

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-error" />
        </Button>

        {/* User */}
        {userName && (
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-leona flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-text-primary">{userName}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
