"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { user, profile, isLoading, isAdmin } = useUser();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-zinc-50 flex items-center justify-center">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-zinc-200" />
          <div className="absolute top-0 left-0 h-12 w-12 rounded-full border-4 border-transparent border-t-primary-600 animate-spin" />
        </div>
      </div>
    );
  }

  // Redirect if not logged in
  if (!user) {
    router.push("/login");
    return null;
  }

  // Redirect admin
  if (isAdmin) {
    router.push("/admin");
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Sidebar */}
      <Sidebar 
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
        user={profile ? { name: profile.full_name || "", email: user.email } : undefined}
      />
      
      {/* Main area */}
      <div className={cn(
        "lg:pl-[280px] min-h-screen flex flex-col",
        "transition-all duration-300"
      )}>
        {children}
      </div>
    </div>
  );
}
