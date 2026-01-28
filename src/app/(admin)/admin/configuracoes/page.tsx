"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Button, Badge, Input, Alert, Progress } from "@/components/ui/index";
import { RefreshCw, Upload, Database, AlertTriangle, CheckCircle, Settings, Info, Zap, Shield, Clock, Calendar, Users, CreditCard, ReceiptText, Undo2 } from "lucide-react";

interface SyncLog {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "completed" | "error";
  days_synced: number;
  customers_scanned: number;
  customers_linked: number;
  subscriptions_synced: number;
  invoices_synced: number;
  refunds_synced: number;
  error_message: string | null;
  triggered_by: "manual" | "cron";
}

interface SyncProgress {
  step: string;
  message: string;
  completed?: boolean;
}

export default function ConfiguracoesPage() {
  const [isResyncing, setIsResyncing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [resyncDays, setResyncDays] = useState("5");
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; summary?: Record<string, number> } | null>(null);
  const [migrateResult, setMigrateResult] = useState<{ success: boolean; message: string; summary?: Record<string, number> } | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress[]>([]);
  const [migrateProgress, setMigrateProgress] = useState<SyncProgress[]>([]);
  const [migrateErrors, setMigrateErrors] = useState<string[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const progressRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  // Load sync logs on mount
  useEffect(() => {
    loadSyncLogs();
  }, []);

  const loadSyncLogs = async () => {
    setLoadingLogs(true);
    const { data } = await supabase
      .from("sync_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10);
    
    setSyncLogs((data as SyncLog[]) || []);
    setLoadingLogs(false);
  };

  const handleResync = async () => {
    setIsResyncing(true);
    setSyncResult(null);
    setSyncProgress([]);

    try {
      const response = await fetch("/api/admin/stripe-resync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: parseInt(resyncDays) }),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Falha ao iniciar streaming");

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));

            if (data.type === "start") {
              setSyncProgress([{ step: "start", message: data.message }]);
            } else if (data.type === "progress") {
              setSyncProgress(prev => {
                const existing = prev.findIndex(p => p.step === data.step);
                if (existing >= 0) {
                  const updated = [...prev];
                  updated[existing] = { step: data.step, message: data.message, completed: data.completed };
                  return updated;
                }
                return [...prev, { step: data.step, message: data.message, completed: data.completed }];
              });
            } else if (data.type === "complete") {
              setSyncResult({ 
                success: true, 
                message: data.message,
                summary: data.summary
              });
              loadSyncLogs();
            } else if (data.type === "error") {
              setSyncResult({ success: false, message: data.message });
              loadSyncLogs();
            }
          }
        }

        // Auto scroll to latest progress
        if (progressRef.current) {
          progressRef.current.scrollTop = progressRef.current.scrollHeight;
        }
      }
    } catch (error) {
      setSyncResult({ success: false, message: error instanceof Error ? error.message : "Erro desconhecido" });
    } finally {
      setIsResyncing(false);
    }
  };

  const handleMigration = async () => {
    if (!confirm("Tem certeza que deseja iniciar a migração do Rewardful? Este processo pode demorar.")) return;
    setIsMigrating(true);
    setMigrateResult(null);
    setMigrateProgress([]);
    setMigrateErrors([]);

    try {
      const response = await fetch("/api/admin/migrate-rewardful", { method: "POST" });

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Falha ao iniciar streaming");

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));

            if (data.type === "start") {
              setMigrateProgress([{ step: "start", message: data.message }]);
            } else if (data.type === "progress") {
              setMigrateProgress(prev => {
                const existing = prev.findIndex(p => p.step === data.step);
                if (existing >= 0) {
                  const updated = [...prev];
                  updated[existing] = { step: data.step, message: data.message, completed: data.completed };
                  return updated;
                }
                return [...prev, { step: data.step, message: data.message, completed: data.completed }];
              });
            } else if (data.type === "complete") {
              setMigrateResult({ 
                success: true, 
                message: data.message,
                summary: data.summary
              });
            } else if (data.type === "errors") {
              setMigrateErrors(data.errors || []);
            } else if (data.type === "error") {
              setMigrateResult({ success: false, message: data.message });
            }
          }
        }
      }
    } catch (error) {
      setMigrateResult({ success: false, message: error instanceof Error ? error.message : "Erro desconhecido" });
    } finally { 
      setIsMigrating(false); 
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStepIcon = (step: string) => {
    switch (step) {
      case "customers": return Users;
      case "affiliates": return Users;
      case "referrals": return Users;
      case "subscriptions": return CreditCard;
      case "invoices": return ReceiptText;
      case "transactions": return ReceiptText;
      case "refunds": return Undo2;
      case "tiers": return Zap;
      case "payouts": return CreditCard;
      default: return Info;
    }
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
              disabled={isResyncing}
            />
            <Button onClick={handleResync} loading={isResyncing} icon={RefreshCw} size="md" className="whitespace-nowrap">
              {isResyncing ? "Sincronizando..." : "Resync"}
            </Button>
          </div>

          {/* Progress Display */}
          {syncProgress.length > 0 && (
            <div 
              ref={progressRef}
              className="mb-4 p-3 bg-zinc-50 rounded-lg border border-zinc-200 max-h-48 overflow-y-auto"
            >
              <div className="space-y-2">
                {syncProgress.map((progress, idx) => {
                  const Icon = getStepIcon(progress.step);
                  return (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      {progress.completed ? (
                        <CheckCircle className="h-3.5 w-3.5 text-success-600 flex-shrink-0" />
                      ) : (
                        <Icon className="h-3.5 w-3.5 text-info-600 flex-shrink-0 animate-pulse" />
                      )}
                      <span className={progress.completed ? "text-success-700" : "text-zinc-600"}>
                        {progress.message}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {syncResult && (
            <>
              <Alert 
                variant={syncResult.success ? "success" : "error"} 
                icon={syncResult.success ? CheckCircle : AlertTriangle}
              >
                {syncResult.message}
              </Alert>
              
              {syncResult.summary && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: "Clientes escaneados", value: syncResult.summary.customersScanned, icon: Users },
                    { label: "Clientes vinculados", value: syncResult.summary.customersLinked, icon: Users },
                    { label: "Assinaturas", value: syncResult.summary.subscriptionsSynced, icon: CreditCard },
                    { label: "Transações", value: syncResult.summary.invoicesSynced, icon: ReceiptText },
                    { label: "Estornos", value: syncResult.summary.refundsSynced, icon: Undo2 },
                    { label: "Total processado", value: syncResult.summary.totalProcessed, icon: Database },
                  ].map((item) => (
                    <div key={item.label} className="p-2 bg-zinc-50 rounded-lg border border-zinc-200">
                      <div className="flex items-center gap-1 mb-0.5">
                        <item.icon className="h-3 w-3 text-zinc-400" />
                        <span className="text-[10px] text-zinc-500">{item.label}</span>
                      </div>
                      <span className="text-sm font-semibold text-zinc-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>

        {/* Sync History */}
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-9 w-9 rounded-lg bg-zinc-100 flex items-center justify-center">
              <Clock className="h-4.5 w-4.5 text-zinc-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Histórico de Syncs</h3>
              <p className="text-xs text-zinc-500">Últimas sincronizações realizadas</p>
            </div>
          </div>

          {loadingLogs ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-zinc-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : syncLogs.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-4">Nenhum sync realizado ainda</p>
          ) : (
            <div className="space-y-2">
              {syncLogs.map((log) => (
                <div 
                  key={log.id}
                  className="p-3 bg-zinc-50 rounded-lg border border-zinc-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={log.status === "completed" ? "success" : log.status === "error" ? "error" : "default"}
                        size="sm"
                      >
                        {log.status === "completed" ? "Concluído" : log.status === "error" ? "Erro" : "Executando"}
                      </Badge>
                      <Badge variant="default" size="sm">
                        {log.triggered_by === "cron" ? "Automático" : "Manual"}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-zinc-500">
                      {formatDate(log.started_at)}
                    </span>
                  </div>

                  {log.status === "error" && log.error_message && (
                    <p className="text-xs text-error-600 mb-2">{log.error_message}</p>
                  )}

                  <div className="flex items-center gap-4 text-[10px] text-zinc-500">
                    <span>{log.days_synced} dias</span>
                    <span>{log.customers_linked}/{log.customers_scanned} clientes</span>
                    <span>{log.subscriptions_synced} assinaturas</span>
                    <span>{log.invoices_synced} transações</span>
                    <span>{log.refunds_synced} estornos</span>
                  </div>
                </div>
              ))}
            </div>
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
            disabled={isMigrating}
          >
            {isMigrating ? "Migrando..." : "Iniciar Migração"}
          </Button>

          {/* Migration Progress Display */}
          {migrateProgress.length > 0 && (
            <div className="mt-4 p-3 bg-zinc-50 rounded-lg border border-zinc-200 max-h-64 overflow-y-auto">
              <div className="space-y-2">
                {migrateProgress.map((progress, idx) => {
                  const Icon = getStepIcon(progress.step);
                  return (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      {progress.completed ? (
                        <CheckCircle className="h-3.5 w-3.5 text-success-600 flex-shrink-0" />
                      ) : (
                        <Icon className="h-3.5 w-3.5 text-warning-600 flex-shrink-0 animate-pulse" />
                      )}
                      <span className={progress.completed ? "text-success-700" : "text-zinc-600"}>
                        {progress.message}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {migrateResult && (
            <>
              <Alert 
                variant={migrateResult.success ? "success" : "error"} 
                icon={migrateResult.success ? CheckCircle : AlertTriangle}
                className="mt-4"
              >
                {migrateResult.message}
              </Alert>
              
              {migrateResult.summary && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { label: "Afiliados importados", value: migrateResult.summary.affiliates },
                    { label: "Já existiam", value: migrateResult.summary.affiliatesSkipped },
                    { label: "Clientes vinculados", value: migrateResult.summary.customers },
                    { label: "Transações", value: migrateResult.summary.transactions },
                    { label: "Erros", value: migrateResult.summary.errors },
                  ].map((item) => (
                    <div key={item.label} className="p-2 bg-zinc-50 rounded-lg border border-zinc-200">
                      <span className="text-[10px] text-zinc-500">{item.label}</span>
                      <p className="text-sm font-semibold text-zinc-900">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {migrateErrors.length > 0 && (
                <div className="mt-3 p-3 bg-error-50 rounded-lg border border-error-200 max-h-32 overflow-y-auto">
                  <p className="text-xs font-medium text-error-700 mb-2">Erros encontrados:</p>
                  <ul className="space-y-1">
                    {migrateErrors.map((err, i) => (
                      <li key={i} className="text-xs text-error-600">{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
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
              { icon: Calendar, label: "Sync Automático", value: "00:01 (BRT)" },
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
