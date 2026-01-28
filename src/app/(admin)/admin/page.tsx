"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, MetricCard, LoadingScreen } from "@/components/ui/index";
import { Users, DollarSign, CreditCard, TrendingUp, AlertTriangle, ArrowRight, UserCheck, Receipt, Wallet } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import Link from "next/link";

interface AdminStats {
  totalAffiliates: number;
  activeAffiliates: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalCommissions: number;
  pendingPayouts: number;
  totalRefunds: number;
  totalDisputes: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchStats() {
      try {
        const [affiliatesRes, subscriptionsRes, transactionsRes, payoutsRes] = await Promise.all([
          supabase.from("affiliates").select("id, is_active"),
          supabase.from("subscriptions").select("id, status"),
          supabase.from("transactions").select("type, commission_amount_cents"),
          supabase.from("monthly_payouts").select("total_payable_cents, status"),
        ]);

        type AffiliateRow = { id: string; is_active: boolean };
        type SubscriptionRow = { id: string; status: string };
        type TransactionRow = { type: string; commission_amount_cents: number };
        type PayoutRow = { total_payable_cents: number; status: string };

        const affiliates = (affiliatesRes.data || []) as AffiliateRow[];
        const subscriptions = (subscriptionsRes.data || []) as SubscriptionRow[];
        const transactions = (transactionsRes.data || []) as TransactionRow[];
        const payouts = (payoutsRes.data || []) as PayoutRow[];

        setStats({
          totalAffiliates: affiliates.length,
          activeAffiliates: affiliates.filter((a) => a.is_active).length,
          totalSubscriptions: subscriptions.length,
          activeSubscriptions: subscriptions.filter((s) => s.status === "active").length,
          totalCommissions: transactions.filter((t) => t.type === "commission").reduce((sum, t) => sum + t.commission_amount_cents, 0),
          pendingPayouts: payouts.filter((p) => p.status === "pending").reduce((sum, p) => sum + p.total_payable_cents, 0),
          totalRefunds: Math.abs(transactions.filter((t) => t.type === "refund").reduce((sum, t) => sum + t.commission_amount_cents, 0)),
          totalDisputes: Math.abs(transactions.filter((t) => t.type === "dispute").reduce((sum, t) => sum + t.commission_amount_cents, 0)),
        });
      } catch (error) {
        console.error("Error fetching admin stats:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (isLoading) return <LoadingScreen message="Carregando estatísticas..." />;

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto space-y-8 animate-fade-in-up">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-zinc-500 mt-1">Visão geral do programa de afiliados</p>
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard 
            icon={Users} 
            label="Total de Afiliados" 
            value={stats?.totalAffiliates?.toString() || "0"} 
            color="primary" 
          />
          <MetricCard 
            icon={UserCheck} 
            label="Afiliados Ativos" 
            value={stats?.activeAffiliates?.toString() || "0"} 
            color="success" 
          />
          <MetricCard 
            icon={CreditCard} 
            label="Assinaturas Ativas" 
            value={stats?.activeSubscriptions?.toString() || "0"} 
            color="info" 
          />
          <MetricCard 
            icon={Receipt} 
            label="Total de Assinaturas" 
            value={stats?.totalSubscriptions?.toString() || "0"} 
            color="default" 
          />
        </div>

        {/* Financial Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard 
            icon={DollarSign} 
            label="Total Comissões" 
            value={formatCurrency((stats?.totalCommissions || 0) / 100)} 
            color="success" 
          />
          <MetricCard 
            icon={Wallet} 
            label="Pagamentos Pendentes" 
            value={formatCurrency((stats?.pendingPayouts || 0) / 100)} 
            color="warning" 
          />
          <MetricCard 
            icon={TrendingUp} 
            label="Total Estornos" 
            value={formatCurrency((stats?.totalRefunds || 0) / 100)} 
            color="error" 
          />
          <MetricCard 
            icon={AlertTriangle} 
            label="Total Disputas" 
            value={formatCurrency((stats?.totalDisputes || 0) / 100)} 
            color="error" 
          />
        </div>

        {/* Quick Actions */}
        <Card>
          <h3 className="text-lg font-bold text-zinc-900 mb-6">Ações Rápidas</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { href: "/admin/afiliados", icon: Users, title: "Gerenciar Afiliados", desc: "Ver e editar afiliados", color: "primary" },
              { href: "/admin/relatorios", icon: TrendingUp, title: "Relatórios", desc: "Análise de desempenho", color: "info" },
              { href: "/admin/pagamentos", icon: DollarSign, title: "Pagamentos", desc: "Gerenciar payouts mensais", color: "success" },
            ].map((action) => (
              <Link 
                key={action.href}
                href={action.href} 
                className={cn(
                  "group p-6 rounded-2xl border-2 border-zinc-100",
                  "hover:border-primary-200 hover:bg-primary-50/50",
                  "transition-all duration-200"
                )}
              >
                <div className={cn(
                  "h-12 w-12 rounded-xl flex items-center justify-center mb-4",
                  action.color === "primary" ? "bg-primary-100 text-primary-600" :
                  action.color === "info" ? "bg-info-100 text-info-600" :
                  "bg-success-100 text-success-600"
                )}>
                  <action.icon className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-zinc-900 group-hover:text-primary-700 transition-colors">{action.title}</h4>
                <p className="text-sm text-zinc-500 mt-1">{action.desc}</p>
                <div className="flex items-center gap-1 mt-4 text-sm font-medium text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Acessar <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
