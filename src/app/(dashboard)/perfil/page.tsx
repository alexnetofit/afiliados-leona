"use client";

import { useState, useEffect } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { User, CreditCard, Key, Save, Check, Loader2, Award } from "lucide-react";
import { COMMISSION_TIERS } from "@/types";

export default function PerfilPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, profile, affiliate, isLoading: userLoading, refetch } = useUser();
  const { isLoading: dataLoading } = useAffiliateData(affiliate?.id);
  
  const [fullName, setFullName] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [wiseDetails, setWiseDetails] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();
  const isLoading = userLoading || dataLoading;

  // Update state when data loads
  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
    if (affiliate?.payout_pix_key) setPixKey(affiliate.payout_pix_key);
    if (affiliate?.payout_wise_details) {
      setWiseDetails(JSON.stringify(affiliate.payout_wise_details, null, 2));
    }
  }, [profile, affiliate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#5B3FA6]" />
          <p className="text-gray-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
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

  const tierNames = { 1: "Bronze", 2: "Prata", 3: "Ouro" };
  const tierName = tierNames[affiliate?.commission_tier as keyof typeof tierNames] || "Bronze";

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      <Header 
        title="Meu Perfil" 
        subtitle="Gerencie suas informações e dados de pagamento"
        userName={profile?.full_name || undefined}
        onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="p-4 lg:p-8 max-w-3xl space-y-6">
        {/* Dados Pessoais */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#EDE9FE]">
                <User className="h-5 w-5 text-[#5B3FA6]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Dados Pessoais</h2>
                <p className="text-sm text-gray-500">Suas informações básicas</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nome Completo</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#5B3FA6] focus:ring-2 focus:ring-[#5B3FA6]/20 outline-none transition-all text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="mt-1.5 text-xs text-gray-400">O email não pode ser alterado</p>
            </div>
          </div>
        </div>

        {/* Código de Afiliado */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#EDE9FE]">
                <Key className="h-5 w-5 text-[#5B3FA6]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Código de Afiliado</h2>
                <p className="text-sm text-gray-500">Seu identificador único</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                <span className="font-mono text-lg font-bold text-[#5B3FA6]">
                  {affiliate?.affiliate_code}
                </span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#3A1D7A] to-[#5B3FA6] text-white">
                <Award className="h-4 w-4" />
                <span className="font-semibold">{tierName} - {tierConfig.percent}%</span>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Assinaturas pagas: <span className="font-bold text-gray-900">{affiliate?.paid_subscriptions_count || 0}</span>
              {affiliate?.commission_tier && affiliate.commission_tier < 3 && (
                <span className="text-gray-400">
                  {" "}(próximo tier: {COMMISSION_TIERS[(affiliate.commission_tier + 1) as 2 | 3].minSubscriptions} assinaturas)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Dados de Pagamento */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-100">
                <CreditCard className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Dados de Pagamento</h2>
                <p className="text-sm text-gray-500">Configure como deseja receber seus pagamentos</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Chave PIX</label>
              <input
                type="text"
                placeholder="CPF, email, telefone ou chave aleatória"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#5B3FA6] focus:ring-2 focus:ring-[#5B3FA6]/20 outline-none transition-all text-gray-900 placeholder:text-gray-400"
              />
              <p className="mt-1.5 text-xs text-gray-400">Insira sua chave PIX para receber pagamentos</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dados Wise (JSON)</label>
              <textarea
                placeholder={`{
  "email": "seu@email.com",
  "account_holder_name": "Seu Nome",
  "currency": "USD"
}`}
                value={wiseDetails}
                onChange={(e) => setWiseDetails(e.target.value)}
                rows={6}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#5B3FA6] focus:ring-2 focus:ring-[#5B3FA6]/20 outline-none transition-all text-gray-900 font-mono text-sm placeholder:text-gray-400 resize-none"
              />
              <p className="mt-1.5 text-xs text-gray-400">Opcional. Insira seus dados Wise no formato JSON</p>
            </div>
          </div>
        </div>

        {/* Error & Save Button */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button 
            onClick={handleSave} 
            disabled={isSaving}
            className="px-6 py-3 rounded-xl bg-[#5B3FA6] text-white font-medium hover:bg-[#3A1D7A] transition-colors flex items-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <>
                <Check className="h-4 w-4" />
                Salvo!
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar Alterações
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
