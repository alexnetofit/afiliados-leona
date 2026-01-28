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

  // Generate month options
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

    Array.from(months)
      .sort()
      .reverse()
      .forEach((key) => {
        const [year, month] = key.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1);
        options.push({
          value: key,
          label: date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
        });
      });

    return options;
  }, [transactions]);

  // Filter transactions
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

  // Calculate totals
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
        title="Minhas Vendas" 
        subtitle="Acompanhe suas comissões e transações"
        userName={profile?.full_name || undefined}
        onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total em Comissões</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(totalCommissions)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Estornos</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(totalRefunds)}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Saldo Líquido</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency((summary?.pending_cents || 0) + (summary?.available_cents || 0))}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-[#EDE9FE] flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-[#5B3FA6]" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900">Transações</h2>
              <div className="flex gap-3">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:border-[#5B3FA6] focus:ring-2 focus:ring-[#5B3FA6]/20 outline-none"
                >
                  <option value="all">Todos os tipos</option>
                  <option value="commission">Comissões</option>
                  <option value="refund">Estornos</option>
                  <option value="dispute">Disputas</option>
                </select>
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:border-[#5B3FA6] focus:ring-2 focus:ring-[#5B3FA6]/20 outline-none"
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
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <DollarSign className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">Nenhuma transação encontrada</p>
              <p className="text-gray-400 text-sm mt-1">Quando você fizer vendas, elas aparecerão aqui</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Valor Bruto</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Comissão</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Valor</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTransactions.map((transaction) => {
                    const isNegative = transaction.commission_amount_cents < 0;
                    const available = transaction.available_at
                      ? isDateAvailable(transaction.available_at)
                      : false;

                    return (
                      <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {transaction.paid_at ? formatDateTime(transaction.paid_at) : "-"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            transaction.type === "commission"
                              ? "bg-emerald-100 text-emerald-700"
                              : transaction.type === "refund"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {transaction.type === "commission"
                              ? "Comissão"
                              : transaction.type === "refund"
                              ? "Estorno"
                              : "Disputa"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {formatCurrency(Math.abs(transaction.amount_gross_cents))}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {transaction.commission_percent}%
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm font-bold ${isNegative ? "text-red-600" : "text-emerald-600"}`}>
                            {isNegative ? "-" : "+"}{formatCurrency(Math.abs(transaction.commission_amount_cents))}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {isNegative ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-700">
                              <XCircle className="h-3 w-3" />
                              Debitado
                            </span>
                          ) : available ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-700">
                              <CheckCircle className="h-3 w-3" />
                              Disponível
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700">
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
    </div>
  );
}
