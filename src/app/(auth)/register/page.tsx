"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, User, Loader2, ArrowRight, Check } from "lucide-react";

const BENEFITS = [
  "Comissões de até 40%",
  "Pagamentos via PIX",
  "Dashboard completo",
  "Suporte dedicado",
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
    <div className="min-h-screen bg-[#F8F9FC] grid lg:grid-cols-2">
      {/* Left - Hero */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-[#F8F9FC] via-[#EDE9FE]/30 to-[#F8F9FC]">
        <Image
          src="/logo-leona-roxa.png"
          alt="Leona"
          width={100}
          height={32}
          className="object-contain"
        />
        
        <div className="max-w-md">
          <h1 className="text-4xl font-semibold text-[#111827] leading-tight">
            Torne-se um parceiro
          </h1>
          <p className="mt-4 text-lg text-[#6B7280]">
            Crie sua conta e comece a ganhar comissões hoje.
          </p>
          
          <div className="mt-10 space-y-4">
            {BENEFITS.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-[#EDE9FE] flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-[#5B21B6]" />
                </div>
                <span className="text-[#111827]">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-[#9CA3AF]">© 2026 Leona</p>
      </div>

      {/* Right - Form */}
      <div className="flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10">
            <Image
              src="/logo-leona-roxa.png"
              alt="Leona"
              width={90}
              height={28}
              className="object-contain"
            />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-[#111827]">Criar conta</h2>
            <p className="mt-2 text-[#6B7280]">Preencha seus dados</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#111827] mb-2">
                Nome
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9CA3AF]" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="
                    w-full h-12 pl-12 pr-4
                    bg-white border border-[#E8EAF0] rounded-xl
                    text-[#111827] placeholder:text-[#9CA3AF]
                    focus:outline-none focus:border-[#5B21B6] focus:ring-4 focus:ring-[#5B21B6]/10
                    transition-all
                  "
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111827] mb-2">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9CA3AF]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="
                    w-full h-12 pl-12 pr-4
                    bg-white border border-[#E8EAF0] rounded-xl
                    text-[#111827] placeholder:text-[#9CA3AF]
                    focus:outline-none focus:border-[#5B21B6] focus:ring-4 focus:ring-[#5B21B6]/10
                    transition-all
                  "
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111827] mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9CA3AF]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="
                    w-full h-12 pl-12 pr-4
                    bg-white border border-[#E8EAF0] rounded-xl
                    text-[#111827] placeholder:text-[#9CA3AF]
                    focus:outline-none focus:border-[#5B21B6] focus:ring-4 focus:ring-[#5B21B6]/10
                    transition-all
                  "
                />
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-[#FEE2E2] text-[#DC2626] text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="
                w-full h-12 rounded-xl
                bg-[#5B21B6] hover:bg-[#4C1D95] text-white font-medium
                flex items-center justify-center gap-2
                transition-colors disabled:opacity-60
              "
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Criar conta
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[#6B7280]">
            Já tem conta?{" "}
            <Link href="/login" className="text-[#5B21B6] font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
