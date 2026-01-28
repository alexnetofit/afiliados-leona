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
      <div className="max-w-3xl mx-auto space-y-8 animate-fade-in-up">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Configurações</h1>
          <p className="text-zinc-500 mt-1">Ferramentas de administração do sistema</p>
        </div>

        {/* Stripe Resync */}
        <Card>
          <div className="flex items-center gap-4 mb-8">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-info-100 to-info-50 flex items-center justify-center">
              <RefreshCw className="h-7 w-7 text-info-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900">Resync Stripe</h3>
              <p className="text-sm text-zinc-500">Reconcilia dados do Stripe com o banco</p>
            </div>
          </div>

          <Alert variant="info" icon={Info} className="mb-6">
            Busca invoices, assinaturas, refunds e disputas do Stripe e atualiza o banco de dados local.
          </Alert>

          <div className="flex flex-col sm:flex-row items-end gap-4 mb-6">
            <Input 
              label="Período (dias)" 
              type="number" 
              value={resyncDays} 
              onChange={(e) => setResyncDays(e.target.value)} 
              className="w-full sm:w-40"
            />
            <Button onClick={handleResync} loading={isResyncing} icon={RefreshCw} size="lg">
              Iniciar Resync
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
          <div className="flex items-center gap-4 mb-8">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-warning-100 to-warning-50 flex items-center justify-center">
              <Upload className="h-7 w-7 text-warning-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold text-zinc-900">Migração Rewardful</h3>
                <Badge variant="warning">Cuidado</Badge>
              </div>
              <p className="text-sm text-zinc-500">Importa dados do Rewardful mantendo códigos</p>
            </div>
          </div>

          <Alert variant="warning" icon={AlertTriangle} title="Atenção: Execute apenas uma vez!" className="mb-6">
            A migração importa todos os afiliados, clientes e transações do Rewardful.
          </Alert>

          <div className="p-5 bg-zinc-50 rounded-2xl border border-zinc-200 mb-6">
            <p className="text-sm font-semibold text-zinc-700 mb-3">O processo irá:</p>
            <ul className="space-y-2">
              {[
                "Importar afiliados com códigos originais",
                "Criar relações customer → affiliate",
                "Importar histórico de transações",
                "Recalcular tiers de comissão",
                "Gerar payouts mensais passados como \"paid\""
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-zinc-600">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary-500" />
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
            className="border-warning-300 text-warning-700 hover:bg-warning-50"
          >
            Iniciar Migração
          </Button>

          {migrateResult && (
            <Alert 
              variant={migrateResult.success ? "success" : "error"} 
              icon={migrateResult.success ? CheckCircle : AlertTriangle}
              className="mt-6"
            >
              {migrateResult.message}
            </Alert>
          )}
        </Card>

        {/* System Info */}
        <Card>
          <div className="flex items-center gap-4 mb-8">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-50 flex items-center justify-center">
              <Settings className="h-7 w-7 text-zinc-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900">Informações do Sistema</h3>
              <p className="text-sm text-zinc-500">Configurações atuais</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {[
              { icon: Zap, label: "Versão", value: "1.0.0" },
              { icon: Shield, label: "Ambiente", value: process.env.NODE_ENV === "production" ? "Produção" : "Desenvolvimento" },
              { icon: Info, label: "Comissão Base", value: "30%" },
              { icon: Info, label: "Disponibilização", value: "15 dias" },
            ].map((item) => (
              <div key={item.label} className="p-4 bg-zinc-50 rounded-xl border border-zinc-200">
                <div className="flex items-center gap-2 mb-2">
                  <item.icon className="h-4 w-4 text-zinc-400" />
                  <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{item.label}</p>
                </div>
                <p className="text-lg font-bold text-zinc-900">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
