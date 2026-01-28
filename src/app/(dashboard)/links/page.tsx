"use client";

import { useState } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingScreen } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Link2, Copy, Check, Plus, Trash2, ExternalLink } from "lucide-react";
import { getAffiliateLink, copyToClipboard } from "@/lib/utils";

export default function LinksPage() {
  const { affiliate, isLoading: userLoading } = useUser();
  const { links, refetch, isLoading: dataLoading } = useAffiliateData(affiliate?.id);
  const [newAlias, setNewAlias] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const supabase = createClient();

  const isLoading = userLoading || dataLoading;

  if (isLoading) {
    return <LoadingScreen />;
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
    <div className="min-h-screen">
      <Header title="Meus Links" subtitle="Gerencie seus links de afiliado" />

      <div className="p-6 space-y-6">
        {/* Main Link Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Link Principal
            </CardTitle>
            <CardDescription>
              Este é seu link principal de afiliado. Compartilhe-o para ganhar comissões.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-background rounded-lg px-4 py-3 border border-border">
                <span className="text-sm text-text-primary truncate">{mainLink}</span>
                <Badge variant="default" className="shrink-0">Principal</Badge>
              </div>
              <Button
                variant="secondary"
                onClick={() => handleCopy(mainLink, "main")}
              >
                {copiedId === "main" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(mainLink, "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-3 text-xs text-text-secondary">
              Código: <span className="font-mono font-medium">{affiliate?.affiliate_code}</span>
            </p>
          </CardContent>
        </Card>

        {/* Custom Links */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Links Personalizados</CardTitle>
                <CardDescription>
                  Crie até 3 aliases personalizados para seus links
                </CardDescription>
              </div>
              <Badge variant="secondary">{links.length}/3</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Create new link */}
            {links.length < 3 && (
              <div className="flex gap-3">
                <Input
                  placeholder="meu-link-personalizado"
                  value={newAlias}
                  onChange={(e) => {
                    setNewAlias(e.target.value);
                    setError("");
                  }}
                  error={error}
                  className="flex-1"
                />
                <Button onClick={handleCreate} isLoading={isCreating}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar
                </Button>
              </div>
            )}

            {/* Links list */}
            {links.length === 0 ? (
              <EmptyState
                icon={Link2}
                title="Nenhum link personalizado"
                description="Crie aliases personalizados para facilitar o compartilhamento"
              />
            ) : (
              <div className="space-y-3">
                {links.map((link) => {
                  const fullLink = getAffiliateLink(link.alias);
                  return (
                    <div
                      key={link.id}
                      className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {fullLink}
                        </p>
                        <p className="text-xs text-text-secondary mt-0.5">
                          Alias: <span className="font-mono">{link.alias}</span>
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(fullLink, link.id)}
                      >
                        {copiedId === link.id ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(link.id)}
                        className="text-error hover:text-error hover:bg-error-light"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tips */}
        <Card>
          <CardHeader>
            <CardTitle>Dicas de Uso</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-text-secondary">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Compartilhe seu link em redes sociais, e-mail ou mensagens
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Use aliases personalizados para rastrear diferentes campanhas
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Você ganha comissão em todas as compras feitas através do seu link
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Você pode comprar pelo seu próprio link e receber comissão
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
