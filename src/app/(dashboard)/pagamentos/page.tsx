"use client";

import { useState, useMemo } from "react";
import { useAppData } from "@/contexts";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import {
  Card, Badge, MetricCard, LoadingScreen,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState,
} from "@/components/ui/index";
import { Wallet, Clock, CheckCircle, ChevronDown, ChevronRight, Banknote, AlertCircle, X } from "lucide-react";
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

interface WithdrawResult {
  success: boolean;
  ownerName?: string;
  bankName?: string;
  error?: string;
}

export default function PagamentosPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, affiliate, transactions, payouts, subscriptions, withdrawnDateLabels, withdrawBalance, isLoading, isInitialized } = useAppData();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [withdrawingGroup, setWithdrawingGroup] = useState<string | null>(null);
  const [localWithdrawn, setLocalWithdrawn] = useState<Map<string, { status: string; paid_at: string | null; amount_text: string | null }>>(new Map());

  const withdrawnGroups = useMemo(() => {
    const merged = new Map(withdrawnDateLabels);
    localWithdrawn.forEach((val, key) => {
      merged.set(key, val);
    });
    return merged;
  }, [withdrawnDateLabels, localWithdrawn]);

  // PIX input modal (first-time setup)
  const [pixModalGroup, setPixModalGroup] = useState<PaymentGroup | null>(null);
  const [pixKey, setPixKey] = useState("");
  const [savingPix, setSavingPix] = useState(false);

  // Confirmation modal
  const [confirmGroup, setConfirmGroup] = useState<PaymentGroup | null>(null);

  // Result feedback
  const [withdrawResult, setWithdrawResult] = useState<WithdrawResult | null>(null);

  const supabase = createClient();

  const hasPixKey = !!affiliate?.payout_pix_key;

  const handleWithdrawClick = (group: PaymentGroup) => {
    if (hasPixKey) {
      setConfirmGroup(group);
    } else {
      setPixKey("");
      setPixModalGroup(group);
    }
  };

  const handleSavePixKey = async () => {
    if (!pixKey.trim()) return;
    if (!pixModalGroup || !affiliate) return;

    setSavingPix(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("affiliates") as any).update({
        payout_pix_key: pixKey.trim(),
      }).eq("id", affiliate.id);

      affiliate.payout_pix_key = pixKey.trim();

      setPixModalGroup(null);
      setConfirmGroup(pixModalGroup);
    } catch {
      // silently fail
    } finally {
      setSavingPix(false);
    }
  };

  const WITHDRAW_FEE_CENTS = 200;

  const handleConfirmWithdraw = async () => {
    if (!confirmGroup || !affiliate) return;

    const currentPixKey = affiliate.payout_pix_key;
    if (!currentPixKey) return;

    const netCents = confirmGroup.totalCents - WITHDRAW_FEE_CENTS;
    if (netCents <= 0) return;

    setWithdrawingGroup(confirmGroup.dateKey);
    setConfirmGroup(null);

    try {
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliateId: affiliate.id,
          affiliateName: profile?.full_name || "Afiliado",
          amount: formatCurrency(confirmGroup.totalCents / 100),
          amountCents: netCents,
          dateLabel: confirmGroup.dateLabel,
          pixKey: currentPixKey,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setLocalWithdrawn(prev => {
          const next = new Map(prev);
          next.set(confirmGroup.dateLabel, {
            status: "processing",
            paid_at: null,
            amount_text: formatCurrency(confirmGroup.totalCents / 100),
          });
          return next;
        });
        setWithdrawResult({
          success: true,
          ownerName: data.ownerName,
          bankName: data.bankName,
        });
      } else {
        setWithdrawResult({
          success: false,
          error: data.error || "Erro ao processar saque",
        });
      }
    } catch {
      setWithdrawResult({
        success: false,
        error: "Erro de conexão. Tente novamente.",
      });
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

  // Group all transactions (commissions + refunds/disputes) by available_at date
  const paymentGroups = useMemo((): PaymentGroup[] => {
    const allTxs = (transactions || []).filter(t => t.available_at);
    
    const groups = new Map<string, PaymentGroup>();
    const now = new Date();

    allTxs.forEach(tx => {
      const availDate = new Date(tx.available_at!);
      const brtDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(availDate);
      const dateKey = brtDate;
      
      if (!groups.has(dateKey)) {
        const dateLabel = availDate.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: "America/Sao_Paulo",
        });
        
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

    return Array.from(groups.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [transactions, paidMonths, subscriptionNames]);

  // Summary metrics
  const totalPaid = paymentGroups
    .filter(g => g.status === "paid" || (g.status === "available" && withdrawnGroups.get(g.dateLabel)?.status === "paid"))
    .reduce((sum, g) => sum + g.totalCents, 0);
  const totalAvailableBuckets = paymentGroups
    .filter(g => g.status === "available" && withdrawnGroups.get(g.dateLabel)?.status !== "paid")
    .reduce((sum, g) => sum + g.totalCents, 0);
  const totalPending = paymentGroups
    .filter(g => g.status === "pending")
    .reduce((sum, g) => sum + g.totalCents, 0);

  // Saldo "real": vem do backend (líquido liberado - sacado) e desconta saques
  // anteriores cujo amount_text foi gravado em valor bruto antes do recálculo
  // automático da taxa do gateway (~7%). Quando há ajuste pendente, exibimos
  // o líquido real ao invés da soma bruta dos buckets pra evitar o "click
  // frustrante" no botão Solicitar Saque.
  const ajustePendenteCents = withdrawBalance?.ajustePendenteCents ?? 0;
  const saldoRealCents = withdrawBalance?.saldoDisponivelCents ?? totalAvailableBuckets;
  const hasAjustePendente = ajustePendenteCents > 0;
  const totalAvailable = hasAjustePendente
    ? Math.max(saldoRealCents, 0)
    : totalAvailableBuckets;

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

          {hasAjustePendente && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900 space-y-1">
                <p className="font-semibold">Ajuste de saldo em andamento</p>
                <p>
                  Saques anteriores a 12/03/2026 foram processados sobre o valor bruto e desde então
                  o sistema passou a contabilizar a comissão líquida (já descontada a taxa do gateway de ~7%).
                  Por isso, o seu saldo disponível neste momento está {formatCurrency(ajustePendenteCents / 100)} menor
                  que a soma dos períodos liberados na lista abaixo.
                </p>
                <p className="text-xs text-amber-700 pt-1">
                  Já estamos compensando isso automaticamente — qualquer dúvida, fala com o suporte.
                </p>
              </div>
            </div>
          )}

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
                        {(() => {
                          const w = withdrawnGroups.get(group.dateLabel);
                          if (group.status === "available" && w?.status === "paid") {
                            return <CheckCircle className="h-4 w-4 text-success-600" />;
                          }
                          if (group.status === "available" && w?.status === "processing") {
                            return <Clock className="h-4 w-4 text-blue-500" />;
                          }
                          if (group.status === "available" && w?.status === "failed") {
                            return <AlertCircle className="h-4 w-4 text-red-500" />;
                          }
                          return getStatusIcon(group.status);
                        })()}
                        <div className="text-left">
                          <p className="text-sm font-medium text-zinc-900">
                            Liberação {group.dateLabel}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {group.transactions.length} {group.transactions.length === 1 ? "transação" : "transações"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {group.status === "available" && !withdrawnGroups.has(group.dateLabel) && (
                          group.totalCents <= WITHDRAW_FEE_CENTS ? (
                            <span className="px-3 py-1 text-xs font-medium text-zinc-400 bg-zinc-100 rounded-full cursor-not-allowed" title="Valor insuficiente para cobrir a taxa de transferência">
                              Valor insuficiente
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWithdrawClick(group);
                              }}
                              disabled={withdrawingGroup === group.dateKey}
                              className="px-3 py-1 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 rounded-full transition-colors"
                            >
                              {withdrawingGroup === group.dateKey ? "Processando..." : "Solicitar Saque"}
                            </button>
                          )
                        )}
                        {group.status === "available" && withdrawnGroups.has(group.dateLabel) && withdrawnGroups.get(group.dateLabel)?.status === "paid" && (
                          <Badge variant="success" size="sm">
                            Pago em {withdrawnGroups.get(group.dateLabel)?.paid_at
                              ? new Date(withdrawnGroups.get(group.dateLabel)!.paid_at!).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })
                              : ""}
                          </Badge>
                        )}
                        {group.status === "available" && withdrawnGroups.get(group.dateLabel)?.status === "processing" && (
                          <span className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-full">
                            <Clock className="h-3 w-3" />
                            Transferência em andamento
                          </span>
                        )}
                        {group.status === "available" && withdrawnGroups.get(group.dateLabel)?.status === "failed" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleWithdrawClick(group);
                            }}
                            disabled={withdrawingGroup === group.dateKey}
                            className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-full transition-colors"
                          >
                            Falhou - Tentar novamente
                          </button>
                        )}
                        {group.status === "available" && withdrawnGroups.has(group.dateLabel) && withdrawnGroups.get(group.dateLabel)?.status === "pending" && (
                          <span className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-full">
                            <Clock className="h-3 w-3" />
                            Saque solicitado
                          </span>
                        )}
                        {!(group.status === "available" && withdrawnGroups.get(group.dateLabel)?.status === "paid") && getStatusBadge(group.status)}
                        <span className={cn(
                          "text-sm font-semibold",
                          group.status === "available" && withdrawnGroups.get(group.dateLabel)?.status === "paid"
                            ? "text-success-600"
                            : group.status === "paid" ? "text-success-600"
                            : group.status === "available" ? "text-warning-600"
                            : "text-zinc-700"
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
                              <TableHead>Data</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.transactions.map((tx) => {
                              const isNeg = tx.commission_amount_cents < 0;
                              return (
                                <TableRow key={tx.id}>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className={cn(
                                        "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold",
                                        isNeg ? "bg-error-50 text-error-600" : "bg-primary-50 text-primary-600"
                                      )}>
                                        {(tx.customerName || "?")[0].toUpperCase()}
                                      </div>
                                      <div>
                                        <span className="text-sm text-zinc-700">
                                          {tx.customerName || "Cliente"}
                                        </span>
                                        {isNeg && (
                                          <p className="text-[10px] text-error-500 font-medium">Estorno</p>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm text-zinc-500">
                                    {tx.paid_at
                                      ? new Date(tx.paid_at).toLocaleDateString("pt-BR")
                                      : "-"}
                                  </TableCell>
                                  <TableCell className={cn(
                                    "text-right text-sm font-medium",
                                    isNeg ? "text-error-600" : "text-success-600"
                                  )}>
                                    {isNeg ? "-" : "+"}{formatCurrency(Math.abs(tx.commission_amount_cents) / 100)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
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

      {/* PIX Key Input Modal (first-time setup) */}
      {pixModalGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setPixModalGroup(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-900">Chave PIX para recebimento</h3>
              <button
                onClick={() => setPixModalGroup(null)}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-zinc-500 mb-5">
              Informe sua chave PIX para receber os saques. Esta chave será salva para os próximos saques.
            </p>

            <div className="mb-6">
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

            <div className="flex gap-3">
              <button
                onClick={() => setPixModalGroup(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePixKey}
                disabled={savingPix || !pixKey.trim()}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed rounded-xl transition-colors"
              >
                {savingPix ? "Salvando..." : "Salvar e Continuar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmGroup && (() => {
        const WITHDRAW_FEE_CENTS = 200;
        const grossCents = confirmGroup.totalCents;
        const netCents = grossCents - WITHDRAW_FEE_CENTS;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setConfirmGroup(null)}
            />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-fade-in-up">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-zinc-900">Confirmar Saque</h3>
                <button
                  onClick={() => setConfirmGroup(null)}
                  className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-sm text-zinc-500 mb-5">
                Confira os dados abaixo antes de confirmar o saque. A transferência será processada via PIX.
              </p>

              <div className="bg-zinc-50 rounded-xl p-4 space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">Comissão</span>
                  <span className="text-sm font-medium text-zinc-900">
                    {formatCurrency(grossCents / 100)}
                  </span>
                </div>
                <div className="h-px bg-zinc-200" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">Taxa de transferência</span>
                  <span className="text-sm font-medium text-red-500">
                    - {formatCurrency(WITHDRAW_FEE_CENTS / 100)}
                  </span>
                </div>
                <div className="h-px bg-zinc-200" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500 font-semibold">Valor a receber</span>
                  <span className="text-lg font-bold text-zinc-900">
                    {formatCurrency(netCents / 100)}
                  </span>
                </div>
                <div className="h-px bg-zinc-200" />
                <div className="flex justify-between items-start">
                  <span className="text-sm text-zinc-500">Chave PIX</span>
                  <span className="text-sm font-medium text-zinc-900 text-right max-w-[200px] break-all">
                    {affiliate?.payout_pix_key}
                  </span>
                </div>
                <div className="h-px bg-zinc-200" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">Liberação</span>
                  <span className="text-sm font-medium text-zinc-700">{confirmGroup.dateLabel}</span>
                </div>
              </div>

              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3 mb-6">
                Ao confirmar, a transferência PIX de {formatCurrency(netCents / 100)} será criada automaticamente. Verifique se sua chave PIX está correta.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmGroup(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmWithdraw}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors"
                >
                  Confirmar Saque
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Result Feedback Modal */}
      {withdrawResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setWithdrawResult(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-fade-in-up">
            {withdrawResult.success ? (
              <>
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                    <Clock className="h-7 w-7 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900 mb-1">Saque Solicitado!</h3>
                  <p className="text-sm text-zinc-500">
                    Seu pagamento será processado em até 1 dia útil.
                  </p>
                </div>

                {(withdrawResult.ownerName || withdrawResult.bankName) && (
                  <div className="bg-zinc-50 rounded-xl p-4 space-y-2 mb-6">
                    {withdrawResult.ownerName && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-zinc-500">Titular</span>
                        <span className="text-sm font-medium text-zinc-900">{withdrawResult.ownerName}</span>
                      </div>
                    )}
                    {withdrawResult.bankName && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-zinc-500">Banco</span>
                        <span className="text-sm font-medium text-zinc-700">{withdrawResult.bankName}</span>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-zinc-400 text-center mb-4">
                  Você receberá um email quando o pagamento for confirmado.
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="h-14 w-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                    <AlertCircle className="h-7 w-7 text-red-600" />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900 mb-1">Erro no Saque</h3>
                  <p className="text-sm text-zinc-500">
                    {withdrawResult.error}
                  </p>
                </div>
              </>
            )}

            <button
              onClick={() => setWithdrawResult(null)}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
