"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { Sidebar } from "@/components/layout/sidebar";
import { LoadingScreen } from "@/components/ui/spinner";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { user, isLoading, isAdmin } = useUser();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  // Redirect non-admin to dashboard
  if (!isAdmin) {
    router.push("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isAdmin onLogout={handleLogout} />
      <main className="lg:pl-64">
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
