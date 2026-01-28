"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, User, Loader2, ArrowRight, Check, Gift, Wallet, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const BENEFITS = [
  { icon: Gift, text: "Comissões de até 40%" },
  { icon: Wallet, text: "Pagamentos via PIX" },
  { icon: BarChart3, text: "Dashboard completo" },
  { icon: Check, text: "Suporte dedicado" },
];

const TIERS = [
  { level: "Bronze", percent: "30%", color: "from-amber-600 to-amber-700" },
  { level: "Prata", percent: "35%", color: "from-zinc-400 to-zinc-500" },
  { level: "Ouro", percent: "40%", color: "from-yellow-400 to-amber-500" },
];

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Left - Hero */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900" />
        
        {/* Pattern overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />

        {/* Glow effects */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary-400 rounded-full blur-3xl opacity-30" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-primary-300 rounded-full blur-3xl opacity-20" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <div>
            <Image
              src="/logo-leona-roxa.png"
              alt="Leona"
              width={120}
              height={40}
              className="object-contain brightness-0 invert"
            />
          </div>
          
          {/* Main content */}
          <div className="max-w-lg">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight">
              Torne-se um
              <span className="block mt-1 bg-gradient-to-r from-primary-200 to-white bg-clip-text text-transparent">
                Parceiro Leona
              </span>
            </h1>
            <p className="mt-6 text-lg text-primary-100 leading-relaxed">
              Crie sua conta em segundos e comece a ganhar comissões recorrentes.
            </p>
            
            {/* Tiers */}
            <div className="mt-10 flex gap-4">
              {TIERS.map((tier, i) => (
                <div 
                  key={tier.level}
                  className={cn(
                    "flex-1 p-4 rounded-2xl bg-white/10 backdrop-blur border border-white/10",
                    "animate-fade-in-up"
                  )}
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className={cn(
                    "h-8 w-8 rounded-lg bg-gradient-to-br flex items-center justify-center mb-3",
                    tier.color
                  )}>
                    <span className="text-xs font-bold text-white">{i + 1}</span>
                  </div>
                  <p className="text-xs text-primary-200 uppercase tracking-wider">{tier.level}</p>
                  <p className="text-2xl font-bold text-white">{tier.percent}</p>
                </div>
              ))}
            </div>

            {/* Benefits */}
            <div className="mt-10 grid grid-cols-2 gap-4">
              {BENEFITS.map((benefit, i) => (
                <div 
                  key={benefit.text} 
                  className="flex items-center gap-3 animate-fade-in-up"
                  style={{ animationDelay: `${(i + 3) * 100}ms` }}
                >
                  <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center">
                    <benefit.icon className="h-4 w-4 text-primary-200" />
                  </div>
                  <span className="text-sm text-white">{benefit.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-sm text-primary-200/60">© 2026 Leona. Todos os direitos reservados.</p>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 flex justify-center">
            <Image
              src="/logo-leona-roxa.png"
              alt="Leona"
              width={120}
              height={40}
              className="object-contain"
            />
          </div>

          {/* Form header */}
          <div className="text-center lg:text-left mb-10">
            <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Criar conta</h2>
            <p className="mt-3 text-zinc-500">Comece a ganhar comissões hoje</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-2">
                Nome completo
              </label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-primary-500 transition-colors" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className={cn(
                    "w-full h-14 pl-12 pr-4",
                    "bg-white border-2 border-zinc-200 rounded-2xl",
                    "text-zinc-900 placeholder:text-zinc-400",
                    "focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10",
                    "transition-all duration-200"
                  )}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-2">
                E-mail
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-primary-500 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className={cn(
                    "w-full h-14 pl-12 pr-4",
                    "bg-white border-2 border-zinc-200 rounded-2xl",
                    "text-zinc-900 placeholder:text-zinc-400",
                    "focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10",
                    "transition-all duration-200"
                  )}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-2">
                Senha
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-primary-500 transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className={cn(
                    "w-full h-14 pl-12 pr-4",
                    "bg-white border-2 border-zinc-200 rounded-2xl",
                    "text-zinc-900 placeholder:text-zinc-400",
                    "focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10",
                    "transition-all duration-200"
                  )}
                />
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-error-50 border border-error-100 text-error-600 text-sm flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-error-500" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full h-14 rounded-2xl",
                "bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800",
                "hover:from-primary-500 hover:via-primary-600 hover:to-primary-700",
                "text-white font-semibold",
                "flex items-center justify-center gap-2",
                "shadow-primary hover:shadow-primary-lg",
                "transition-all duration-200",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                "active:scale-[0.98]"
              )}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Criar conta
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-zinc-500">
            Ao criar conta, você concorda com nossos{" "}
            <a href="#" className="text-primary-600 hover:underline">Termos</a> e{" "}
            <a href="#" className="text-primary-600 hover:underline">Privacidade</a>
          </p>

          <p className="mt-6 text-center text-zinc-500">
            Já tem conta?{" "}
            <Link 
              href="/login" 
              className="text-primary-600 font-semibold hover:text-primary-700 transition-colors"
            >
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
