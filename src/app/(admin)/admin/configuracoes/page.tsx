"use client";

import { useState } from "react";
import { Card, Button, Badge, Input } from "@/components/ui/index";
import { RefreshCw, Upload, Database, AlertTriangle, CheckCircle } from "lucide-react";

export default function ConfiguracoesPage() {
  const [isResyncing, setIsResyncing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [resyncDays, setResyncDays] = useState("30");
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [migrateResult, setMigrateResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleResync = async () => {
    setIsResyncing(true);
    setSyncResult(null);
    try {
      const response = await fetch("/api/admin/stripe-resync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: parseInt(resyncDays) }),
      });
      const data = await response.json();
      if (response.ok) {
        setSyncResult({ success: true, message: `Resync concluído! ${data.processed || 0} registros processados.` });
      } else throw new Error(data.error || "Erro no resync");
    } catch (error) {
      setSyncResult({ success: false, message: error instanceof Error ? error.message : "Erro desconhecido" });
    } finally { setIsResyncing(false); }
  };

  const handleMigration = async () => {
    if (!confirm("Tem certeza que deseja iniciar a migração do Rewardful? Este processo pode demorar.")) return;
    setIsMigrating(true);
    setMigrateResult(null);
    try {
      const response = await fetch("/api/admin/migrate-rewardful", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        setMigrateResult({ success: true, message: `Migração concluída! ${data.affiliates || 0} afiliados, ${data.customers || 0} clientes, ${data.transactions || 0} transações.` });
      } else throw new Error(data.error || "Erro na migração");
    } catch (error) {
      setMigrateResult({ success: false, message: error instanceof Error ? error.message : "Erro desconhecido" });
    } finally { setIsMigrating(false); }
  };

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#111827]">Configurações</h1>
          <p className="text-[#6B7280]">Ferramentas de administração</p>
        </div>

        {/* Stripe Resync */}
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-[#DBEAFE] flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-[#3B82F6]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#111827]">Resync Stripe</h3>
              <p className="text-sm text-[#6B7280]">Reconcilia dados do Stripe com o banco</p>
            </div>
          </div>

          <p className="text-sm text-[#6B7280] mb-4">
            Busca invoices, assinaturas, refunds e disputas do Stripe e atualiza o banco de dados.
          </p>

          <div className="flex items-end gap-4 mb-4">
            <Input label="Período (dias)" type="number" value={resyncDays} onChange={(e) => setResyncDays(e.target.value)} className="w-32" />
            <Button onClick={handleResync} loading={isResyncing} icon={RefreshCw}>Iniciar Resync</Button>
          </div>

          {syncResult && (
            <div className={`p-4 rounded-xl flex items-start gap-3 ${syncResult.success ? "bg-[#D1FAE5]" : "bg-[#FEE2E2]"}`}>
              {syncResult.success ? <CheckCircle className="h-5 w-5 text-[#059669] shrink-0" /> : <AlertTriangle className="h-5 w-5 text-[#DC2626] shrink-0" />}
              <p className={`text-sm ${syncResult.success ? "text-[#059669]" : "text-[#DC2626]"}`}>{syncResult.message}</p>
            </div>
          )}
        </Card>

        {/* Rewardful Migration */}
        <Card>
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-[#FEF3C7] flex items-center justify-center">
              <Upload className="h-5 w-5 text-[#D97706]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-[#111827]">Migração Rewardful</h3>
                <Badge variant="warning">Cuidado</Badge>
              </div>
              <p className="text-sm text-[#6B7280]">Importa dados do Rewardful mantendo códigos</p>
            </div>
          </div>

          <div className="p-4 bg-[#FEF3C7] rounded-xl mb-4">
            <p className="text-sm text-[#D97706] font-medium mb-2">Atenção: Execute apenas uma vez!</p>
            <p className="text-sm text-[#D97706]/80">A migração importa todos os afiliados, clientes e transações do Rewardful.</p>
          </div>

          <div className="text-sm text-[#6B7280] space-y-2 mb-4">
            <p><strong>O processo irá:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Importar afiliados com códigos originais</li>
              <li>Criar relações customer → affiliate</li>
              <li>Importar histórico de transações</li>
              <li>Recalcular tiers de comissão</li>
              <li>Gerar payouts mensais passados como "paid"</li>
            </ul>
          </div>

          <Button variant="secondary" onClick={handleMigration} loading={isMigrating} icon={Database} className="border-[#D97706] text-[#D97706] hover:bg-[#FEF3C7]">
            Iniciar Migração
          </Button>

          {migrateResult && (
            <div className={`mt-4 p-4 rounded-xl flex items-start gap-3 ${migrateResult.success ? "bg-[#D1FAE5]" : "bg-[#FEE2E2]"}`}>
              {migrateResult.success ? <CheckCircle className="h-5 w-5 text-[#059669] shrink-0" /> : <AlertTriangle className="h-5 w-5 text-[#DC2626] shrink-0" />}
              <p className={`text-sm ${migrateResult.success ? "text-[#059669]" : "text-[#DC2626]"}`}>{migrateResult.message}</p>
            </div>
          )}
        </Card>

        {/* System Info */}
        <Card>
          <h3 className="font-semibold text-[#111827] mb-4">Informações do Sistema</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-[#6B7280]">Versão</p><p className="font-medium text-[#111827]">1.0.0</p></div>
            <div><p className="text-[#6B7280]">Ambiente</p><p className="font-medium text-[#111827]">{process.env.NODE_ENV === "production" ? "Produção" : "Dev"}</p></div>
            <div><p className="text-[#6B7280]">Comissão Base</p><p className="font-medium text-[#111827]">30%</p></div>
            <div><p className="text-[#6B7280]">Disponibilização</p><p className="font-medium text-[#111827]">15 dias</p></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
