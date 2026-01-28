"use client";

import { useState, useMemo } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { Header } from "@/components/layout/header";
import { CreditCard, AlertTriangle, RefreshCcw, Loader2, Sparkles, Check, Clock, X, AlertCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusConfig = {
  trialing: { label: "Trial", bg: "bg-blue-100", text: "text-blue-700", icon: Sparkles },
  active: { label: "Ativa", bg: "bg-emerald-100", text: "text-emerald-700", icon: Check },
  past_due: { label: "Atrasada", bg: "bg-amber-100", text: "text-amber-700", icon: Clock },
  canceled: { label: "Cancelada", bg: "bg-gray-100", text: "text-gray-700", icon: X },
  unpaid: { label: "Não Paga", bg: "bg-red-100", text: "text-red-700", icon: AlertCircle },
};

export default function AssinaturasPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { affiliate, profile, isLoading: userLoading } = useUser();
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
    return (
      <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#5B3FA6]" />
          <p className="text-gray-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      <Header 
        title="Assinaturas" 
        subtitle="Acompanhe as assinaturas dos seus indicados"
        userName={profile?.full_name || undefined}
        onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Trial</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.trialing}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Ativas</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.active}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Canceladas</p>
            <p className="text-2xl font-bold text-gray-600 mt-1">{stats.canceled}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Com Refund</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{stats.withRefund}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Com Disputa</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{stats.withDispute}</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900">Lista de Assinaturas</h2>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:border-[#5B3FA6] focus:ring-2 focus:ring-[#5B3FA6]/20 outline-none"
              >
                <option value="all">Todos os status</option>
                <option value="trialing">Trial</option>
                <option value="active">Ativa</option>
                <option value="past_due">Atrasada</option>
                <option value="canceled">Cancelada</option>
                <option value="unpaid">Não Paga</option>
              </select>
            </div>
          </div>

          {filteredSubscriptions.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <CreditCard className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">Nenhuma assinatura encontrada</p>
              <p className="text-gray-400 text-sm mt-1">Quando seus indicados assinarem, elas aparecerão aqui</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Valor</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Início</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Próx. Cobrança</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Trial</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredSubscriptions.map((subscription) => {
                    const status = statusConfig[subscription.status as keyof typeof statusConfig] || statusConfig.active;
                    const StatusIcon = status.icon;
                    
                    return (
                      <tr key={subscription.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {subscription.customer_name || "Cliente"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${status.bg} ${status.text}`}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {subscription.amount_cents
                            ? formatCurrency(subscription.amount_cents)
                            : "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {subscription.started_at
                            ? formatDate(subscription.started_at)
                            : "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {subscription.current_period_end
                            ? formatDate(subscription.current_period_end)
                            : "-"}
                        </td>
                        <td className="px-6 py-4">
                          {subscription.is_trial || subscription.status === "trialing" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700">
                              <Sparkles className="h-3 w-3" />
                              Sim
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">Não</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {subscription.has_refund && (
                              <span title="Teve refund" className="p-1.5 rounded-lg bg-amber-100">
                                <RefreshCcw className="h-4 w-4 text-amber-600" />
                              </span>
                            )}
                            {subscription.has_dispute && (
                              <span title="Teve disputa" className="p-1.5 rounded-lg bg-red-100">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                              </span>
                            )}
                            {!subscription.has_refund && !subscription.has_dispute && (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
