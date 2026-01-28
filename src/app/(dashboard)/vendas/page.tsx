"use client";

import { useState, useMemo } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { Header } from "@/components/layout/header";
import { Card, Badge } from "@/components/ui/index";
import { DollarSign, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { formatCurrency, formatDateTime, isDateAvailable } from "@/lib/utils";

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
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#5B21B6]" />
      </div>
    );
  }

  return (
    <>
      <Header
        title="Vendas"
        description="Histórico de comissões"
        user={profile ? { name: profile.full_name || "" } : undefined}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 p-6 lg:p-8">
        <div className="max-w-[1320px] mx-auto space-y-6">
          
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-[#D1FAE5] flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-[#059669]" />
              </div>
              <div>
                <p className="text-sm text-[#6B7280]">Total em comissões</p>
                <p className="text-xl font-semibold text-[#111827]">{formatCurrency(totalComm / 100)}</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-[#FEE2E2] flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-[#DC2626]" />
              </div>
              <div>
                <p className="text-sm text-[#6B7280]">Estornos</p>
                <p className="text-xl font-semibold text-[#111827]">{formatCurrency(totalRef / 100)}</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-[#EDE9FE] flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-[#5B21B6]" />
              </div>
              <div>
                <p className="text-sm text-[#6B7280]">Saldo líquido</p>
                <p className="text-xl font-semibold text-[#111827]">
                  {formatCurrency(((summary?.pending_cents || 0) + (summary?.available_cents || 0)) / 100)}
                </p>
              </div>
            </Card>
          </div>

          {/* Tabela */}
          <Card noPadding>
            <div className="p-6 border-b border-[#F1F3F7] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="font-semibold text-[#111827]">Transações</h3>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-10 px-3 bg-white border border-[#E8EAF0] rounded-xl text-sm text-[#111827] focus:outline-none focus:border-[#5B21B6]"
              >
                <option value="all">Todos os tipos</option>
                <option value="commission">Comissões</option>
                <option value="refund">Estornos</option>
                <option value="dispute">Disputas</option>
              </select>
            </div>

            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-[#6B7280]">Nenhuma transação</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8F9FC]">
                      <th className="text-left py-3 px-6 text-xs font-medium text-[#6B7280] uppercase">Data</th>
                      <th className="text-left py-3 px-6 text-xs font-medium text-[#6B7280] uppercase">Tipo</th>
                      <th className="text-left py-3 px-6 text-xs font-medium text-[#6B7280] uppercase">Valor bruto</th>
                      <th className="text-left py-3 px-6 text-xs font-medium text-[#6B7280] uppercase">Comissão</th>
                      <th className="text-left py-3 px-6 text-xs font-medium text-[#6B7280] uppercase">Valor</th>
                      <th className="text-left py-3 px-6 text-xs font-medium text-[#6B7280] uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((tx, i) => {
                      const neg = tx.commission_amount_cents < 0;
                      const avail = tx.available_at ? isDateAvailable(tx.available_at) : false;
                      return (
                        <tr key={tx.id} className={i % 2 === 1 ? "bg-[#F8F9FC]" : ""}>
                          <td className="py-4 px-6 text-sm text-[#111827]">{tx.paid_at ? formatDateTime(tx.paid_at) : "-"}</td>
                          <td className="py-4 px-6">
                            <Badge variant={tx.type === "commission" ? "success" : tx.type === "refund" ? "error" : "warning"}>
                              {tx.type === "commission" ? "Comissão" : tx.type === "refund" ? "Estorno" : "Disputa"}
                            </Badge>
                          </td>
                          <td className="py-4 px-6 text-sm text-[#6B7280]">{formatCurrency(Math.abs(tx.amount_gross_cents) / 100)}</td>
                          <td className="py-4 px-6 text-sm text-[#6B7280]">{tx.commission_percent}%</td>
                          <td className="py-4 px-6">
                            <span className={`text-sm font-medium ${neg ? "text-[#DC2626]" : "text-[#059669]"}`}>
                              {neg ? "-" : "+"}{formatCurrency(Math.abs(tx.commission_amount_cents) / 100)}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            {neg ? (
                              <Badge variant="error">Debitado</Badge>
                            ) : avail ? (
                              <Badge variant="success">Disponível</Badge>
                            ) : (
                              <Badge variant="warning">Pendente</Badge>
                            )}
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
