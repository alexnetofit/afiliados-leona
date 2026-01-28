"use client";

import { useState } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Card, Button, Badge } from "@/components/ui/index";
import { Link2, Copy, Check, Plus, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { getAffiliateLink, copyToClipboard } from "@/lib/utils";

export default function LinksPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { affiliate, profile, isLoading: userLoading } = useUser();
  const { links, refetch, isLoading: dataLoading } = useAffiliateData(affiliate?.id);
  const [newAlias, setNewAlias] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const supabase = createClient();

  const isLoading = userLoading || dataLoading;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#5B21B6]" />
      </div>
    );
  }

  const handleCopy = async (link: string, id: string) => {
    const ok = await copyToClipboard(link);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleCreate = async () => {
    if (!newAlias.trim()) return setError("Digite um alias");
    if (links.length >= 3) return setError("Limite de 3 links atingido");

    setCreating(true);
    setError("");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: err } = await (supabase.from("affiliate_links") as any).insert({
      affiliate_id: affiliate?.id,
      alias: newAlias.trim().toLowerCase().replace(/\s+/g, "-"),
    });

    if (err) {
      setError(err.message.includes("unique") ? "Alias já existe" : "Erro ao criar");
    } else {
      setNewAlias("");
      await refetch();
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este link?")) return;
    await supabase.from("affiliate_links").delete().eq("id", id);
    await refetch();
  };

  const mainLink = affiliate?.affiliate_code ? getAffiliateLink(affiliate.affiliate_code) : "";

  return (
    <>
      <Header
        title="Links"
        description="Gerencie seus links de afiliado"
        user={profile ? { name: profile.full_name || "" } : undefined}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 p-6 lg:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          
          {/* Link principal */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-[#EDE9FE] flex items-center justify-center">
                <Link2 className="h-5 w-5 text-[#5B21B6]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#111827]">Link principal</h3>
                <p className="text-sm text-[#6B7280]">Compartilhe para ganhar comissões</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex items-center gap-2 px-4 py-3 bg-[#F8F9FC] rounded-xl border border-[#E8EAF0]">
                <span className="text-sm text-[#111827] truncate flex-1">{mainLink}</span>
                <Badge variant="primary">Principal</Badge>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleCopy(mainLink, "main")} icon={copiedId === "main" ? Check : Copy}>
                  {copiedId === "main" ? "Copiado" : "Copiar"}
                </Button>
                <Button variant="secondary" onClick={() => window.open(mainLink, "_blank")} icon={ExternalLink} />
              </div>
            </div>

            <p className="mt-4 text-xs text-[#6B7280]">
              Código: <span className="font-mono text-[#5B21B6]">{affiliate?.affiliate_code}</span>
            </p>
          </Card>

          {/* Links personalizados */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-[#111827]">Links personalizados</h3>
                <p className="text-sm text-[#6B7280]">Crie até 3 aliases</p>
              </div>
              <Badge>{links.length}/3</Badge>
            </div>

            {links.length < 3 && (
              <div className="flex gap-3 mb-6">
                <input
                  type="text"
                  value={newAlias}
                  onChange={(e) => { setNewAlias(e.target.value); setError(""); }}
                  placeholder="meu-link"
                  className="flex-1 h-11 px-4 bg-white border border-[#E8EAF0] rounded-xl text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#5B21B6] focus:ring-4 focus:ring-[#5B21B6]/10"
                />
                <Button onClick={handleCreate} loading={creating} icon={Plus}>
                  Criar
                </Button>
              </div>
            )}

            {error && <p className="mb-4 text-sm text-[#DC2626]">{error}</p>}

            {links.length === 0 ? (
              <div className="py-12 text-center bg-[#F8F9FC] rounded-xl border border-dashed border-[#E8EAF0]">
                <Link2 className="h-8 w-8 mx-auto text-[#9CA3AF] mb-3" />
                <p className="text-sm text-[#6B7280]">Nenhum link personalizado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {links.map((link) => {
                  const fullLink = getAffiliateLink(link.alias);
                  return (
                    <div key={link.id} className="flex items-center gap-3 p-4 bg-[#F8F9FC] rounded-xl border border-[#E8EAF0]">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#111827] truncate">{fullLink}</p>
                        <p className="text-xs text-[#6B7280]">Alias: <span className="text-[#5B21B6]">{link.alias}</span></p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleCopy(fullLink, link.id)} icon={copiedId === link.id ? Check : Copy} />
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(link.id)} icon={Trash2} className="text-[#DC2626] hover:bg-[#FEE2E2]" />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
