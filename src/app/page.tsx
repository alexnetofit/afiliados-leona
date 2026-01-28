"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-4 border-zinc-200" />
          <div className="absolute top-0 left-0 h-12 w-12 rounded-full border-4 border-transparent border-t-primary-600 animate-spin" />
        </div>
        <p className="text-sm text-zinc-500 animate-pulse">Redirecionando...</p>
      </div>
    </div>
  );
}
