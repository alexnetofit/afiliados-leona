"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
        setSyncResult({
          success: true,
          message: `Resync concluído! ${data.processed || 0} registros processados.`,
        });
      } else {
        throw new Error(data.error || "Erro no resync");
      }
    } catch (error) {
      setSyncResult({
        success: false,
        message: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsResyncing(false);
    }
  };

  const handleMigration = async () => {
    if (!confirm("Tem certeza que deseja iniciar a migração do Rewardful? Este processo pode demorar.")) {
      return;
    }

    setIsMigrating(true);
    setMigrateResult(null);

    try {
      const response = await fetch("/api/admin/migrate-rewardful", {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        setMigrateResult({
          success: true,
          message: `Migração concluída! ${data.affiliates || 0} afiliados, ${data.customers || 0} clientes, ${data.transactions || 0} transações.`,
        });
      } else {
        throw new Error(data.error || "Erro na migração");
      }
    } catch (error) {
      setMigrateResult({
        success: false,
        message: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header title="Configurações" subtitle="Ferramentas de administração do sistema" />

      <div className="p-6 space-y-6 max-w-4xl">
        {/* Stripe Resync */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-info-light flex items-center justify-center">
                <RefreshCw className="h-5 w-5 text-info" />
              </div>
              <div>
                <CardTitle>Resync Stripe</CardTitle>
                <CardDescription>
                  Reconcilia dados do Stripe com o banco de dados local
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-text-secondary">
              Esta operação busca invoices, assinaturas, refunds e disputas do Stripe
              e atualiza o banco de dados. Use em caso de discrepâncias ou após downtime.
            </p>

            <div className="flex items-end gap-4">
              <Input
                label="Período (dias)"
                type="number"
                value={resyncDays}
                onChange={(e) => setResyncDays(e.target.value)}
                className="w-32"
                min="1"
                max="365"
              />
              <Button onClick={handleResync} isLoading={isResyncing}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Iniciar Resync
              </Button>
            </div>

            {syncResult && (
              <div
                className={`p-4 rounded-lg flex items-start gap-3 ${
                  syncResult.success ? "bg-success-light" : "bg-error-light"
                }`}
              >
                {syncResult.success ? (
                  <CheckCircle className="h-5 w-5 text-success shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-error shrink-0" />
                )}
                <p className={`text-sm ${syncResult.success ? "text-success" : "text-error"}`}>
                  {syncResult.message}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rewardful Migration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-warning-light flex items-center justify-center">
                <Upload className="h-5 w-5 text-warning" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle>Migração Rewardful</CardTitle>
                  <Badge variant="warning">Cuidado</Badge>
                </div>
                <CardDescription>
                  Importa dados do Rewardful mantendo códigos de afiliado
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-warning-light rounded-lg">
              <p className="text-sm text-warning font-medium mb-2">
                Atenção: Esta operação deve ser executada apenas uma vez!
              </p>
              <p className="text-sm text-warning/80">
                A migração irá importar todos os afiliados, clientes e transações
                do Rewardful. Códigos de afiliado serão preservados.
              </p>
            </div>

            <div className="text-sm text-text-secondary space-y-2">
              <p><strong>O processo irá:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Importar afiliados com seus códigos originais</li>
                <li>Criar relações customer → affiliate (First Touch)</li>
                <li>Importar histórico de transações</li>
                <li>Recalcular tiers de comissão</li>
                <li>Gerar payouts mensais passados como &quot;paid&quot;</li>
              </ul>
            </div>

            <Button
              variant="outline"
              onClick={handleMigration}
              isLoading={isMigrating}
              className="border-warning text-warning hover:bg-warning-light"
            >
              <Database className="h-4 w-4 mr-2" />
              Iniciar Migração
            </Button>

            {migrateResult && (
              <div
                className={`p-4 rounded-lg flex items-start gap-3 ${
                  migrateResult.success ? "bg-success-light" : "bg-error-light"
                }`}
              >
                {migrateResult.success ? (
                  <CheckCircle className="h-5 w-5 text-success shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-error shrink-0" />
                )}
                <p className={`text-sm ${migrateResult.success ? "text-success" : "text-error"}`}>
                  {migrateResult.message}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informações do Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-text-secondary">Versão</p>
                <p className="font-medium">1.0.0</p>
              </div>
              <div>
                <p className="text-text-secondary">Ambiente</p>
                <p className="font-medium">
                  {process.env.NODE_ENV === "production" ? "Produção" : "Desenvolvimento"}
                </p>
              </div>
              <div>
                <p className="text-text-secondary">Comissão Base</p>
                <p className="font-medium">30%</p>
              </div>
              <div>
                <p className="text-text-secondary">Período de Disponibilização</p>
                <p className="font-medium">15 dias</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
