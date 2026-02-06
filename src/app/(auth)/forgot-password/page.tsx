"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Mail, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  // Preencher email da query string
  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="h-16 w-16 mx-auto rounded-full bg-success-100 flex items-center justify-center mb-6">
          <CheckCircle className="h-8 w-8 text-success-600" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-3">E-mail enviado!</h2>
        <p className="text-zinc-500 mb-8">
          Verifique sua caixa de entrada em <strong className="text-zinc-700">{email}</strong>. 
          Clique no link que enviamos para redefinir sua senha.
        </p>
        <Link 
          href="/login"
          className="inline-flex items-center gap-2 text-primary-600 font-semibold hover:text-primary-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="text-center mb-10">
        <h2 className="text-2xl font-bold text-zinc-900">Esqueceu sua senha?</h2>
        <p className="mt-3 text-zinc-500">
          Informe seu e-mail e enviaremos um link para redefinir sua senha.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
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
                "w-full h-12 pl-12 pr-4",
                "bg-white border border-zinc-200 rounded-lg",
                "text-zinc-900 placeholder:text-zinc-400",
                "focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20",
                "transition-colors"
              )}
            />
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-error-50 border border-error-100 text-error-600 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={cn(
            "w-full h-10 rounded-lg",
            "bg-primary-600 hover:bg-primary-700",
            "text-white font-medium text-sm",
            "flex items-center justify-center gap-2",
            "transition-colors",
            "disabled:opacity-60 disabled:cursor-not-allowed"
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Enviar link de recuperação"
          )}
        </button>
      </form>

      <div className="mt-8 text-center">
        <Link 
          href="/login"
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-700 text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o login
        </Link>
      </div>
    </>
  );
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-10 flex justify-center">
          <Image
            src="/logo-leona-roxa.png"
            alt="Leona"
            width={120}
            height={40}
            className="object-contain"
          />
        </div>

        <Suspense fallback={<LoadingFallback />}>
          <ForgotPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
