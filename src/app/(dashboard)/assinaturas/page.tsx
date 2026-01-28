"use client";

import { useState, useMemo } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { Header } from "@/components/layout/header";
import { Card, Badge } from "@/components/ui/index";
import { CreditCard, AlertTriangle, RefreshCcw, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUS_MAP = {
  trialing: { label: "Trial", variant: "primary" as const },
  active: { label: "Ativa", variant: "success" as const },
  past_due: { label: "Atrasada", variant: "warning" as const },
  canceled: { label: "Cancelada", variant: "default" as const },
  unpaid: { label: "Não paga", variant: "error" as const },
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
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#5B21B6]" />
      </div>
    );
  }

  return (
    <>
      <Header
        title="Assinaturas"
        description="Clientes dos seus indicados"
        user={profile ? { name: profile.full_name || "" } : undefined}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 p-6 lg:p-8">
        <div className="max-w-[1320px] mx-auto space-y-6">
          
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: "Trial", value: stats.trialing, color: "text-[#5B21B6]" },
              { label: "Ativas", value: stats.active, color: "text-[#059669]" },
              { label: "Canceladas", value: stats.canceled, color: "text-[#6B7280]" },
              { label: "Refunds", value: stats.refund, color: "text-[#D97706]" },
              { label: "Disputas", value: stats.dispute, color: "text-[#DC2626]" },
            ].map((stat) => (
              <Card key={stat.label} padding="sm">
                <p className="text-xs text-[#6B7280] uppercase">{stat.label}</p>
                <p className={`text-2xl font-semibold mt-1 ${stat.color}`}>{stat.value}</p>
              </Card>
            ))}
          </div>

          {/* Tabela */}
          <Card noPadding>
            <div className="p-6 border-b border-[#F1F3F7] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="font-semibold text-[#111827]">Lista de assinaturas</h3>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-3 bg-white border border-[#E8EAF0] rounded-xl text-sm text-[#111827] focus:outline-none focus:border-[#5B21B6]"
              >
                <option value="all">Todos os status</option>
                <option value="trialing">Trial</option>
                <option value="active">Ativa</option>
                <option value="past_due">Atrasada</option>
                <option value="canceled">Cancelada</option>
                <option value="unpaid">Não paga</option>
              </select>
            </div>

            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <CreditCard className="h-8 w-8 mx-auto text-[#9CA3AF] mb-3" />
                <p className="text-[#6B7280]">Nenhuma assinatura</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8F9FC]">
                      <th className="text-left py-3 px-6 text-xs font-medium text-[#6B7280] uppercase">Cliente</th>
                      <th className="text-left py-3 px-6 text-xs font-medium text-[#6B7280] uppercase">Status</th>
                      <th className="text-left py-3 px-6 text-xs font-medium text-[#6B7280] uppercase">Valor</th>
                      <th className="text-left py-3 px-6 text-xs font-medium text-[#6B7280] uppercase">Início</th>
                      <th className="text-left py-3 px-6 text-xs font-medium text-[#6B7280] uppercase">Próxima</th>
                      <th className="text-left py-3 px-6 text-xs font-medium text-[#6B7280] uppercase">Trial</th>
                      <th className="text-left py-3 px-6 text-xs font-medium text-[#6B7280] uppercase">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((sub, i) => {
                      const st = STATUS_MAP[sub.status as keyof typeof STATUS_MAP] || STATUS_MAP.active;
                      return (
                        <tr key={sub.id} className={i % 2 === 1 ? "bg-[#F8F9FC]" : ""}>
                          <td className="py-4 px-6 text-sm font-medium text-[#111827]">{sub.customer_name || "Cliente"}</td>
                          <td className="py-4 px-6"><Badge variant={st.variant}>{st.label}</Badge></td>
                          <td className="py-4 px-6 text-sm text-[#6B7280]">{sub.amount_cents ? formatCurrency(sub.amount_cents / 100) : "-"}</td>
                          <td className="py-4 px-6 text-sm text-[#6B7280]">{sub.started_at ? formatDate(sub.started_at) : "-"}</td>
                          <td className="py-4 px-6 text-sm text-[#6B7280]">{sub.current_period_end ? formatDate(sub.current_period_end) : "-"}</td>
                          <td className="py-4 px-6">
                            {sub.is_trial || sub.status === "trialing" ? <Badge variant="primary">Sim</Badge> : <span className="text-sm text-[#9CA3AF]">Não</span>}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex gap-2">
                              {sub.has_refund && <span className="p-1.5 rounded bg-[#FEF3C7]"><RefreshCcw className="h-3.5 w-3.5 text-[#D97706]" /></span>}
                              {sub.has_dispute && <span className="p-1.5 rounded bg-[#FEE2E2]"><AlertTriangle className="h-3.5 w-3.5 text-[#DC2626]" /></span>}
                              {!sub.has_refund && !sub.has_dispute && <span className="text-sm text-[#9CA3AF]">-</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
