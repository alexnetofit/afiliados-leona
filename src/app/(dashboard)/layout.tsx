"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppDataProvider, useAppData } from "@/contexts";
import { Sidebar, MobileBottomNav } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, profile, isAdmin, isLoading, isInitialized, logout } = useAppData();

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
    if (isInitialized && isAdmin) {
      router.push("/admin");
    }
  }, [isInitialized, isAdmin, router]);

  // Loading state - only show on first load
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
  if (!user || isAdmin) {
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
      {/* Sidebar */}
      <Sidebar
        open={false}
        onClose={() => {}}
        onLogout={handleLogout}
        user={profile ? { name: profile.full_name || "", email: user?.email } : undefined}
      />

      {/* Mobile bottom nav */}
      <MobileBottomNav />

      {/* Main area - 220px sidebar width, pb-16 for mobile bottom nav */}
      <div className={cn("lg:pl-[220px] min-h-screen flex flex-col pb-16 lg:pb-0")}>
        {children}
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </AppDataProvider>
  );
}
