"use client";

import { useState } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { Header } from "@/components/layout/header";
import { StatCard, TierProgress, CommissionChart, RecentSales } from "@/components/dashboard";
import { Clock, CheckCircle, Wallet, Users, CreditCard, TrendingUp, Loader2, Sparkles } from "lucide-react";

export default function DashboardPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { profile, affiliate, isLoading: userLoading } = useUser();
  const { summary, transactions, isLoading: dataLoading } = useAffiliateData(affiliate?.id);

  const isLoading = userLoading || dataLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-[#3A1D7A]" />
            <Sparkles className="h-5 w-5 text-indigo-400 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <p className="text-slate-500 font-bold text-sm uppercase tracking-[2px]">Preparando seu Painel...</p>
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
      customerName: "Cliente Individual",
      amount: t.amount_gross_cents,
      commission: t.commission_amount_cents,
      date: t.paid_at || t.created_at,
      status: getTransactionStatus(t.available_at),
    }));

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      <Header
        title="Dashboard"
        subtitle={`Olá, ${profile?.full_name?.split(" ")[0] || "Parceiro"}`}
        userName={profile?.full_name || undefined}
        onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="p-6 lg:p-10 max-w-[1600px] mx-auto space-y-8">
        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
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
            title="Total Recebido"
            value={summary?.paid_cents || 0}
            isCurrency
            icon={Wallet}
            variant="primary"
          />
        </div>

        {/* Secondary Stats & Tier */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-[24px] border border-slate-100 flex items-center gap-4 shadow-sm">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                  <Users className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Trials</p>
                  <p className="text-xl font-black text-slate-900">{summary?.total_trials || 0}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[24px] border border-slate-100 flex items-center gap-4 shadow-sm">
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Ativas</p>
                  <p className="text-xl font-black text-slate-900">{summary?.active_subscriptions || 0}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[24px] border border-slate-100 flex items-center gap-4 shadow-sm">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase">Total</p>
                  <p className="text-xl font-black text-slate-900">{summary?.total_subscriptions || 0}</p>
                </div>
              </div>
            </div>

            <CommissionChart data={chartData} />
          </div>

          <div className="lg:col-span-4 space-y-8">
            <TierProgress
              currentTier={affiliate?.commission_tier || 1}
              paidSubscriptions={affiliate?.paid_subscriptions_count || 0}
            />
            <RecentSales sales={recentSales} />
          </div>
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
