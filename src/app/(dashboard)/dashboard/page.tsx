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
      <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#5B3FA6]" />
          <p className="text-gray-500 text-sm">Carregando dados...</p>
        </div>
      </div>
    );
  }

  // Generate chart data from transactions (last 6 months)
  const chartData = generateChartData(transactions || []);

  // Get recent sales (last 5 commissions)
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
    <div className="min-h-screen bg-[#F8F9FC]">
      <Header
        title="Dashboard"
        subtitle={`Bem-vindo de volta, ${profile?.full_name?.split(" ")[0] || "Parceiro"}!`}
        userName={profile?.full_name || undefined}
        onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          <StatCard
            title="Saldo Pendente"
            value={summary?.pending_cents || 0}
            isCurrency
            icon={Clock}
            variant="warning"
          />
          <StatCard
            title="Saldo Disponível"
            value={summary?.available_cents || 0}
            isCurrency
            icon={CheckCircle}
            variant="success"
          />
          <StatCard
            title="Total Pago"
            value={summary?.paid_cents || 0}
            isCurrency
            icon={Wallet}
            variant="primary"
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
          <StatCard
            title="Trials Iniciados"
            value={summary?.total_trials || 0}
            icon={Users}
            variant="info"
          />
          <StatCard
            title="Assinaturas Ativas"
            value={summary?.active_subscriptions || 0}
            icon={CreditCard}
            variant="success"
          />
          <StatCard
            title="Total de Assinaturas"
            value={summary?.total_subscriptions || 0}
            icon={TrendingUp}
            variant="primary"
          />
        </div>

        {/* Tier Progress */}
        <TierProgress
          currentTier={affiliate?.commission_tier || 1}
          paidSubscriptions={affiliate?.paid_subscriptions_count || 0}
        />

        {/* Charts and Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <CommissionChart data={chartData} />
          <RecentSales sales={recentSales} />
        </div>
      </div>
    </div>
  );
}

function generateChartData(transactions: Array<{ paid_at: string | null; commission_amount_cents: number; type: string }>) {
  const months: Record<string, number> = {};
  const now = new Date();

  // Initialize last 6 months
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    months[key] = 0;
  }

  // Sum commissions by month
  transactions
    .filter(t => t.type === "commission" && t.paid_at)
    .forEach(t => {
      const date = new Date(t.paid_at!);
      const key = date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      if (key in months) {
        months[key] += t.commission_amount_cents;
      }
    });

  return Object.entries(months).map(([month, value]) => ({ month, value }));
}

function getTransactionStatus(availableAt: string | null): "pending" | "available" | "paid" {
  if (!availableAt) return "pending";
  return new Date(availableAt) <= new Date() ? "available" : "pending";
}
