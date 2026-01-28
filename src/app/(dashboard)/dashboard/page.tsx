"use client";

import { useUser, useAffiliateData } from "@/hooks";
import { Header } from "@/components/layout/header";
import { StatCard, TierProgress, CommissionChart, RecentSales } from "@/components/dashboard";
import { LoadingScreen } from "@/components/ui/spinner";
import { Clock, CheckCircle, Wallet, Users, CreditCard, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const { profile, affiliate, isLoading: userLoading } = useUser();
  const { summary, transactions, isLoading: dataLoading } = useAffiliateData(affiliate?.id);

  const isLoading = userLoading || dataLoading;

  if (isLoading) {
    return <LoadingScreen />;
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
    <div className="min-h-screen">
      <Header
        title="Dashboard"
        subtitle={`Bem-vindo, ${profile?.full_name || "Parceiro"}!`}
        userName={profile?.full_name || undefined}
      />

      <div className="p-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Trials Iniciados"
            value={summary?.total_trials || 0}
            icon={Users}
          />
          <StatCard
            title="Assinaturas Ativas"
            value={summary?.active_subscriptions || 0}
            icon={CreditCard}
          />
          <StatCard
            title="Total de Assinaturas"
            value={summary?.total_subscriptions || 0}
            icon={TrendingUp}
          />
        </div>

        {/* Tier Progress */}
        <TierProgress
          currentTier={affiliate?.commission_tier || 1}
          paidSubscriptions={affiliate?.paid_subscriptions_count || 0}
        />

        {/* Charts and Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
