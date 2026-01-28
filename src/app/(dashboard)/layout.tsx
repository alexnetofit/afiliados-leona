"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { Sidebar } from "@/components/layout/sidebar";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { user, isLoading, isAdmin } = useUser();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#F8F9FC] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#5B21B6]" />
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
    <div className="min-h-screen bg-[#F8F9FC]">
      {/* Sidebar - largura fixa 240px */}
      <Sidebar 
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
      />
      
      {/* Main area - offset pelo sidebar */}
      <div className="lg:pl-[240px] min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
}
