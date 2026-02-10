"use client";

import { useState, useMemo } from "react";
import { useAppData } from "@/contexts";
import { Header } from "@/components/layout/header";
import {
  Card, Badge, MetricCard, LoadingScreen,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState,
} from "@/components/ui/index";
import { Wallet, Clock, CheckCircle, ChevronDown, ChevronRight, Banknote } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

interface PaymentGroup {
  dateKey: string;
  dateLabel: string;
  totalCents: number;
  status: "paid" | "available" | "pending";
  transactions: Array<{
    id: string;
    description: string | null;
    commission_amount_cents: number;
    paid_at: string | null;
    customerName: string | null;
  }>;
}

export default function PagamentosPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, transactions, payouts, subscriptions, isLoading, isInitialized } = useAppData();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Map subscription_id -> customer_name
  const subscriptionNames = useMemo(() => {
    const map = new Map<string, string>();
    (subscriptions || []).forEach((sub) => {
      if (sub.id && sub.customer_name) {
        map.set(sub.id, sub.customer_name);
      }
    });
    return map;
  }, [subscriptions]);

  // Build payout months that were paid
  const paidMonths = useMemo(() => {
    const set = new Set<string>();
    (payouts || []).forEach((p) => {
      if (p.status === "paid") {
        set.add(p.month);
      }
    });
    return set;
  }, [payouts]);

  // Group commission transactions by available_at date
  const paymentGroups = useMemo((): PaymentGroup[] => {
    const commissions = (transactions || []).filter(t => t.type === "commission" && t.available_at);
    
    const groups = new Map<string, PaymentGroup>();
    const now = new Date();

    commissions.forEach(tx => {
      const availDate = new Date(tx.available_at!);
      // Use São Paulo timezone to avoid UTC offset issues (e.g. 20/02 showing as 19/02)
      const brtDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(availDate); // "YYYY-MM-DD"
      const dateKey = brtDate;
      
      if (!groups.has(dateKey)) {
        const dateLabel = availDate.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "America/Sao_Paulo",
        });
        
        // Check if paid via monthly_payouts (match by month YYYY-MM)
        const monthKey = dateKey.slice(0, 7);
        const isPaid = paidMonths.has(monthKey);
        const isAvailable = availDate <= now;

        groups.set(dateKey, {
          dateKey,
          dateLabel,
          totalCents: 0,
          status: isPaid ? "paid" : isAvailable ? "available" : "pending",
          transactions: [],
        });
      }

      const group = groups.get(dateKey)!;
      group.totalCents += tx.commission_amount_cents;

      const customerName = tx.subscription_id
        ? subscriptionNames.get(tx.subscription_id) || null
        : null;

      group.transactions.push({
        id: tx.id,
        description: tx.description,
        commission_amount_cents: tx.commission_amount_cents,
        paid_at: tx.paid_at,
        customerName,
      });
    });

    // Sort by date descending (most recent first)
    return Array.from(groups.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [transactions, paidMonths, subscriptionNames]);

  // Summary metrics
  const totalPaid = paymentGroups
    .filter(g => g.status === "paid")
    .reduce((sum, g) => sum + g.totalCents, 0);
  const totalAvailable = paymentGroups
    .filter(g => g.status === "available")
    .reduce((sum, g) => sum + g.totalCents, 0);
  const totalPending = paymentGroups
    .filter(g => g.status === "pending")
    .reduce((sum, g) => sum + g.totalCents, 0);

  if (isLoading && !isInitialized) {
    return <LoadingScreen message="Carregando pagamentos..." />;
  }

  const toggleGroup = (dateKey: string) => {
    setExpandedGroup(expandedGroup === dateKey ? null : dateKey);
  };

  const getStatusBadge = (status: PaymentGroup["status"]) => {
    switch (status) {
      case "paid":
        return <Badge variant="success" size="sm">Pago</Badge>;
      case "available":
        return <Badge variant="warning" size="sm">Disponível</Badge>;
      case "pending":
        return <Badge variant="default" size="sm">Pendente</Badge>;
    }
  };

  const getStatusIcon = (status: PaymentGroup["status"]) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="h-4 w-4 text-success-600" />;
      case "available":
        return <Banknote className="h-4 w-4 text-warning-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-zinc-400" />;
    }
  };

  return (
    <>
      <Header
        title="Pagamentos"
        description="Histórico de comissões por data de recebimento"
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 p-4 lg:p-5">
        <div className="max-w-[1200px] mx-auto space-y-4">

          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetricCard
              icon={CheckCircle}
              label="Total recebido"
              value={formatCurrency(totalPaid / 100)}
              color="success"
            />
            <MetricCard
              icon={Banknote}
              label="Disponível para saque"
              value={formatCurrency(totalAvailable / 100)}
              color="warning"
            />
            <MetricCard
              icon={Clock}
              label="Pendente"
              value={formatCurrency(totalPending / 100)}
              color="default"
            />
          </div>

          {/* Payment Groups */}
          <Card>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-zinc-900">Histórico de pagamentos</h3>
              <p className="text-xs text-zinc-500">{paymentGroups.length} período(s)</p>
            </div>

            {paymentGroups.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Nenhum pagamento"
                description="Suas comissões aparecerão aqui conforme forem liberadas"
              />
            ) : (
              <div className="space-y-2">
                {paymentGroups.map((group) => (
                  <div key={group.dateKey} className="border border-zinc-200 rounded-lg overflow-hidden">
                    {/* Group Header */}
                    <button
                      onClick={() => toggleGroup(group.dateKey)}
                      className={cn(
                        "w-full flex items-center justify-between p-3",
                        "hover:bg-zinc-50 transition-colors",
                        expandedGroup === group.dateKey && "bg-zinc-50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(group.status)}
                        <div className="text-left">
                          <p className="text-sm font-medium text-zinc-900">
                            Liberação {group.dateLabel}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {group.transactions.length} {group.transactions.length === 1 ? "comissão" : "comissões"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getStatusBadge(group.status)}
                        <span className={cn(
                          "text-sm font-semibold",
                          group.status === "paid" ? "text-success-600" :
                          group.status === "available" ? "text-warning-600" :
                          "text-zinc-700"
                        )}>
                          {formatCurrency(group.totalCents / 100)}
                        </span>
                        {expandedGroup === group.dateKey ? (
                          <ChevronDown className="h-4 w-4 text-zinc-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-zinc-400" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Transactions */}
                    {expandedGroup === group.dateKey && (
                      <div className="border-t border-zinc-200">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Cliente</TableHead>
                              <TableHead>Data da venda</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.transactions.map((tx) => (
                              <TableRow key={tx.id}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="h-7 w-7 rounded-full bg-primary-50 flex items-center justify-center text-xs font-bold text-primary-600">
                                      {(tx.customerName || "?")[0].toUpperCase()}
                                    </div>
                                    <span className="text-sm text-zinc-700">
                                      {tx.customerName || "Cliente"}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-zinc-500">
                                  {tx.paid_at
                                    ? new Date(tx.paid_at).toLocaleDateString("pt-BR")
                                    : "-"}
                                </TableCell>
                                <TableCell className="text-right text-sm font-medium text-success-600">
                                  +{formatCurrency(tx.commission_amount_cents / 100)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
