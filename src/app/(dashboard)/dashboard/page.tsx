"use client";

import { useState } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { Header } from "@/components/layout/header";
import { StatCard, TierProgress, CommissionChart, RecentSales } from "@/components/dashboard";
import { Clock, CheckCircle, Wallet, Loader2 } from "lucide-react";

export default function DashboardPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { profile, affiliate, isLoading: userLoading } = useUser();
  const { summary, transactions, isLoading: dataLoading } = useAffiliateData(affiliate?.id);

  const isLoading = userLoading || dataLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#3A1D7A]" />
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

      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* Saldos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Saldo pendente"
            value={(summary?.pending_cents || 0) / 100}
            isCurrency
            icon={Clock}
            variant="warning"
          />
          <StatCard
            title="Saldo disponível"
            value={(summary?.available_cents || 0) / 100}
            isCurrency
            icon={CheckCircle}
            variant="success"
          />
          <StatCard
            title="Total recebido"
            value={(summary?.paid_cents || 0) / 100}
            isCurrency
            icon={Wallet}
            variant="primary"
          />
        </div>

        {/* Tier Progress */}
        <TierProgress
          currentTier={affiliate?.commission_tier || 1}
          paidSubscriptions={affiliate?.paid_subscriptions_count || 0}
        />

        {/* Charts */}
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
