"use client";

import { useState, useMemo } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { Header } from "@/components/layout/header";
import { Card, Badge, LoadingScreen, Select, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState } from "@/components/ui/index";
import { CreditCard, AlertTriangle, RefreshCcw, Users, UserCheck, UserX, AlertCircle, Clock } from "lucide-react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

const STATUS_MAP = {
  trialing: { label: "Trial", variant: "info" as const, icon: Clock },
  active: { label: "Ativa", variant: "success" as const, icon: UserCheck },
  past_due: { label: "Atrasada", variant: "warning" as const, icon: AlertCircle },
  canceled: { label: "Cancelada", variant: "default" as const, icon: UserX },
  unpaid: { label: "Não paga", variant: "error" as const, icon: AlertTriangle },
};

export default function AssinaturasPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { affiliate, profile, isLoading: userLoading } = useUser();
  const { subscriptions, isLoading: dataLoading } = useAffiliateData(affiliate?.id);
  const [statusFilter, setStatusFilter] = useState("all");

  const isLoading = userLoading || dataLoading;

  const filtered = useMemo(() => {
    return (subscriptions || []).filter((s) => statusFilter === "all" || s.status === statusFilter);
  }, [subscriptions, statusFilter]);

  const stats = useMemo(() => {
    const subs = subscriptions || [];
    return {
      trialing: subs.filter(s => s.status === "trialing").length,
      active: subs.filter(s => s.status === "active").length,
      canceled: subs.filter(s => s.status === "canceled").length,
      refund: subs.filter(s => s.has_refund).length,
      dispute: subs.filter(s => s.has_dispute).length,
    };
  }, [subscriptions]);

  if (isLoading) {
    return <LoadingScreen message="Carregando assinaturas..." />;
  }

  return (
    <>
      <Header
        title="Assinaturas"
        description="Clientes indicados por você"
        user={profile ? { name: profile.full_name || "" } : undefined}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 p-6 lg:p-8">
        <div className="max-w-[1400px] mx-auto space-y-8 animate-fade-in-up">
          
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: "Trial", value: stats.trialing, icon: Clock, color: "text-info-600", bg: "bg-info-100" },
              { label: "Ativas", value: stats.active, icon: UserCheck, color: "text-success-600", bg: "bg-success-100" },
              { label: "Canceladas", value: stats.canceled, icon: UserX, color: "text-zinc-500", bg: "bg-zinc-100" },
              { label: "Refunds", value: stats.refund, icon: RefreshCcw, color: "text-warning-600", bg: "bg-warning-100" },
              { label: "Disputas", value: stats.dispute, icon: AlertTriangle, color: "text-error-600", bg: "bg-error-100" },
            ].map((stat) => (
              <Card key={stat.label} hover className="!p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", stat.bg)}>
                    <stat.icon className={cn("h-5 w-5", stat.color)} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-500 uppercase">{stat.label}</p>
                    <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Table */}
          <Card noPadding>
            <div className="p-6 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Lista de assinaturas</h3>
                <p className="text-sm text-zinc-500">{filtered.length} assinaturas encontradas</p>
              </div>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: "all", label: "Todos os status" },
                  { value: "trialing", label: "Trial" },
                  { value: "active", label: "Ativa" },
                  { value: "past_due", label: "Atrasada" },
                  { value: "canceled", label: "Cancelada" },
                  { value: "unpaid", label: "Não paga" },
                ]}
                className="w-full sm:w-48"
              />
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhuma assinatura"
                description="Quando seus indicados assinarem, aparecerão aqui"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Próxima cobrança</TableHead>
                    <TableHead>Trial</TableHead>
                    <TableHead>Flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((sub) => {
                    const st = STATUS_MAP[sub.status as keyof typeof STATUS_MAP] || STATUS_MAP.active;
                    return (
                      <TableRow key={sub.id} className="hover:bg-zinc-50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center">
                              <span className="text-xs font-bold text-zinc-500">
                                {(sub.customer_name || "C")[0].toUpperCase()}
                              </span>
                            </div>
                            <span className="font-semibold text-zinc-900">{sub.customer_name || "Cliente"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={st.variant} dot>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {sub.amount_cents ? formatCurrency(sub.amount_cents / 100) : "-"}
                        </TableCell>
                        <TableCell className="text-zinc-500">
                          {sub.started_at ? formatDate(sub.started_at) : "-"}
                        </TableCell>
                        <TableCell className="text-zinc-500">
                          {sub.current_period_end ? formatDate(sub.current_period_end) : "-"}
                        </TableCell>
                        <TableCell>
                          {sub.is_trial || sub.status === "trialing" ? (
                            <Badge variant="info" size="sm">Sim</Badge>
                          ) : (
                            <span className="text-sm text-zinc-400">Não</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {sub.has_refund && (
                              <div className="h-8 w-8 rounded-lg bg-warning-100 flex items-center justify-center" title="Refund">
                                <RefreshCcw className="h-4 w-4 text-warning-600" />
                              </div>
                            )}
                            {sub.has_dispute && (
                              <div className="h-8 w-8 rounded-lg bg-error-100 flex items-center justify-center" title="Disputa">
                                <AlertTriangle className="h-4 w-4 text-error-600" />
                              </div>
                            )}
                            {!sub.has_refund && !sub.has_dispute && (
                              <span className="text-sm text-zinc-400">-</span>
                            )}
                          </div>
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
