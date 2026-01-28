"use client";

import { useState, useEffect } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Card, Button, Badge, Input, Textarea, LoadingScreen, Alert, Progress } from "@/components/ui/index";
import { User, Key, CreditCard, Save, Check, Trophy, Star } from "lucide-react";
import { COMMISSION_TIERS } from "@/types";
import { cn } from "@/lib/utils";

export default function PerfilPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, profile, affiliate, isLoading: userLoading, refetch } = useUser();
  const { isLoading: dataLoading } = useAffiliateData(affiliate?.id);
  
  const [name, setName] = useState("");
  const [pix, setPix] = useState("");
  const [wise, setWise] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();
  const isLoading = userLoading || dataLoading;

  useEffect(() => {
    if (profile?.full_name) setName(profile.full_name);
    if (affiliate?.payout_pix_key) setPix(affiliate.payout_pix_key);
    if (affiliate?.payout_wise_details) setWise(JSON.stringify(affiliate.payout_wise_details, null, 2));
  }, [profile, affiliate]);

  if (isLoading) {
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

      let wiseJson = null;
      if (wise.trim()) {
        try {
          wiseJson = JSON.parse(wise);
        } catch {
          setError("JSON inválido no Wise");
          setSaving(false);
          return;
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("affiliates") as any).update({
        payout_pix_key: pix || null,
        payout_wise_details: wiseJson,
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

  const tierName = affiliate?.commission_tier === 3 ? "Ouro" : affiliate?.commission_tier === 2 ? "Prata" : "Bronze";
  const tierPercent = COMMISSION_TIERS[affiliate?.commission_tier || 1].percent;
  const currentSales = affiliate?.paid_subscriptions_count || 0;
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

            <div className="space-y-5">
              <Input
                label="Chave PIX"
                value={pix}
                onChange={(e) => setPix(e.target.value)}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                hint="Recomendamos usar a chave aleatória para maior segurança"
              />
              <Textarea
                label="Dados Wise (JSON)"
                value={wise}
                onChange={(e) => setWise(e.target.value)}
                placeholder='{"email": "seu@email.com", "currency": "USD"}'
                rows={4}
                hint="Opcional - apenas se preferir receber em dólar"
              />
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
