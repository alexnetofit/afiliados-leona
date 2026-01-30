"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  // Check if user has a valid session from the reset link
  useEffect(() => {
    // Listen for auth state changes - this handles the token from the URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        // User clicked the reset link - session is now valid
        return;
      }
      
      if (event === "SIGNED_IN" && session) {
        // Session established from recovery link
        return;
      }
      
      // If no session after initial check, redirect
      if (event === "INITIAL_SESSION" && !session) {
        router.push("/forgot-password");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    setLoading(true);

    const { error: err } = await supabase.auth.updateUser({
      password: password,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    // Redirect to dashboard after 2 seconds
    setTimeout(() => {
      router.push("/dashboard");
    }, 2000);
  };

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

        {success ? (
          /* Success state */
          <div className="text-center">
            <div className="h-16 w-16 mx-auto rounded-full bg-success-100 flex items-center justify-center mb-6">
              <CheckCircle className="h-8 w-8 text-success-600" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 mb-3">Senha alterada!</h2>
            <p className="text-zinc-500">
              Sua senha foi atualizada com sucesso. Redirecionando...
            </p>
          </div>
        ) : (
          /* Form state */
          <>
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-zinc-900">Criar nova senha</h2>
              <p className="mt-3 text-zinc-500">
                Digite sua nova senha abaixo.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  Nova senha
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-primary-500 transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={cn(
                      "w-full h-12 pl-12 pr-12",
                      "bg-white border border-zinc-200 rounded-lg",
                      "text-zinc-900 placeholder:text-zinc-400",
                      "focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20",
                      "transition-colors"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">
                  Confirmar senha
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 group-focus-within:text-primary-500 transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
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
                  "Salvar nova senha"
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <Link 
                href="/login"
                className="text-zinc-500 hover:text-zinc-700 text-sm transition-colors"
              >
                Voltar para o login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
