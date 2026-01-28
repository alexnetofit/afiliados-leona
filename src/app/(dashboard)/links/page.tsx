"use client";

import { useState } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Link2, Copy, Check, Plus, Trash2, ExternalLink, Loader2, Lightbulb } from "lucide-react";
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
      <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#5B3FA6]" />
          <p className="text-gray-500 text-sm">Carregando...</p>
        </div>
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
    <div className="min-h-screen bg-[#F8F9FC]">
      <Header 
        title="Meus Links" 
        subtitle="Gerencie seus links de afiliado"
        userName={profile?.full_name || undefined}
        onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Main Link Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-[#EDE9FE]">
              <Link2 className="h-5 w-5 text-[#5B3FA6]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Link Principal</h2>
              <p className="text-sm text-gray-500">Compartilhe para ganhar comissões</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
              <span className="text-sm text-gray-700 truncate flex-1">{mainLink}</span>
              <span className="shrink-0 text-xs font-semibold px-2 py-1 rounded-lg bg-[#EDE9FE] text-[#5B3FA6]">
                Principal
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleCopy(mainLink, "main")}
                className="flex-1 sm:flex-none px-4 py-3 rounded-xl bg-[#5B3FA6] text-white font-medium hover:bg-[#3A1D7A] transition-colors flex items-center justify-center gap-2"
              >
                {copiedId === "main" ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copiar
                  </>
                )}
              </button>
              <button
                onClick={() => window.open(mainLink, "_blank")}
                className="px-4 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Código: <span className="font-mono font-semibold text-[#5B3FA6]">{affiliate?.affiliate_code}</span>
          </p>
        </div>

        {/* Custom Links */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Links Personalizados</h2>
              <p className="text-sm text-gray-500">Crie até 3 aliases personalizados</p>
            </div>
            <span className="text-sm font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-600">
              {links.length}/3
            </span>
          </div>

          {/* Create new link */}
          {links.length < 3 && (
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="meu-link-personalizado"
                  value={newAlias}
                  onChange={(e) => {
                    setNewAlias(e.target.value);
                    setError("");
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-[#5B3FA6] focus:ring-2 focus:ring-[#5B3FA6]/20 outline-none transition-all text-gray-900 placeholder:text-gray-400"
                />
                {error && (
                  <p className="mt-2 text-sm text-red-600">{error}</p>
                )}
              </div>
              <button 
                onClick={handleCreate} 
                disabled={isCreating}
                className="px-6 py-3 rounded-xl bg-[#5B3FA6] text-white font-medium hover:bg-[#3A1D7A] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Criar
                  </>
                )}
              </button>
            </div>
          )}

          {/* Links list */}
          {links.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <Link2 className="h-7 w-7 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">Nenhum link personalizado</p>
              <p className="text-gray-400 text-sm mt-1">Crie aliases para facilitar o compartilhamento</p>
            </div>
          ) : (
            <div className="space-y-3">
              {links.map((link) => {
                const fullLink = getAffiliateLink(link.alias);
                return (
                  <div
                    key={link.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {fullLink}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Alias: <span className="font-mono font-semibold text-[#5B3FA6]">{link.alias}</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopy(fullLink, link.id)}
                        className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                      >
                        {copiedId === link.id ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(link.id)}
                        className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors"
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

        {/* Tips */}
        <div className="bg-gradient-to-br from-[#EDE9FE] to-[#DDD6FE] rounded-2xl p-6 border border-[#C4B5FD]">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-white/60">
              <Lightbulb className="h-5 w-5 text-[#5B3FA6]" />
            </div>
            <h2 className="text-lg font-semibold text-[#3A1D7A]">Dicas de Uso</h2>
          </div>
          <ul className="space-y-3">
            {[
              "Compartilhe seu link em redes sociais, e-mail ou mensagens",
              "Use aliases personalizados para rastrear diferentes campanhas",
              "Você ganha comissão em todas as compras feitas através do seu link",
              "Você pode comprar pelo seu próprio link e receber comissão",
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-[#4C1D95]">
                <span className="w-5 h-5 rounded-full bg-[#5B3FA6] text-white text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
