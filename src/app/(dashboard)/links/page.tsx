"use client";

import { useState } from "react";
import { useAppData } from "@/contexts";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Card, Button, Badge, LoadingScreen, Alert } from "@/components/ui/index";
import { Link2, Copy, Check, Plus, Trash2, ExternalLink, Sparkles } from "lucide-react";
import { getAffiliateLink, copyToClipboard, cn } from "@/lib/utils";

export default function LinksPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { affiliate, profile, links, refetchLinks, isLoading, isInitialized } = useAppData();
  const [newAlias, setNewAlias] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const supabase = createClient();

  // Only show loading on first load, not on navigation
  if (isLoading && !isInitialized) {
    return <LoadingScreen message="Carregando links..." />;
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
      await refetchLinks();
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este link?")) return;
    await supabase.from("affiliate_links").delete().eq("id", id);
    await refetchLinks();
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
        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in-up">
          
          {/* Main Link Card */}
          <Card gradient>
            <div className="flex items-center gap-4 mb-6">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-primary">
                <Link2 className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Link principal</h3>
                <p className="text-sm text-zinc-500">Compartilhe para ganhar comissões</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex items-center gap-3 px-4 py-3.5 bg-zinc-50 rounded-xl border-2 border-zinc-200">
                <span className="text-sm text-zinc-700 truncate flex-1 font-medium">{mainLink}</span>
                <Badge variant="primary" size="sm">Principal</Badge>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleCopy(mainLink, "main")} 
                  icon={copiedId === "main" ? Check : Copy}
                  variant={copiedId === "main" ? "success" : "primary"}
                  size="lg"
                >
                  {copiedId === "main" ? "Copiado!" : "Copiar"}
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => window.open(mainLink, "_blank")} 
                  icon={ExternalLink}
                  size="lg"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-sm">
              <span className="text-zinc-500">Código:</span>
              <code className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg font-mono font-semibold">
                {affiliate?.affiliate_code}
              </code>
            </div>
          </Card>

          {/* Custom Links */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-zinc-100 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-zinc-600" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900">Links personalizados</h3>
                  <p className="text-sm text-zinc-500">Crie até 3 aliases customizados</p>
                </div>
              </div>
              <Badge variant={links.length >= 3 ? "error" : "default"} size="lg">
                {links.length}/3
              </Badge>
            </div>

            {links.length < 3 && (
              <div className="flex gap-3 mb-6">
                <input
                  type="text"
                  value={newAlias}
                  onChange={(e) => { setNewAlias(e.target.value); setError(""); }}
                  placeholder="meu-link-personalizado"
                  className={cn(
                    "flex-1 h-12 px-4",
                    "bg-white border-2 border-zinc-200 rounded-xl",
                    "text-zinc-900 text-sm placeholder:text-zinc-400",
                    "focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10",
                    "transition-all"
                  )}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <Button onClick={handleCreate} loading={creating} icon={Plus} size="lg">
                  Criar
                </Button>
              </div>
            )}

            {error && (
              <Alert variant="error" className="mb-6">{error}</Alert>
            )}

            {links.length === 0 ? (
              <div className="py-12 text-center bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200">
                <Link2 className="h-10 w-10 mx-auto text-zinc-400 mb-3" />
                <p className="font-medium text-zinc-600">Nenhum link personalizado</p>
                <p className="text-sm text-zinc-500 mt-1">Crie um alias para compartilhar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {links.map((link, index) => {
                  const fullLink = getAffiliateLink(link.alias);
                  return (
                    <div 
                      key={link.id} 
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl",
                        "bg-zinc-50 border border-zinc-200",
                        "hover:border-zinc-300 transition-colors",
                        "animate-fade-in-up"
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="h-10 w-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center">
                        <span className="text-sm font-bold text-zinc-400">{index + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">{fullLink}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Alias: <span className="text-primary-600 font-medium">{link.alias}</span>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleCopy(fullLink, link.id)} 
                          icon={copiedId === link.id ? Check : Copy}
                          className={copiedId === link.id ? "text-success-600" : ""}
                        />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(link.id)} 
                          icon={Trash2} 
                          className="text-error-500 hover:bg-error-50"
                        />
                      </div>
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
