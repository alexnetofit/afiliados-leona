"use client";

import { useState, useMemo } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingScreen } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreditCard, AlertTriangle, RefreshCcw } from "lucide-react";
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from "@/lib/utils";

export default function AssinaturasPage() {
  const { affiliate, isLoading: userLoading } = useUser();
  const { subscriptions, isLoading: dataLoading } = useAffiliateData(affiliate?.id);
  const [statusFilter, setStatusFilter] = useState("all");

  const isLoading = userLoading || dataLoading;

  // Filter subscriptions
  const filteredSubscriptions = useMemo(() => {
    return (subscriptions || []).filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      return true;
    });
  }, [subscriptions, statusFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const subs = subscriptions || [];
    return {
      trialing: subs.filter((s) => s.status === "trialing").length,
      active: subs.filter((s) => s.status === "active").length,
      canceled: subs.filter((s) => s.status === "canceled").length,
      withRefund: subs.filter((s) => s.has_refund).length,
      withDispute: subs.filter((s) => s.has_dispute).length,
    };
  }, [subscriptions]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen">
      <Header title="Assinaturas" subtitle="Acompanhe as assinaturas dos seus indicados" />

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-text-secondary uppercase tracking-wider">Trial</p>
              <p className="text-2xl font-bold text-info mt-1">{stats.trialing}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-text-secondary uppercase tracking-wider">Ativas</p>
              <p className="text-2xl font-bold text-success mt-1">{stats.active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-text-secondary uppercase tracking-wider">Canceladas</p>
              <p className="text-2xl font-bold text-text-secondary mt-1">{stats.canceled}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-text-secondary uppercase tracking-wider">Com Refund</p>
              <p className="text-2xl font-bold text-warning mt-1">{stats.withRefund}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-text-secondary uppercase tracking-wider">Com Disputa</p>
              <p className="text-2xl font-bold text-error mt-1">{stats.withDispute}</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>Lista de Assinaturas</CardTitle>
              <Select
                options={[
                  { value: "all", label: "Todos os status" },
                  { value: "trialing", label: "Trial" },
                  { value: "active", label: "Ativa" },
                  { value: "past_due", label: "Atrasada" },
                  { value: "canceled", label: "Cancelada" },
                  { value: "unpaid", label: "Não Paga" },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-48"
              />
            </div>
          </CardHeader>
          <CardContent>
            {filteredSubscriptions.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="Nenhuma assinatura encontrada"
                description="Quando seus indicados assinarem, elas aparecerão aqui"
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Próx. Cobrança</TableHead>
                      <TableHead>Trial</TableHead>
                      <TableHead>Flags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubscriptions.map((subscription) => (
                      <TableRow key={subscription.id}>
                        <TableCell className="font-medium">
                          {subscription.customer_name || "Cliente"}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(subscription.status)}>
                            {getStatusLabel(subscription.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-text-secondary">
                          {subscription.price_id
                            ? subscription.price_id.substring(0, 15) + "..."
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {subscription.amount_cents
                            ? formatCurrency(subscription.amount_cents)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {subscription.started_at
                            ? formatDate(subscription.started_at)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {subscription.current_period_end
                            ? formatDate(subscription.current_period_end)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {subscription.is_trial || subscription.status === "trialing" ? (
                            <Badge variant="info">Sim</Badge>
                          ) : (
                            <span className="text-text-secondary">Não</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {subscription.has_refund && (
                              <span title="Teve refund">
                                <RefreshCcw className="h-4 w-4 text-warning" />
                              </span>
                            )}
                            {subscription.has_dispute && (
                              <span title="Teve disputa">
                                <AlertTriangle className="h-4 w-4 text-error" />
                              </span>
                            )}
                            {!subscription.has_refund && !subscription.has_dispute && (
                              <span className="text-text-secondary">-</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
