"use client";

import { useState, useMemo, useEffect } from "react";
import { useAppData } from "@/contexts";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import {
  Card, Badge, MetricCard, LoadingScreen,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState,
} from "@/components/ui/index";
import { Wallet, Clock, CheckCircle, ChevronDown, ChevronRight, Banknote, CheckCircle2, X } from "lucide-react";
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
  const { profile, affiliate, transactions, payouts, subscriptions, isLoading, isInitialized } = useAppData();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [withdrawingGroup, setWithdrawingGroup] = useState<string | null>(null);
  const [withdrawnGroups, setWithdrawnGroups] = useState<Set<string>>(new Set());
  const [withdrawsLoaded, setWithdrawsLoaded] = useState(false);

  // PIX/Wise modal state
  const [pixModalGroup, setPixModalGroup] = useState<PaymentGroup | null>(null);
  const [pixKey, setPixKey] = useState("");
  const [wiseEmail, setWiseEmail] = useState("");
  const [savingPix, setSavingPix] = useState(false);

  const supabase = createClient();

  // Load existing withdraw requests to mark groups as already requested
  useEffect(() => {
    if (!affiliate?.id) return;
    fetch("/api/withdraw?affiliateId=" + affiliate.id)
      .then(res => res.json())
      .then(data => {
        if (data.dateLabels && data.dateLabels.length > 0) {
          setWithdrawnGroups(new Set(data.dateLabels));
        }
      })
      .catch(() => {})
      .finally(() => setWithdrawsLoaded(true));
  }, [affiliate?.id]);

  const hasPayoutInfo = !!(affiliate?.payout_pix_key || affiliate?.payout_wise_details);

  const handleWithdrawClick = (group: PaymentGroup) => {
    if (hasPayoutInfo) {
      handleWithdraw(group);
    } else {
      setPixKey("");
      setWiseEmail("");
      setPixModalGroup(group);
    }
  };

  const handleSavePixAndWithdraw = async () => {
    if (!pixKey && !wiseEmail) return;
    if (!pixModalGroup || !affiliate) return;

    setSavingPix(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("affiliates") as any).update({
        payout_pix_key: pixKey || null,
        payout_wise_details: wiseEmail.trim() ? { email: wiseEmail.trim() } : null,
      }).eq("id", affiliate.id);

      if (affiliate) {
        affiliate.payout_pix_key = pixKey || null;
        affiliate.payout_wise_details = wiseEmail.trim() ? { email: wiseEmail.trim() } : null;
      }

      setPixModalGroup(null);
      await handleWithdraw(pixModalGroup);
    } catch {
      // silently fail
    } finally {
      setSavingPix(false);
    }
  };

  const handleWithdraw = async (group: PaymentGroup) => {
    setWithdrawingGroup(group.dateKey);
    try {
      const pixInfo = affiliate?.payout_pix_key || pixKey || null;
      const wiseInfo = affiliate?.payout_wise_details
        ? (affiliate.payout_wise_details as { email?: string }).email
        : wiseEmail || null;

      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliateId: affiliate?.id,
          affiliateName: profile?.full_name || "Afiliado",
          amount: formatCurrency(group.totalCents / 100),
          dateLabel: group.dateLabel,
          pixKey: pixInfo,
          wiseEmail: wiseInfo,
        }),
      });

      if (res.ok) {
        setWithdrawnGroups(prev => new Set(prev).add(group.dateLabel));
      }
    } catch {
      // silently fail
    } finally {
      setWithdrawingGroup(null);
    }
  };

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
                      <div className="flex items-center gap-2">
                        {group.status === "available" && withdrawsLoaded && !withdrawnGroups.has(group.dateLabel) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleWithdrawClick(group);
                            }}
                            disabled={withdrawingGroup === group.dateKey}
                            className="px-3 py-1 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 rounded-full transition-colors"
                          >
                            {withdrawingGroup === group.dateKey ? "Solicitando..." : "Solicitar Saque"}
                          </button>
                        )}
                        {group.status === "available" && withdrawnGroups.has(group.dateLabel) && (
                          <span className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full">
                            <CheckCircle2 className="h-3 w-3" />
                            Solicitado
                          </span>
                        )}
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

      {/* PIX/Wise Modal */}
      {pixModalGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setPixModalGroup(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-900">Dados para recebimento</h3>
              <button
                onClick={() => setPixModalGroup(null)}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-zinc-500 mb-5">
              Para solicitar o saque, preencha pelo menos uma forma de recebimento.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Chave PIX
                </label>
                <input
                  type="text"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="CPF, email, telefone ou chave aleatória"
                  className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 transition-all"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-zinc-200" />
                <span className="text-xs text-zinc-400">ou</span>
                <div className="flex-1 h-px bg-zinc-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Email Wise
                </label>
                <input
                  type="email"
                  value={wiseEmail}
                  onChange={(e) => setWiseEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 transition-all"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPixModalGroup(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePixAndWithdraw}
                disabled={savingPix || (!pixKey && !wiseEmail)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed rounded-xl transition-colors"
              >
                {savingPix ? "Salvando..." : "Salvar e Solicitar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
