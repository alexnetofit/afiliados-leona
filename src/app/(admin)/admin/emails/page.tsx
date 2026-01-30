"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Button, Badge, Alert } from "@/components/ui/index";
import { Send, Mail, Users, Eye, AlertTriangle, CheckCircle, X } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface EmailFilters {
  tier: string;
  status: string;
  onlyWithSales: boolean;
  minCommission: string;
  maxCommission: string;
}

const DEFAULT_FILTERS: EmailFilters = {
  tier: "all",
  status: "all",
  onlyWithSales: false,
  minCommission: "",
  maxCommission: "",
};

const EMAIL_TEMPLATES = [
  {
    name: "Em branco",
    subject: "",
    html: "",
  },
  {
    name: "Novidades do programa",
    subject: "Novidades no Programa de Afiliados Leona!",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #7C3AED; margin-bottom: 20px;">Olá, Afiliado(a)! 👋</h1>
  
  <p style="color: #374151; font-size: 16px; line-height: 1.6;">
    Temos novidades incríveis para você! Confira o que preparamos para melhorar ainda mais sua experiência como afiliado Leona.
  </p>
  
  <div style="background: #F3F4F6; padding: 20px; border-radius: 12px; margin: 24px 0;">
    <h3 style="color: #1F2937; margin: 0 0 12px 0;">🎯 Novidade 1</h3>
    <p style="color: #4B5563; margin: 0;">Descrição da novidade aqui...</p>
  </div>
  
  <p style="color: #374151; font-size: 16px; line-height: 1.6;">
    Continue compartilhando seu link e aumente suas comissões!
  </p>
  
  <p style="color: #6B7280; font-size: 14px; margin-top: 32px;">
    Equipe Leona<br>
    <a href="https://app.leonasolutions.io" style="color: #7C3AED;">app.leonasolutions.io</a>
  </p>
</div>`,
  },
  {
    name: "Lembrete de pagamento",
    subject: "Seu pagamento de comissões está disponível! 💰",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #7C3AED; margin-bottom: 20px;">Pagamento Disponível! 💰</h1>
  
  <p style="color: #374151; font-size: 16px; line-height: 1.6;">
    Suas comissões estão prontas para serem pagas! Certifique-se de que seus dados de pagamento estão atualizados.
  </p>
  
  <div style="background: linear-gradient(135deg, #7C3AED 0%, #9333EA 100%); padding: 24px; border-radius: 12px; margin: 24px 0; text-align: center;">
    <p style="color: rgba(255,255,255,0.8); margin: 0 0 8px 0; font-size: 14px;">Valor disponível</p>
    <p style="color: white; margin: 0; font-size: 32px; font-weight: bold;">R$ XXX,XX</p>
  </div>
  
  <p style="color: #374151; font-size: 16px; line-height: 1.6;">
    Acesse seu painel para verificar os detalhes e atualizar suas informações de pagamento.
  </p>
  
  <a href="https://app.leonasolutions.io/perfil" style="display: inline-block; background: #7C3AED; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
    Verificar Pagamento
  </a>
  
  <p style="color: #6B7280; font-size: 14px; margin-top: 32px;">
    Equipe Leona
  </p>
</div>`,
  },
];

