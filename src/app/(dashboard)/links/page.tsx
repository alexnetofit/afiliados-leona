"use client";

import { useState } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Link2, Copy, Check, Plus, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { getAffiliateLink, copyToClipboard } from "@/lib/utils";

export default function LinksPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { affiliate, isLoading: userLoading, profile } = useUser();
  const { links, refetch, isLoading: dataLoading } = useAffiliateData(affiliate?.id);
  const [newAlias, setNewAlias] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const supabase = createClient();

  const isLoading = userLoading || dataLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#3A1D7A]" />
      </div>
    );
  }

  const handleCopy = async (link: string, id: string) => {
    const success = await copyToClipboard(link);
    if (success) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleCreate = async () => {
    if (!newAlias.trim()) {
      setError("Digite um alias válido");
      return;
    }

    if (links.length >= 3) {
      setError("Você atingiu o limite de 3 links");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: insertError } = await (supabase.from("affiliate_links") as any).insert({
        affiliate_id: affiliate?.id,
        alias: newAlias.trim().toLowerCase().replace(/\s+/g, "-"),
      });

      if (insertError) {
        if (insertError.message.includes("Limite")) {
          setError("Você atingiu o limite de 3 links");
        } else if (insertError.message.includes("unique") || insertError.message.includes("já está em uso")) {
          setError("Este alias já está em uso");
        } else {
          setError("Erro ao criar link");
        }
        return;
      }

      setNewAlias("");
      await refetch();
    } catch {
      setError("Erro ao criar link");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este link?")) return;

    try {
      await supabase.from("affiliate_links").delete().eq("id", id);
      await refetch();
    } catch {
      alert("Erro ao excluir link");
    }
  };

  const mainLink = affiliate?.affiliate_code ? getAffiliateLink(affiliate.affiliate_code) : "";

  return (
    <>
      <Header 
        title="Links" 
        subtitle="Gerencie seus links de afiliado"
        userName={profile?.full_name || undefined}
        onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
        {/* Link Principal */}
        <div className="bg-white rounded-2xl p-6 border border-[#E5E7F2] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(58,29,122,0.06)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-[#3A1D7A]/10 flex items-center justify-center">
              <Link2 className="h-4 w-4 text-[#3A1D7A]" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1F1F2E]">Link principal</h3>
              <p className="text-xs text-[#6B6F8D]">Compartilhe para ganhar comissões</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-2 bg-[#F8F9FC] rounded-xl px-4 py-3 border border-[#E5E7F2]">
              <span className="text-sm text-[#1F1F2E] truncate flex-1">{mainLink}</span>
              <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-md bg-[#3A1D7A]/10 text-[#3A1D7A]">
                Principal
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleCopy(mainLink, "main")}
                className="px-4 py-2.5 rounded-xl bg-[#3A1D7A] text-white text-sm font-medium hover:bg-[#5B3FA6] transition-colors flex items-center gap-2"
              >
                {copiedId === "main" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedId === "main" ? "Copiado" : "Copiar"}
              </button>
              <button
                onClick={() => window.open(mainLink, "_blank")}
                className="p-2.5 rounded-xl border border-[#E5E7F2] text-[#6B6F8D] hover:bg-[#F8F9FC] transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-4 text-xs text-[#6B6F8D]">
            Código: <span className="font-mono font-medium text-[#3A1D7A]">{affiliate?.affiliate_code}</span>
          </p>
        </div>

        {/* Links Personalizados */}
        <div className="bg-white rounded-2xl p-6 border border-[#E5E7F2] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(58,29,122,0.06)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-[#1F1F2E]">Links personalizados</h3>
              <p className="text-xs text-[#6B6F8D]">Crie até 3 aliases</p>
            </div>
            <span className="text-sm font-medium px-2.5 py-1 rounded-lg bg-[#F8F9FC] text-[#6B6F8D]">
              {links.length}/3
            </span>
          </div>

          {/* Criar novo */}
          {links.length < 3 && (
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <input
                type="text"
                placeholder="meu-link-personalizado"
                value={newAlias}
                onChange={(e) => {
                  setNewAlias(e.target.value);
                  setError("");
                }}
                className="flex-1 h-11 px-4 bg-[#F8F9FC] border border-[#E5E7F2] rounded-xl text-[#1F1F2E] placeholder:text-[#6B6F8D]/60 focus:outline-none focus:border-[#3A1D7A] focus:ring-4 focus:ring-[#3A1D7A]/10 transition-all text-sm"
              />
              <button 
                onClick={handleCreate} 
                disabled={isCreating}
                className="h-11 px-5 rounded-xl bg-[#3A1D7A] text-white text-sm font-medium hover:bg-[#5B3FA6] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Criar
              </button>
            </div>
          )}

          {error && (
            <p className="mb-4 text-sm text-red-600">{error}</p>
          )}

          {/* Lista */}
          {links.length === 0 ? (
            <div className="text-center py-10 bg-[#F8F9FC] rounded-xl border border-dashed border-[#E5E7F2]">
              <div className="h-10 w-10 mx-auto rounded-lg bg-[#EEF0F6] flex items-center justify-center mb-3">
                <Link2 className="h-5 w-5 text-[#6B6F8D]" />
              </div>
              <p className="text-sm font-medium text-[#1F1F2E]">Nenhum link personalizado</p>
              <p className="text-xs text-[#6B6F8D] mt-1">Crie aliases para rastrear campanhas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {links.map((link) => {
                const fullLink = getAffiliateLink(link.alias);
                return (
                  <div
                    key={link.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-[#F8F9FC] border border-[#E5E7F2]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1F1F2E] truncate">{fullLink}</p>
                      <p className="text-xs text-[#6B6F8D] mt-0.5">
                        Alias: <span className="font-mono text-[#3A1D7A]">{link.alias}</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopy(fullLink, link.id)}
                        className="p-2 rounded-lg border border-[#E5E7F2] bg-white text-[#6B6F8D] hover:text-[#3A1D7A] hover:border-[#3A1D7A]/30 transition-colors"
                      >
                        {copiedId === link.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(link.id)}
                        className="p-2 rounded-lg border border-[#E5E7F2] bg-white text-[#6B6F8D] hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
