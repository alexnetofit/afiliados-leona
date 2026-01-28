"use client";

import { useState, useMemo } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { Header } from "@/components/layout/header";
import { CreditCard, AlertTriangle, RefreshCcw, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusConfig = {
  trialing: { label: "Trial", bg: "bg-blue-50", text: "text-blue-700" },
  active: { label: "Ativa", bg: "bg-emerald-50", text: "text-emerald-700" },
  past_due: { label: "Atrasada", bg: "bg-amber-50", text: "text-amber-700" },
  canceled: { label: "Cancelada", bg: "bg-gray-100", text: "text-gray-700" },
  unpaid: { label: "Não paga", bg: "bg-red-50", text: "text-red-700" },
};

export default function AssinaturasPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { affiliate, profile, isLoading: userLoading } = useUser();
  const { subscriptions, isLoading: dataLoading } = useAffiliateData(affiliate?.id);
  const [statusFilter, setStatusFilter] = useState("all");

  const isLoading = userLoading || dataLoading;

  const filteredSubscriptions = useMemo(() => {
    return (subscriptions || []).filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      return true;
    });
  }, [subscriptions, statusFilter]);

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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#3A1D7A]" />
      </div>
    );
  }

  return (
    <>
      <Header 
        title="Assinaturas" 
        subtitle="Clientes dos seus indicados"
        userName={profile?.full_name || undefined}
        onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: "Trial", value: stats.trialing, color: "text-blue-600" },
            { label: "Ativas", value: stats.active, color: "text-emerald-600" },
            { label: "Canceladas", value: stats.canceled, color: "text-gray-600" },
            { label: "Com refund", value: stats.withRefund, color: "text-amber-600" },
            { label: "Com disputa", value: stats.withDispute, color: "text-red-600" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl p-4 border border-[#E5E7F2] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(58,29,122,0.06)]">
              <p className="text-xs text-[#6B6F8D] uppercase tracking-wider">{stat.label}</p>
              <p className={`text-2xl font-semibold mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl border border-[#E5E7F2] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(58,29,122,0.06)] overflow-hidden">
          <div className="p-5 border-b border-[#E5E7F2]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-base font-semibold text-[#1F1F2E]">Lista de assinaturas</h2>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-3 rounded-xl border border-[#E5E7F2] bg-white text-sm text-[#1F1F2E] focus:outline-none focus:border-[#3A1D7A] focus:ring-4 focus:ring-[#3A1D7A]/10"
              >
                <option value="all">Todos os status</option>
                <option value="trialing">Trial</option>
                <option value="active">Ativa</option>
                <option value="past_due">Atrasada</option>
                <option value="canceled">Cancelada</option>
                <option value="unpaid">Não paga</option>
              </select>
            </div>
          </div>

          {filteredSubscriptions.length === 0 ? (
            <div className="text-center py-16">
              <div className="h-12 w-12 mx-auto rounded-xl bg-[#F8F9FC] flex items-center justify-center mb-3">
                <CreditCard className="h-6 w-6 text-[#6B6F8D]" />
              </div>
              <p className="text-sm font-medium text-[#1F1F2E]">Nenhuma assinatura encontrada</p>
              <p className="text-xs text-[#6B6F8D] mt-1">Assinaturas dos seus indicados aparecerão aqui</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F8F9FC]">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B6F8D] uppercase tracking-wider">Cliente</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B6F8D] uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B6F8D] uppercase tracking-wider">Valor</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B6F8D] uppercase tracking-wider">Início</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B6F8D] uppercase tracking-wider">Próxima cobrança</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B6F8D] uppercase tracking-wider">Trial</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B6F8D] uppercase tracking-wider">Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7F2]">
                  {filteredSubscriptions.map((subscription, idx) => {
                    const status = statusConfig[subscription.status as keyof typeof statusConfig] || statusConfig.active;
                    
                    return (
                      <tr key={subscription.id} className={idx % 2 === 1 ? "bg-[#F8F9FC]/50" : ""}>
                        <td className="px-5 py-4 text-sm font-medium text-[#1F1F2E]">
                          {subscription.customer_name || "Cliente"}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${status.bg} ${status.text}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-[#6B6F8D]">
                          {subscription.amount_cents ? formatCurrency(subscription.amount_cents) : "-"}
                        </td>
                        <td className="px-5 py-4 text-sm text-[#6B6F8D]">
                          {subscription.started_at ? formatDate(subscription.started_at) : "-"}
                        </td>
                        <td className="px-5 py-4 text-sm text-[#6B6F8D]">
                          {subscription.current_period_end ? formatDate(subscription.current_period_end) : "-"}
                        </td>
                        <td className="px-5 py-4">
                          {subscription.is_trial || subscription.status === "trialing" ? (
                            <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                              Sim
                            </span>
                          ) : (
                            <span className="text-sm text-[#6B6F8D]">Não</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex gap-2">
                            {subscription.has_refund && (
                              <span title="Teve refund" className="p-1.5 rounded-md bg-amber-50">
                                <RefreshCcw className="h-3.5 w-3.5 text-amber-600" />
                              </span>
                            )}
                            {subscription.has_dispute && (
                              <span title="Teve disputa" className="p-1.5 rounded-md bg-red-50">
                                <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                              </span>
                            )}
                            {!subscription.has_refund && !subscription.has_dispute && (
                              <span className="text-sm text-[#6B6F8D]">-</span>
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
    </>
  );
}
