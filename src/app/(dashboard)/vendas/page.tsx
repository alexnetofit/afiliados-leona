"use client";

import { useState, useMemo } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { Header } from "@/components/layout/header";
import { Card, Badge, MetricCard, LoadingScreen, Select, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from "@/components/ui/index";
import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Receipt } from "lucide-react";
import { formatCurrency, formatDateTime, isDateAvailable, cn } from "@/lib/utils";

export default function VendasPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { affiliate, profile, isLoading: userLoading } = useUser();
  const { transactions, summary, isLoading: dataLoading } = useAffiliateData(affiliate?.id);
  const [typeFilter, setTypeFilter] = useState("all");

  const isLoading = userLoading || dataLoading;

  const filtered = useMemo(() => {
    return (transactions || []).filter((t) => typeFilter === "all" || t.type === typeFilter);
  }, [transactions, typeFilter]);

  const totalComm = (transactions || []).filter(t => t.type === "commission").reduce((s, t) => s + t.commission_amount_cents, 0);
  const totalRef = Math.abs((transactions || []).filter(t => t.type === "refund" || t.type === "dispute").reduce((s, t) => s + t.commission_amount_cents, 0));

  if (isLoading) {
    return <LoadingScreen message="Carregando vendas..." />;
  }

  return (
    <>
      <Header
        title="Vendas"
        description="Histórico de comissões e transações"
        user={profile ? { name: profile.full_name || "" } : undefined}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 p-6 lg:p-8">
        <div className="max-w-[1400px] mx-auto space-y-8 animate-fade-in-up">
          
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <MetricCard
              icon={TrendingUp}
              label="Total em comissões"
              value={formatCurrency(totalComm / 100)}
              color="success"
            />
            <MetricCard
              icon={TrendingDown}
              label="Estornos e disputas"
              value={formatCurrency(totalRef / 100)}
              color="error"
            />
            <MetricCard
              icon={DollarSign}
              label="Saldo líquido"
              value={formatCurrency(((summary?.pending_cents || 0) + (summary?.available_cents || 0)) / 100)}
              color="primary"
            />
          </div>

          {/* Table */}
          <Card noPadding>
            <div className="p-6 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Transações</h3>
                <p className="text-sm text-zinc-500">Todas as suas movimentações</p>
              </div>
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                options={[
                  { value: "all", label: "Todos os tipos" },
                  { value: "commission", label: "Comissões" },
                  { value: "refund", label: "Estornos" },
                  { value: "dispute", label: "Disputas" },
                ]}
                className="w-full sm:w-48"
              />
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Nenhuma transação"
                description="Suas transações aparecerão aqui quando você começar a vender"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor bruto</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((tx) => {
                    const neg = tx.commission_amount_cents < 0;
                    const avail = tx.available_at ? isDateAvailable(tx.available_at) : false;
                    return (
                      <TableRow key={tx.id} className="hover:bg-zinc-50">
                        <TableCell className="font-medium">
                          {tx.paid_at ? formatDateTime(tx.paid_at) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={tx.type === "commission" ? "success" : tx.type === "refund" ? "error" : "warning"}
                            dot
                          >
                            {tx.type === "commission" ? "Comissão" : tx.type === "refund" ? "Estorno" : "Disputa"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-zinc-500">
                          {formatCurrency(Math.abs(tx.amount_gross_cents) / 100)}
                        </TableCell>
                        <TableCell className="text-zinc-500">
                          {tx.commission_percent}%
                        </TableCell>
                        <TableCell>
                          <div className={cn(
                            "inline-flex items-center gap-1 font-semibold",
                            neg ? "text-error-600" : "text-success-600"
                          )}>
                            {neg ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                            {neg ? "-" : "+"}{formatCurrency(Math.abs(tx.commission_amount_cents) / 100)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {neg ? (
                            <Badge variant="error" size="sm">Debitado</Badge>
                          ) : avail ? (
                            <Badge variant="success" size="sm">Disponível</Badge>
                          ) : (
                            <Badge variant="warning" size="sm">Pendente</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
