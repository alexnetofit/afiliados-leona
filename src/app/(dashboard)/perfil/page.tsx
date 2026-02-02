"use client";

import { useState, useEffect } from "react";
import { useAppData } from "@/contexts";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Card, Button, Badge, Input, LoadingScreen, Alert, Progress } from "@/components/ui/index";
import { User, Key, CreditCard, Save, Check, Trophy, Star, ExternalLink, Lock, Eye, EyeOff } from "lucide-react";
import { COMMISSION_TIERS } from "@/types";

export default function PerfilPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, profile, affiliate, subscriptions, isLoading, isInitialized, refetch } = useAppData();
  
  const [name, setName] = useState("");
  const [pix, setPix] = useState("");
  const [wiseEmail, setWiseEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  
  // Password change states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const supabase = createClient();

  useEffect(() => {
    if (profile?.full_name) setName(profile.full_name);
    if (affiliate?.payout_pix_key) setPix(affiliate.payout_pix_key);
    if (affiliate?.payout_wise_details) {
      const details = affiliate.payout_wise_details;
      if (typeof details === 'object' && details !== null && 'email' in details) {
        setWiseEmail((details as { email?: string }).email || "");
      }
    }
  }, [profile, affiliate]);

  // Only show loading on first load, not on navigation
  if (isLoading && !isInitialized) {
    return <LoadingScreen message="Carregando perfil..." />;
  }

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      if (name !== profile?.full_name) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("profiles") as any).update({ full_name: name }).eq("id", user?.id);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("affiliates") as any).update({
        payout_pix_key: pix || null,
        payout_wise_details: wiseEmail.trim() ? { email: wiseEmail.trim() } : null,
      }).eq("id", affiliate?.id);

      setSaved(true);
      await refetch();
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSaved(false);

    if (newPassword.length < 6) {
      setPasswordError("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem");
      return;
    }

    setSavingPassword(true);

    try {
      // First, verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: currentPassword,
      });

      if (signInError) {
        setPasswordError("Senha atual incorreta");
        setSavingPassword(false);
        return;
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setPasswordError(updateError.message);
        setSavingPassword(false);
        return;
      }

      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch {
      setPasswordError("Erro ao alterar senha");
    } finally {
      setSavingPassword(false);
    }
  };

  const tierName = affiliate?.commission_tier === 3 ? "Ouro" : affiliate?.commission_tier === 2 ? "Prata" : "Bronze";
  const tierPercent = COMMISSION_TIERS[affiliate?.commission_tier || 1].percent;
  
  // Calcular clientes únicos (vendas = clientes diferentes que pagaram)
  const currentSales = new Set(
    (subscriptions || [])
      .filter(s => s.status === "active" || s.status === "past_due" || s.status === "canceled")
      .map(s => s.stripe_customer_id)
  ).size;
  
  const nextTier = affiliate?.commission_tier && affiliate.commission_tier < 3 
    ? COMMISSION_TIERS[(affiliate.commission_tier + 1) as 2 | 3]
    : null;
  const progressToNextTier = nextTier 
    ? (currentSales / nextTier.minSubscriptions) * 100
    : 100;

  return (
    <>
      <Header
        title="Perfil"
        description="Suas informações e configurações"
        user={profile ? { name: profile.full_name || "" } : undefined}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-8 animate-fade-in-up">
          
          {/* Personal Data */}
          <Card>
            <div className="flex items-center gap-4 mb-8">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center">
                <User className="h-7 w-7 text-primary-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Dados pessoais</h3>
                <p className="text-sm text-zinc-500">Suas informações básicas</p>
              </div>
            </div>

            <div className="space-y-5">
              <Input
                label="Nome completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
              />
              <Input
                label="E-mail"
                value={user?.email || ""}
                disabled
                hint="O e-mail não pode ser alterado"
              />
            </div>
          </Card>

          {/* Affiliate Code & Tier */}
          <Card gradient>
            <div className="flex items-center gap-4 mb-8">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-primary">
                <Key className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Código de afiliado</h3>
                <p className="text-sm text-zinc-500">Seu identificador único</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-zinc-50 rounded-xl border border-zinc-200 mb-6">
              <code className="text-2xl font-bold font-mono text-primary-600 tracking-wider">
                {affiliate?.affiliate_code}
              </code>
              <Badge 
                variant={tierName === "Ouro" ? "warning" : tierName === "Prata" ? "default" : "primary"}
                size="lg"
              >
                <Trophy className="h-3.5 w-3.5" />
                {tierName} • {tierPercent}%
              </Badge>
            </div>

            {/* Progress to next tier */}
            {nextTier && (
              <div className="p-4 bg-gradient-to-br from-primary-50 to-primary-100/50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-zinc-700">Progresso para o próximo nível</span>
                  <span className="text-sm font-bold text-primary-600">
                    {currentSales}/{nextTier.minSubscriptions} vendas
                  </span>
                </div>
                <Progress value={progressToNextTier} variant="primary" />
                <p className="text-xs text-zinc-500 mt-2">
                  Mais {nextTier.minSubscriptions - currentSales} vendas para {nextTier.percent}% de comissão
                </p>
              </div>
            )}

            {!nextTier && (
              <div className="flex items-center gap-3 p-4 bg-success-50 rounded-xl">
                <Star className="h-5 w-5 text-success-600" />
                <div>
                  <p className="text-sm font-semibold text-success-700">Nível máximo atingido!</p>
                  <p className="text-xs text-success-600">Você está recebendo a comissão máxima de 40%</p>
                </div>
              </div>
            )}
          </Card>

          {/* Change Password */}
          <Card>
            <div className="flex items-center gap-4 mb-8">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-50 flex items-center justify-center">
                <Lock className="h-7 w-7 text-zinc-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Alterar senha</h3>
                <p className="text-sm text-zinc-500">Atualize sua senha de acesso</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="relative">
                <Input
                  label="Senha atual"
                  type={showPasswords ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              
              <div className="relative">
                <Input
                  label="Nova senha"
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  hint="Mínimo de 6 caracteres"
                />
              </div>
              
              <div className="relative">
                <Input
                  label="Confirmar nova senha"
                  type={showPasswords ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 transition-colors"
              >
                {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showPasswords ? "Ocultar senhas" : "Mostrar senhas"}
              </button>

              {passwordError && (
                <Alert variant="error">{passwordError}</Alert>
              )}

              {passwordSaved && (
                <Alert variant="success" icon={Check}>
                  Senha alterada com sucesso!
                </Alert>
              )}

              <Button 
                onClick={handleChangePassword} 
                loading={savingPassword}
                variant="secondary"
                disabled={!currentPassword || !newPassword || !confirmPassword}
              >
                Alterar senha
              </Button>
            </div>
          </Card>

          {/* Payment Settings */}
          <Card>
            <div className="flex items-center gap-4 mb-8">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-success-100 to-success-50 flex items-center justify-center">
                <CreditCard className="h-7 w-7 text-success-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Dados de pagamento</h3>
                <p className="text-sm text-zinc-500">Como você deseja receber</p>
              </div>
            </div>

            <div className="space-y-6">
              <Input
                label="Chave PIX"
                value={pix}
                onChange={(e) => setPix(e.target.value)}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                hint="Recomendamos usar a chave aleatória para maior segurança"
              />
              
              {/* Wise Section */}
              <div>
                <Input
                  label="E-mail da conta Wise"
                  value={wiseEmail}
                  onChange={(e) => setWiseEmail(e.target.value)}
                  placeholder="seu@email.com"
                  hint="Opcional - para receber em dólar ou euro"
                />
                
                {/* Wise signup CTA */}
                <div className="mt-4 p-4 bg-gradient-to-br from-info-50 to-info-100/50 rounded-xl border border-info-200">
                  <p className="text-sm text-info-800 mb-3">
                    Ainda não tem conta Wise? Crie sua conta gratuita e receba transferências internacionais com as melhores taxas.
                  </p>
                  <a
                    href="https://wise.com/invite/ihpc/alexn496"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#9FE870] hover:bg-[#8ED85F] text-[#163300] font-semibold text-sm rounded-xl transition-colors"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.5 2L2 7l10.5 5L23 7l-10.5-5zM2 17l10.5 5 10.5-5M2 12l10.5 5 10.5-5"/>
                    </svg>
                    Criar conta Wise grátis
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </Card>

          {error && (
            <Alert variant="error">{error}</Alert>
          )}

          {saved && (
            <Alert variant="success" icon={Check}>
              Alterações salvas com sucesso!
            </Alert>
          )}

          <div className="flex justify-end">
            <Button 
              onClick={handleSave} 
              loading={saving} 
              icon={saved ? Check : Save}
              variant={saved ? "success" : "primary"}
              size="lg"
            >
              {saved ? "Salvo!" : "Salvar alterações"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
