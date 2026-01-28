"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, Loader2, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        setError(loginError.message === "Invalid login credentials" 
          ? "E-mail ou senha incorretos." 
          : loginError.message);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Ocorreu um erro ao entrar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#3A1D7A]/5 via-[#5B3FA6]/8 to-[#8E7EEA]/5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#8E7EEA]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#3A1D7A]/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          <Image
            src="/logo-leona-roxa.png"
            alt="Leona"
            width={120}
            height={40}
            className="object-contain"
          />
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-semibold text-[#1F1F2E] leading-tight tracking-tight">
            Programa de<br />
            <span className="text-[#3A1D7A]">Parceiros Leona</span>
          </h1>
          <p className="text-[#6B6F8D] text-lg max-w-sm leading-relaxed">
            Ganhe comissões recorrentes de até 40% indicando novos clientes para a Leona.
          </p>
          
          <div className="flex gap-8 pt-4">
            <div>
              <p className="text-2xl font-semibold text-[#1F1F2E]">30%</p>
              <p className="text-sm text-[#6B6F8D]">Comissão inicial</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-[#1F1F2E]">40%</p>
              <p className="text-sm text-[#6B6F8D]">Comissão máxima</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-[#1F1F2E]">15 dias</p>
              <p className="text-sm text-[#6B6F8D]">Para saque</p>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-sm text-[#6B6F8D]">
            © 2026 Leona. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-[400px]">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-10">
            <Image
              src="/logo-leona-roxa.png"
              alt="Leona"
              width={100}
              height={32}
              className="object-contain"
            />
          </div>

          <div className="space-y-2 mb-8">
            <h2 className="text-2xl font-semibold text-[#1F1F2E] tracking-tight">
              Bem-vindo de volta
            </h2>
            <p className="text-[#6B6F8D]">
              Entre na sua conta de parceiro
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#1F1F2E]" htmlFor="email">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6B6F8D]" />
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 bg-[#F8F9FC] border border-[#E5E7F2] rounded-xl text-[#1F1F2E] placeholder:text-[#6B6F8D]/60 focus:outline-none focus:border-[#3A1D7A] focus:ring-4 focus:ring-[#3A1D7A]/10 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[#1F1F2E]" htmlFor="password">
                  Senha
                </label>
                <Link 
                  href="/forgot-password" 
                  className="text-sm font-medium text-[#3A1D7A] hover:text-[#5B3FA6] transition-colors"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6B6F8D]" />
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 bg-[#F8F9FC] border border-[#E5E7F2] rounded-xl text-[#1F1F2E] placeholder:text-[#6B6F8D]/60 focus:outline-none focus:border-[#3A1D7A] focus:ring-4 focus:ring-[#3A1D7A]/10 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-[#3A1D7A] hover:bg-[#5B3FA6] text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[#6B6F8D]">
            Não tem uma conta?{" "}
            <Link href="/register" className="font-medium text-[#3A1D7A] hover:text-[#5B3FA6] transition-colors">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
