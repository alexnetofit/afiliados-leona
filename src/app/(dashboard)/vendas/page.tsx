"use client";

import { useState, useMemo } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { Header } from "@/components/layout/header";
import { DollarSign, TrendingUp, TrendingDown, Loader2, Clock, CheckCircle, XCircle } from "lucide-react";
import { formatCurrency, formatDateTime, isDateAvailable } from "@/lib/utils";

export default function VendasPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { affiliate, profile, isLoading: userLoading } = useUser();
  const { transactions, summary, isLoading: dataLoading } = useAffiliateData(affiliate?.id);
  const [typeFilter, setTypeFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");

  const isLoading = userLoading || dataLoading;

  const monthOptions = useMemo(() => {
    const options = [{ value: "all", label: "Todos os meses" }];
    const months = new Set<string>();
    
    transactions?.forEach((t) => {
      if (t.paid_at) {
        const date = new Date(t.paid_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        months.add(key);
      }
    });

    Array.from(months).sort().reverse().forEach((key) => {
      const [year, month] = key.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1);
      options.push({
        value: key,
        label: date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      });
    });

    return options;
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return (transactions || []).filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      
      if (monthFilter !== "all" && t.paid_at) {
        const date = new Date(t.paid_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (key !== monthFilter) return false;
      }
      
      return true;
    });
  }, [transactions, typeFilter, monthFilter]);

  const totalCommissions = (transactions || [])
    .filter((t) => t.type === "commission")
    .reduce((sum, t) => sum + t.commission_amount_cents, 0);
  
  const totalRefunds = Math.abs(
    (transactions || [])
      .filter((t) => t.type === "refund" || t.type === "dispute")
      .reduce((sum, t) => sum + t.commission_amount_cents, 0)
  );

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
        title="Vendas" 
        subtitle="Histórico de comissões"
        userName={profile?.full_name || undefined}
        onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-[#E5E7F2] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(58,29,122,0.06)]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-sm text-[#6B6F8D]">Total em comissões</p>
                <p className="text-xl font-semibold text-[#1F1F2E]">{formatCurrency(totalCommissions)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-[#E5E7F2] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(58,29,122,0.06)]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-600" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-sm text-[#6B6F8D]">Estornos</p>
                <p className="text-xl font-semibold text-[#1F1F2E]">{formatCurrency(totalRefunds)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-[#E5E7F2] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(58,29,122,0.06)]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#3A1D7A]/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-[#3A1D7A]" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-sm text-[#6B6F8D]">Saldo líquido</p>
                <p className="text-xl font-semibold text-[#1F1F2E]">
                  {formatCurrency((summary?.pending_cents || 0) + (summary?.available_cents || 0))}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl border border-[#E5E7F2] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(58,29,122,0.06)] overflow-hidden">
          <div className="p-5 border-b border-[#E5E7F2]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-base font-semibold text-[#1F1F2E]">Transações</h2>
              <div className="flex gap-3">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-[#E5E7F2] bg-white text-sm text-[#1F1F2E] focus:outline-none focus:border-[#3A1D7A] focus:ring-4 focus:ring-[#3A1D7A]/10"
                >
                  <option value="all">Todos os tipos</option>
                  <option value="commission">Comissões</option>
                  <option value="refund">Estornos</option>
                  <option value="dispute">Disputas</option>
                </select>
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-[#E5E7F2] bg-white text-sm text-[#1F1F2E] focus:outline-none focus:border-[#3A1D7A] focus:ring-4 focus:ring-[#3A1D7A]/10"
                >
                  {monthOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="text-center py-16">
              <div className="h-12 w-12 mx-auto rounded-xl bg-[#F8F9FC] flex items-center justify-center mb-3">
                <DollarSign className="h-6 w-6 text-[#6B6F8D]" />
              </div>
              <p className="text-sm font-medium text-[#1F1F2E]">Nenhuma transação encontrada</p>
              <p className="text-xs text-[#6B6F8D] mt-1">Suas vendas aparecerão aqui</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F8F9FC]">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B6F8D] uppercase tracking-wider">Data</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B6F8D] uppercase tracking-wider">Tipo</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B6F8D] uppercase tracking-wider">Valor bruto</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B6F8D] uppercase tracking-wider">Comissão</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B6F8D] uppercase tracking-wider">Valor</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-[#6B6F8D] uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7F2]">
                  {filteredTransactions.map((transaction, idx) => {
                    const isNegative = transaction.commission_amount_cents < 0;
                    const available = transaction.available_at ? isDateAvailable(transaction.available_at) : false;

                    return (
                      <tr key={transaction.id} className={idx % 2 === 1 ? "bg-[#F8F9FC]/50" : ""}>
                        <td className="px-5 py-4 text-sm text-[#1F1F2E]">
                          {transaction.paid_at ? formatDateTime(transaction.paid_at) : "-"}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${
                            transaction.type === "commission"
                              ? "bg-emerald-50 text-emerald-700"
                              : transaction.type === "refund"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                          }`}>
                            {transaction.type === "commission" ? "Comissão" : transaction.type === "refund" ? "Estorno" : "Disputa"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-[#6B6F8D]">
                          {formatCurrency(Math.abs(transaction.amount_gross_cents))}
                        </td>
                        <td className="px-5 py-4 text-sm text-[#6B6F8D]">
                          {transaction.commission_percent}%
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-sm font-medium ${isNegative ? "text-red-600" : "text-emerald-600"}`}>
                            {isNegative ? "-" : "+"}{formatCurrency(Math.abs(transaction.commission_amount_cents))}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {isNegative ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-red-50 text-red-700">
                              <XCircle className="h-3 w-3" />
                              Debitado
                            </span>
                          ) : available ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700">
                              <CheckCircle className="h-3 w-3" />
                              Disponível
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700">
                              <Clock className="h-3 w-3" />
                              Pendente
                            </span>
                          )}
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
