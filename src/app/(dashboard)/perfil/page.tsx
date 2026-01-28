"use client";

import { useState } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { LoadingScreen } from "@/components/ui/spinner";
import { User, CreditCard, Key, Save, Check } from "lucide-react";
import { COMMISSION_TIERS } from "@/types";

export default function PerfilPage() {
  const { user, profile, affiliate, isLoading: userLoading, refetch } = useUser();
  const { isLoading: dataLoading } = useAffiliateData(affiliate?.id);
  
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [pixKey, setPixKey] = useState(affiliate?.payout_pix_key || "");
  const [wiseDetails, setWiseDetails] = useState(
    affiliate?.payout_wise_details 
      ? JSON.stringify(affiliate.payout_wise_details, null, 2) 
      : ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();
  const isLoading = userLoading || dataLoading;

  if (isLoading) {
    return <LoadingScreen />;
  }

  const handleSave = async () => {
    setIsSaving(true);
    setError("");
    setSaved(false);

    try {
      // Update profile
      if (fullName !== profile?.full_name) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: profileError } = await (supabase.from("profiles") as any)
          .update({ full_name: fullName })
          .eq("id", user?.id);

        if (profileError) throw profileError;
      }

      // Update affiliate
      let wiseDetailsJson = null;
      if (wiseDetails.trim()) {
        try {
          wiseDetailsJson = JSON.parse(wiseDetails);
        } catch {
          setError("Dados Wise inválidos. Verifique o formato JSON.");
          setIsSaving(false);
          return;
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: affiliateError } = await (supabase.from("affiliates") as any)
        .update({
          payout_pix_key: pixKey || null,
          payout_wise_details: wiseDetailsJson,
        })
        .eq("id", affiliate?.id);

      if (affiliateError) throw affiliateError;

      setSaved(true);
      await refetch();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError("Erro ao salvar. Tente novamente.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const tierConfig = affiliate?.commission_tier 
    ? COMMISSION_TIERS[affiliate.commission_tier] 
    : COMMISSION_TIERS[1];

  return (
    <div className="min-h-screen">
      <Header title="Meu Perfil" subtitle="Gerencie suas informações e dados de pagamento" />

      <div className="p-6 space-y-6 max-w-3xl">
        {/* Dados Pessoais */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary-lightest flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Dados Pessoais</CardTitle>
                <CardDescription>Suas informações básicas</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Nome Completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <Input
              label="Email"
              value={user?.email || ""}
              disabled
              hint="O email não pode ser alterado"
            />
          </CardContent>
        </Card>

        {/* Código de Afiliado */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary-lightest flex items-center justify-center">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Código de Afiliado</CardTitle>
                <CardDescription>Seu identificador único</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-background rounded-lg px-4 py-3 border border-border">
                <span className="font-mono text-lg font-semibold text-text-primary">
                  {affiliate?.affiliate_code}
                </span>
              </div>
              <Badge variant="default" className="text-sm py-1.5 px-3">
                Tier {affiliate?.commission_tier} - {tierConfig.percent}%
              </Badge>
            </div>
            <p className="mt-3 text-sm text-text-secondary">
              Assinaturas pagas: <strong>{affiliate?.paid_subscriptions_count || 0}</strong>
              {affiliate?.commission_tier && affiliate.commission_tier < 3 && (
                <span>
                  {" "}
                  (próximo tier: {COMMISSION_TIERS[(affiliate.commission_tier + 1) as 2 | 3].minSubscriptions} assinaturas)
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Dados de Pagamento */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-success-light flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-success" />
              </div>
              <div>
                <CardTitle>Dados de Pagamento</CardTitle>
                <CardDescription>Configure como deseja receber seus pagamentos</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Chave PIX"
              placeholder="CPF, email, telefone ou chave aleatória"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              hint="Insira sua chave PIX para receber pagamentos"
            />

            <Textarea
              label="Dados Wise (JSON)"
              placeholder={`{
  "email": "seu@email.com",
  "account_holder_name": "Seu Nome",
  "currency": "USD"
}`}
              value={wiseDetails}
              onChange={(e) => setWiseDetails(e.target.value)}
              hint="Opcional. Insira seus dados Wise no formato JSON"
              className="font-mono text-sm"
              rows={6}
            />
          </CardContent>
        </Card>

        {/* Error & Save Button */}
        {error && (
          <div className="rounded-lg bg-error-light p-4 text-sm text-error">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} isLoading={isSaving} className="min-w-32">
            {saved ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Salvo!
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
