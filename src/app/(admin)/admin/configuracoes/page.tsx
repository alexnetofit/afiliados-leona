"use client";

import { useState } from "react";
import { Card, Button, Badge, Input, Alert } from "@/components/ui/index";
import { RefreshCw, Upload, Database, AlertTriangle, CheckCircle, Settings, Info, Zap, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

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
        const msg = data.customersLinked 
          ? `Resync concluído! ${data.processed || 0} registros processados, ${data.customersLinked} clientes vinculados a afiliados.`
          : `Resync concluído! ${data.processed || 0} registros processados.`;
        setSyncResult({ success: true, message: msg });
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
    <div className="flex-1 p-4 lg:p-5">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Configurações</h1>
          <p className="text-xs text-zinc-500">Ferramentas de administração do sistema</p>
        </div>

        {/* Stripe Resync */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-info-50 flex items-center justify-center">
              <RefreshCw className="h-4.5 w-4.5 text-info-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Resync Stripe</h3>
              <p className="text-xs text-zinc-500">Reconcilia dados do Stripe com o banco</p>
            </div>
          </div>

          <Alert variant="info" icon={Info} className="mb-4">
            Busca clientes, assinaturas, invoices e refunds do Stripe. Vincula clientes a afiliados pelo metadado "referral".
          </Alert>

          <div className="flex flex-col sm:flex-row items-end gap-3 mb-4">
            <Input 
              label="Período (dias)" 
              type="number" 
              value={resyncDays} 
              onChange={(e) => setResyncDays(e.target.value)} 
              className="w-full sm:w-32"
            />
            <Button onClick={handleResync} loading={isResyncing} icon={RefreshCw} size="md" className="whitespace-nowrap">
              Resync
            </Button>
          </div>

          {syncResult && (
            <Alert 
              variant={syncResult.success ? "success" : "error"} 
              icon={syncResult.success ? CheckCircle : AlertTriangle}
            >
              {syncResult.message}
            </Alert>
          )}
        </Card>

        {/* Rewardful Migration */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-warning-50 flex items-center justify-center">
              <Upload className="h-4.5 w-4.5 text-warning-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-900">Migração Rewardful</h3>
                <Badge variant="warning" size="sm">Cuidado</Badge>
              </div>
              <p className="text-xs text-zinc-500">Importa dados do Rewardful mantendo códigos</p>
            </div>
          </div>

          <Alert variant="warning" icon={AlertTriangle} title="Execute apenas uma vez!" className="mb-4">
            Importa todos os afiliados, clientes e transações do Rewardful.
          </Alert>

          <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 mb-4">
            <p className="text-xs font-medium text-zinc-700 mb-2">O processo irá:</p>
            <ul className="space-y-1.5">
              {[
                "Importar afiliados com códigos originais",
                "Criar relações customer → affiliate",
                "Importar histórico de transações",
                "Recalcular tiers de comissão",
                "Gerar payouts mensais passados como \"paid\""
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-1.5 text-xs text-zinc-600">
                  <div className="h-1 w-1 rounded-full bg-primary-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <Button 
            variant="secondary" 
            onClick={handleMigration} 
            loading={isMigrating} 
            icon={Database}
            size="md"
          >
            Iniciar Migração
          </Button>

          {migrateResult && (
            <Alert 
              variant={migrateResult.success ? "success" : "error"} 
              icon={migrateResult.success ? CheckCircle : AlertTriangle}
              className="mt-4"
            >
              {migrateResult.message}
            </Alert>
          )}
        </Card>

        {/* System Info */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-zinc-100 flex items-center justify-center">
              <Settings className="h-4.5 w-4.5 text-zinc-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Sistema</h3>
              <p className="text-xs text-zinc-500">Configurações atuais</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Zap, label: "Versão", value: "1.0.0" },
              { icon: Shield, label: "Ambiente", value: process.env.NODE_ENV === "production" ? "Produção" : "Dev" },
              { icon: Info, label: "Comissão Base", value: "30%" },
              { icon: Info, label: "Disponibilização", value: "15 dias" },
            ].map((item) => (
              <div key={item.label} className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                <div className="flex items-center gap-1.5 mb-1">
                  <item.icon className="h-3.5 w-3.5 text-zinc-400" />
                  <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{item.label}</p>
                </div>
                <p className="text-sm font-semibold text-zinc-900">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
