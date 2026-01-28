"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, Loader2, ArrowRight, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

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
    } catch (err) {
      setError("Ocorreu um erro ao entrar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      {/* Left Side: Brand & Social Proof */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-[#1a0b3b] via-[#3A1D7A] to-[#5B3FA6] p-16 flex-col justify-between relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-white rounded-full blur-[120px] animate-pulse" />
          <div className="absolute top-[60%] left-[70%] w-[50%] h-[50%] bg-[#8E7EEA] rounded-full blur-[100px] animate-bounce duration-[10s]" />
        </div>

        <div className="relative z-10">
          <Link href="/">
            <Image
              src="/logo-leona-roxa.png"
              alt="Leona"
              width={160}
              height={50}
              className="brightness-0 invert object-contain"
            />
          </Link>

          <div className="mt-24 space-y-8">
            <h1 className="text-5xl font-black text-white leading-[1.1] tracking-tight">
              Aumente sua renda com o <span className="text-[#C6BEF5]">Programa de Parceiros</span>
            </h1>
            <p className="text-xl text-white/70 max-w-md font-medium leading-relaxed">
              Junte-se à maior plataforma de soluções digitais e ganhe comissões recorrentes de até 40%.
            </p>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[#C6BEF5]">
              <TrendingUp className="h-5 w-5" />
              <span className="text-2xl font-black text-white">30%</span>
            </div>
            <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Comissão Inicial</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[#C6BEF5]">
              <Sparkles className="h-5 w-5" />
              <span className="text-2xl font-black text-white">40%</span>
            </div>
            <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Comissão Máxima</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[#C6BEF5]">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-2xl font-black text-white">15d</span>
            </div>
            <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Saque Rápido</p>
          </div>
        </div>

        <div className="relative z-10 pt-10 border-t border-white/10">
          <p className="text-xs text-white/40 font-medium">
            © 2026 Leona Flow. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* Right Side: Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 lg:bg-white">
        <div className="w-full max-w-md space-y-10">
          <div className="lg:hidden flex justify-center mb-8">
            <Image
              src="/logo-leona-roxa.png"
              alt="Leona"
              width={120}
              height={40}
              className="object-contain"
            />
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Bem-vindo de volta</h2>
            <p className="text-slate-500 font-medium">Acesse seu painel de controle de parceiro.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1" htmlFor="email">
                  E-mail do Parceiro
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-[#3A1D7A] text-slate-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="parceiro@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-[#3A1D7A] focus:bg-white rounded-[18px] outline-none transition-all font-medium text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest" htmlFor="password">
                    Sua Senha
                  </label>
                  <Link 
                    href="/forgot-password" 
                    className="text-xs font-bold text-[#3A1D7A] hover:text-[#5B3FA6] uppercase tracking-wider"
                  >
                    Esqueceu?
                  </Link>
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-[#3A1D7A] text-slate-400">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-[#3A1D7A] focus:bg-white rounded-[18px] outline-none transition-all font-medium text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-600 text-sm font-bold">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-4 bg-[#3A1D7A] hover:bg-[#2e1761] text-white rounded-[18px] font-black tracking-tight shadow-xl shadow-[#3A1D7A]/20 transition-all hover:-translate-y-1 active:scale-[0.98] disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Entrar no Painel
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-slate-500 font-bold">
            Não tem uma conta?{" "}
            <Link 
              href="/register" 
              className="text-[#3A1D7A] hover:text-[#5B3FA6] underline underline-offset-4 decoration-2"
            >
              Cadastre-se como parceiro
            </Link>
          </p>

          <p className="text-center text-[10px] text-slate-400 font-medium leading-relaxed px-8">
            Ao entrar, você concorda com nossos <Link href="#" className="underline">Termos de Uso</Link> e <Link href="#" className="underline">Política de Privacidade</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