export default function EmailsPage() {
  const [filters, setFilters] = useState<EmailFilters>(DEFAULT_FILTERS);
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Fetch recipient count when filters change
  const fetchCount = useCallback(async () => {
    setIsLoadingCount(true);
    try {
      const params = new URLSearchParams({
        tier: filters.tier,
        status: filters.status,
        onlyWithSales: filters.onlyWithSales.toString(),
      });
      if (filters.minCommission) params.set("minCommission", filters.minCommission);
      if (filters.maxCommission) params.set("maxCommission", filters.maxCommission);

      const response = await fetch(`/api/admin/send-email?${params}`);
      const data = await response.json();
      setRecipientCount(data.count ?? 0);
    } catch {
      setRecipientCount(0);
    } finally {
      setIsLoadingCount(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  const handleSendTest = async () => {
    if (!testEmail || !subject || !htmlContent) {
      setResult({ type: "error", message: "Preencha o email de teste, título e conteúdo" });
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          htmlContent,
          filters,
          testEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao enviar");
      }

      setResult({ type: "success", message: `Email de teste enviado para ${testEmail}` });
    } catch (error) {
      setResult({ type: "error", message: error instanceof Error ? error.message : "Erro ao enviar" });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendAll = async () => {
    if (!subject || !htmlContent) {
      setResult({ type: "error", message: "Preencha o título e conteúdo do email" });
      return;
    }

    if (!recipientCount || recipientCount === 0) {
      setResult({ type: "error", message: "Nenhum destinatário com os filtros selecionados" });
      return;
    }

    if (!confirm(`Tem certeza que deseja enviar este email para ${recipientCount} afiliado(s)?`)) {
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          htmlContent,
          filters: {
            tier: filters.tier,
            status: filters.status,
            onlyWithSales: filters.onlyWithSales,
            minCommission: filters.minCommission ? parseFloat(filters.minCommission) : null,
            maxCommission: filters.maxCommission ? parseFloat(filters.maxCommission) : null,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao enviar");
      }

      setResult({ 
        type: "success", 
        message: `Emails enviados! ${data.sent} sucesso, ${data.failed || 0} falhas` 
      });
    } catch (error) {
      setResult({ type: "error", message: error instanceof Error ? error.message : "Erro ao enviar" });
    } finally {
      setIsSending(false);
    }
  };

  const applyTemplate = (index: number) => {
    const template = EMAIL_TEMPLATES[index];
    setSubject(template.subject);
    setHtmlContent(template.html);
  };

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-[1200px] mx-auto space-y-6 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Disparo de Emails</h1>
            <p className="text-zinc-500 mt-1">Envie comunicações para seus afiliados</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl",
              "bg-primary-50 border border-primary-100"
            )}>
              <Users className="h-5 w-5 text-primary-600" />
              <span className="font-bold text-primary-700">
                {isLoadingCount ? "..." : recipientCount ?? 0}
              </span>
              <span className="text-primary-600 text-sm">destinatários</span>
            </div>
          </div>
        </div>

        {/* Result Alert */}
        {result && (
          <Alert variant={result.type} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {result.type === "success" ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
              {result.message}
            </div>
            <button onClick={() => setResult(null)} className="p-1 hover:bg-black/10 rounded">
              <X className="h-4 w-4" />
            </button>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Filters & Templates */}
          <div className="space-y-6">
            {/* Filters */}
            <Card>
              <h3 className="font-bold text-zinc-900 mb-4">Filtros de Destinatários</h3>
              
              <div className="space-y-4">
                {/* Tier */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Tier</label>
                  <select
                    value={filters.tier}
                    onChange={(e) => setFilters({ ...filters, tier: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  >
                    <option value="all">Todos os tiers</option>
                    <option value="1">Bronze (30%)</option>
                    <option value="2">Prata (35%)</option>
                    <option value="3">Ouro (40%)</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  >
                    <option value="all">Todos</option>
                    <option value="active">Apenas ativos</option>
                    <option value="inactive">Apenas inativos</option>
                  </select>
                </div>

                {/* Commission Range */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Faixa de Comissão (R$)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Mín"
                      value={filters.minCommission}
                      onChange={(e) => setFilters({ ...filters, minCommission: e.target.value })}
                      className="flex-1 h-10 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                    <input
                      type="number"
                      placeholder="Máx"
                      value={filters.maxCommission}
                      onChange={(e) => setFilters({ ...filters, maxCommission: e.target.value })}
                      className="flex-1 h-10 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                  </div>
                </div>

                {/* Only with sales */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={filters.onlyWithSales}
                    onClick={() => setFilters({ ...filters, onlyWithSales: !filters.onlyWithSales })}
                    className={cn(
                      "relative h-5 w-9 rounded-full transition-colors",
                      filters.onlyWithSales ? "bg-primary-500" : "bg-zinc-300"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                        filters.onlyWithSales && "translate-x-4"
                      )}
                    />
                  </button>
                  <span className="text-sm text-zinc-700">Apenas com vendas</span>
                </label>
              </div>
            </Card>

            {/* Templates */}
            <Card>
              <h3 className="font-bold text-zinc-900 mb-4">Templates</h3>
              <div className="space-y-2">
                {EMAIL_TEMPLATES.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => applyTemplate(index)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-lg text-sm",
                      "bg-zinc-50 hover:bg-zinc-100 border border-zinc-200",
                      "transition-colors"
                    )}
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Column - Email Editor */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-zinc-900">Compor Email</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                  icon={Eye}
                >
                  {showPreview ? "Editar" : "Preview"}
                </Button>
              </div>

              {!showPreview ? (
                <div className="space-y-4">
                  {/* Subject */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Título do Email</label>
                    <input
                      type="text"
                      placeholder="Ex: Novidades no Programa de Afiliados!"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full h-11 px-4 rounded-lg border border-zinc-200 bg-white text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                  </div>

                  {/* HTML Content */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                      Conteúdo HTML
                    </label>
                    <textarea
                      placeholder="Cole aqui o HTML do seu email..."
                      value={htmlContent}
                      onChange={(e) => setHtmlContent(e.target.value)}
                      rows={16}
                      className="w-full px-4 py-3 rounded-lg border border-zinc-200 bg-white text-sm font-mono focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 resize-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-zinc-100 rounded-lg">
                    <span className="text-xs text-zinc-500">Assunto:</span>
                    <p className="font-medium text-zinc-900">{subject || "(sem título)"}</p>
                  </div>
                  <div 
                    className="border border-zinc-200 rounded-lg p-4 bg-white min-h-[400px] overflow-auto"
                    dangerouslySetInnerHTML={{ __html: htmlContent || "<p style='color: #999;'>Preview do email aparecerá aqui...</p>" }}
                  />
                </div>
              )}
            </Card>

            {/* Actions */}
            <Card>
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Test Email */}
                <div className="flex-1 flex gap-2">
                  <input
                    type="email"
                    placeholder="Email para teste..."
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="flex-1 h-11 px-4 rounded-lg border border-zinc-200 bg-white text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                  />
                  <Button
                    variant="secondary"
                    onClick={handleSendTest}
                    loading={isSending}
                    icon={Mail}
                  >
                    Testar
                  </Button>
                </div>

                {/* Send to All */}
                <Button
                  onClick={handleSendAll}
                  loading={isSending}
                  disabled={!recipientCount || recipientCount === 0}
                  icon={Send}
                  className="sm:w-auto"
                >
                  Enviar para {recipientCount ?? 0} afiliados
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
