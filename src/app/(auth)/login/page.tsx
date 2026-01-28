"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, Loader2, ArrowRight, TrendingUp, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: TrendingUp, title: "Até 40% de comissão", description: "Ganhos recorrentes em cada renovação" },
  { icon: Shield, title: "Pagamentos garantidos", description: "Receba via PIX em até 15 dias" },
  { icon: Zap, title: "Dashboard em tempo real", description: "Acompanhe suas vendas e comissões" },
];

export default function LoginPage() {
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

    const { error: err } = await supabase.auth.signInWithPassword({ email, password });

    if (err) {
      setError(err.message === "Invalid login credentials" ? "E-mail ou senha incorretos" : err.message);
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
              Programa de
              <span className="block mt-1 bg-gradient-to-r from-primary-200 to-white bg-clip-text text-transparent">
                Parceiros Leona
              </span>
            </h1>
            <p className="mt-6 text-lg text-primary-100 leading-relaxed">
              Ganhe comissões recorrentes indicando a Leona para seus contatos. 
              Dashboard completo, pagamentos garantidos.
            </p>
            
            {/* Features */}
            <div className="mt-12 space-y-6">
              {FEATURES.map((feature, i) => (
                <div 
                  key={feature.title} 
                  className="flex items-start gap-4 animate-fade-in-up"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="flex-shrink-0 h-12 w-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
                    <feature.icon className="h-6 w-6 text-primary-200" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{feature.title}</h3>
                    <p className="text-sm text-primary-200/80">{feature.description}</p>
                  </div>
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
            <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Bem-vindo de volta</h2>
            <p className="mt-3 text-zinc-500">Acesse sua conta de parceiro</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                  placeholder="••••••••"
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
                  Entrar
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-10 text-center text-zinc-500">
            Não tem conta?{" "}
            <Link 
              href="/register" 
              className="text-primary-600 font-semibold hover:text-primary-700 transition-colors"
            >
              Criar conta grátis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
