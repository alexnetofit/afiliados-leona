"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError("Email ou senha inválidos");
        return;
      }

      if (data.user) {
        // Check user role to redirect appropriately
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

        const profileData = profile as { role: string } | null;
        if (profileData?.role === "admin") {
          router.push("/admin");
        } else {
          router.push("/dashboard");
        }
        router.refresh();
      }
    } catch {
      setError("Ocorreu um erro. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#3A1D7A] to-[#8E7EEA] flex items-center justify-center">
              <span className="text-white text-2xl font-bold">L</span>
            </div>
            <span className="text-3xl font-bold bg-gradient-to-r from-[#3A1D7A] via-[#5B3FA6] to-[#8E7EEA] bg-clip-text text-transparent">
              Leona
            </span>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Bem-vindo de volta</CardTitle>
            <CardDescription>
              Entre na sua conta de parceiro
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />

              <Input
                label="Senha"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                isLoading={isLoading}
              >
                Entrar
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-[#6B6F8D]">
              Não tem uma conta?{" "}
              <Link href="/register" className="text-[#3A1D7A] font-medium hover:underline">
                Cadastre-se
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-xs text-[#6B6F8D]">
          Ao entrar, você concorda com nossos{" "}
          <a href="#" className="underline text-[#3A1D7A]">Termos de Uso</a> e{" "}
          <a href="#" className="underline text-[#3A1D7A]">Política de Privacidade</a>
        </p>
      </div>
    </div>
  );
}
