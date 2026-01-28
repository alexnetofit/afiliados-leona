"use client";

import { useState, useEffect } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Card, Button, Badge } from "@/components/ui/index";
import { User, Key, CreditCard, Save, Check, Loader2 } from "lucide-react";
import { COMMISSION_TIERS } from "@/types";

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
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#5B21B6]" />
      </div>
    );
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

  return (
    <>
      <Header
        title="Perfil"
        description="Suas informações"
        user={profile ? { name: profile.full_name || "" } : undefined}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 p-6 lg:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Dados pessoais */}
          <Card>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-[#EDE9FE] flex items-center justify-center">
                <User className="h-5 w-5 text-[#5B21B6]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#111827]">Dados pessoais</h3>
                <p className="text-sm text-[#6B7280]">Suas informações básicas</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-2">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 px-4 bg-white border border-[#E8EAF0] rounded-xl text-sm text-[#111827] focus:outline-none focus:border-[#5B21B6] focus:ring-4 focus:ring-[#5B21B6]/10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-2">E-mail</label>
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full h-11 px-4 bg-[#F8F9FC] border border-[#E8EAF0] rounded-xl text-sm text-[#6B7280] cursor-not-allowed"
                />
              </div>
            </div>
          </Card>

          {/* Código */}
          <Card>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-[#EDE9FE] flex items-center justify-center">
                <Key className="h-5 w-5 text-[#5B21B6]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#111827]">Código de afiliado</h3>
                <p className="text-sm text-[#6B7280]">Seu identificador</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 px-4 py-3 bg-[#F8F9FC] rounded-xl border border-[#E8EAF0]">
                <span className="font-mono text-lg font-semibold text-[#5B21B6]">{affiliate?.affiliate_code}</span>
              </div>
              <Badge variant="primary">{tierName} • {tierPercent}%</Badge>
            </div>

            <p className="mt-4 text-sm text-[#6B7280]">
              {affiliate?.paid_subscriptions_count || 0} vendas
              {affiliate?.commission_tier && affiliate.commission_tier < 3 && (
                <span> • Próximo nível em {COMMISSION_TIERS[(affiliate.commission_tier + 1) as 2 | 3].minSubscriptions} vendas</span>
              )}
            </p>
          </Card>

          {/* Pagamento */}
          <Card>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-[#D1FAE5] flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-[#059669]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#111827]">Dados de pagamento</h3>
                <p className="text-sm text-[#6B7280]">Como você deseja receber</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-2">Chave PIX</label>
                <input
                  type="text"
                  value={pix}
                  onChange={(e) => setPix(e.target.value)}
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                  className="w-full h-11 px-4 bg-white border border-[#E8EAF0] rounded-xl text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#5B21B6] focus:ring-4 focus:ring-[#5B21B6]/10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#111827] mb-2">Dados Wise (JSON)</label>
                <textarea
                  value={wise}
                  onChange={(e) => setWise(e.target.value)}
                  placeholder='{"email": "...", "currency": "USD"}'
                  rows={4}
                  className="w-full px-4 py-3 bg-white border border-[#E8EAF0] rounded-xl text-sm font-mono text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#5B21B6] focus:ring-4 focus:ring-[#5B21B6]/10 resize-none"
                />
              </div>
            </div>
          </Card>

          {error && (
            <div className="p-4 rounded-xl bg-[#FEE2E2] text-[#DC2626] text-sm">{error}</div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSave} loading={saving} icon={saved ? Check : Save}>
              {saved ? "Salvo" : "Salvar"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
