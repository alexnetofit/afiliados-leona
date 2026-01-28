"use client";

import { useState } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { Header } from "@/components/layout/header";
import { StatCard, TierProgress, CommissionChart, RecentSales } from "@/components/dashboard";
import { Clock, CheckCircle, Wallet, Users, CreditCard, TrendingUp, Loader2 } from "lucide-react";

export default function DashboardPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { profile, affiliate, isLoading: userLoading } = useUser();
  const { summary, transactions, isLoading: dataLoading } = useAffiliateData(affiliate?.id);

  const isLoading = userLoading || dataLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#3A1D7A]" />
          <p className="text-gray-500 text-sm font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  const chartData = generateChartData(transactions || []);

  const recentSales = (transactions || [])
    .filter(t => t.type === "commission")
    .slice(0, 5)
    .map(t => ({
      id: t.id,
      customerName: "Cliente",
      amount: t.amount_gross_cents,
      commission: t.commission_amount_cents,
      date: t.paid_at || t.created_at,
      status: getTransactionStatus(t.available_at),
    }));

  return (
    <>
      <Header
        title="Dashboard"
        subtitle={`Bem-vindo, ${profile?.full_name?.split(" ")[0] || "Parceiro"}`}
        userName={profile?.full_name || undefined}
        onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="p-6 lg:p-8">
        {/* Saldos - 3 colunas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Saldo Pendente"
            value={(summary?.pending_cents || 0) / 100}
            isCurrency
            icon={Clock}
            variant="warning"
          />
          <StatCard
            title="Saldo Disponível"
            value={(summary?.available_cents || 0) / 100}
            isCurrency
            icon={CheckCircle}
            variant="success"
          />
          <StatCard
            title="Total Recebido"
            value={(summary?.paid_cents || 0) / 100}
            isCurrency
            icon={Wallet}
            variant="primary"
          />
        </div>

        {/* Stats secundários - 3 colunas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Trials</p>
                <p className="text-2xl font-bold text-gray-900">{summary?.total_trials || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Ativas</p>
                <p className="text-2xl font-bold text-gray-900">{summary?.active_subscriptions || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-violet-50 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</p>
                <p className="text-2xl font-bold text-gray-900">{summary?.total_subscriptions || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tier Progress - largura total */}
        <div className="mb-8">
          <TierProgress
            currentTier={affiliate?.commission_tier || 1}
            paidSubscriptions={affiliate?.paid_subscriptions_count || 0}
          />
        </div>

        {/* Gráfico e Vendas Recentes - 2 colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CommissionChart data={chartData} />
          <RecentSales sales={recentSales} />
        </div>
      </div>
    </>
  );
}

function generateChartData(transactions: Array<{ paid_at: string | null; commission_amount_cents: number; type: string }>) {
  const months: Record<string, number> = {};
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = date.toLocaleDateString("pt-BR", { month: "short" });
    months[key] = 0;
  }

  transactions
    .filter(t => t.type === "commission" && t.paid_at)
    .forEach(t => {
      const date = new Date(t.paid_at!);
      const key = date.toLocaleDateString("pt-BR", { month: "short" });
      if (key in months) {
        months[key] += t.commission_amount_cents / 100;
      }
    });

  return Object.entries(months).map(([month, value]) => ({ month, value }));
}

function getTransactionStatus(availableAt: string | null): "pending" | "available" | "paid" {
  if (!availableAt) return "pending";
  return new Date(availableAt) <= new Date() ? "available" : "pending";
}
