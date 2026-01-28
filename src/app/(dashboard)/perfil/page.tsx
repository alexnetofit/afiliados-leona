"use client";

import { useState, useEffect } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { User, CreditCard, Key, Save, Check, Loader2 } from "lucide-react";
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

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
    if (affiliate?.payout_pix_key) setPixKey(affiliate.payout_pix_key);
    if (affiliate?.payout_wise_details) {
      setWiseDetails(JSON.stringify(affiliate.payout_wise_details, null, 2));
    }
  }, [profile, affiliate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#3A1D7A]" />
      </div>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    setError("");
    setSaved(false);

    try {
      if (fullName !== profile?.full_name) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: profileError } = await (supabase.from("profiles") as any)
          .update({ full_name: fullName })
          .eq("id", user?.id);

        if (profileError) throw profileError;
      }

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
    <>
      <Header 
        title="Perfil" 
        subtitle="Suas informações"
        userName={profile?.full_name || undefined}
        onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
        {/* Dados Pessoais */}
        <div className="bg-white rounded-2xl border border-[#E5E7F2] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(58,29,122,0.06)] overflow-hidden">
          <div className="p-5 border-b border-[#E5E7F2] flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#3A1D7A]/10 flex items-center justify-center">
              <User className="h-4 w-4 text-[#3A1D7A]" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1F1F2E]">Dados pessoais</h3>
              <p className="text-xs text-[#6B6F8D]">Suas informações básicas</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#1F1F2E]">Nome completo</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-11 px-4 bg-[#F8F9FC] border border-[#E5E7F2] rounded-xl text-[#1F1F2E] focus:outline-none focus:border-[#3A1D7A] focus:ring-4 focus:ring-[#3A1D7A]/10 transition-all text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#1F1F2E]">E-mail</label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full h-11 px-4 bg-[#EEF0F6] border border-[#E5E7F2] rounded-xl text-[#6B6F8D] text-sm cursor-not-allowed"
              />
              <p className="text-xs text-[#6B6F8D]">O e-mail não pode ser alterado</p>
            </div>
          </div>
        </div>

        {/* Código */}
        <div className="bg-white rounded-2xl border border-[#E5E7F2] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(58,29,122,0.06)] overflow-hidden">
          <div className="p-5 border-b border-[#E5E7F2] flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#3A1D7A]/10 flex items-center justify-center">
              <Key className="h-4 w-4 text-[#3A1D7A]" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1F1F2E]">Código de afiliado</h3>
              <p className="text-xs text-[#6B6F8D]">Seu identificador único</p>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 bg-[#F8F9FC] rounded-xl px-4 py-3 border border-[#E5E7F2]">
                <span className="font-mono text-lg font-semibold text-[#3A1D7A]">
                  {affiliate?.affiliate_code}
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-[#3A1D7A] text-white text-sm font-medium">
                {tierName} • {tierConfig.percent}%
              </div>
            </div>
            <p className="mt-4 text-sm text-[#6B6F8D]">
              Vendas: <span className="font-semibold text-[#1F1F2E]">{affiliate?.paid_subscriptions_count || 0}</span>
              {affiliate?.commission_tier && affiliate.commission_tier < 3 && (
                <span className="text-[#6B6F8D]">
                  {" "}• Próximo nível em {COMMISSION_TIERS[(affiliate.commission_tier + 1) as 2 | 3].minSubscriptions} vendas
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Pagamento */}
        <div className="bg-white rounded-2xl border border-[#E5E7F2] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(58,29,122,0.06)] overflow-hidden">
          <div className="p-5 border-b border-[#E5E7F2] flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-emerald-600" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1F1F2E]">Dados de pagamento</h3>
              <p className="text-xs text-[#6B6F8D]">Como você deseja receber</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#1F1F2E]">Chave PIX</label>
              <input
                type="text"
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                className="w-full h-11 px-4 bg-[#F8F9FC] border border-[#E5E7F2] rounded-xl text-[#1F1F2E] placeholder:text-[#6B6F8D]/60 focus:outline-none focus:border-[#3A1D7A] focus:ring-4 focus:ring-[#3A1D7A]/10 transition-all text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#1F1F2E]">Dados Wise (JSON)</label>
              <textarea
                placeholder={`{\n  "email": "seu@email.com",\n  "currency": "USD"\n}`}
                value={wiseDetails}
                onChange={(e) => setWiseDetails(e.target.value)}
                rows={5}
                className="w-full px-4 py-3 bg-[#F8F9FC] border border-[#E5E7F2] rounded-xl text-[#1F1F2E] placeholder:text-[#6B6F8D]/60 focus:outline-none focus:border-[#3A1D7A] focus:ring-4 focus:ring-[#3A1D7A]/10 transition-all text-sm font-mono resize-none"
              />
              <p className="text-xs text-[#6B6F8D]">Opcional. Para recebimentos internacionais.</p>
            </div>
          </div>
        </div>

        {/* Erro e botão */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button 
            onClick={handleSave} 
            disabled={isSaving}
            className="h-11 px-6 rounded-xl bg-[#3A1D7A] text-white text-sm font-medium hover:bg-[#5B3FA6] transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <>
                <Check className="h-4 w-4" />
                Salvo
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar alterações
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
