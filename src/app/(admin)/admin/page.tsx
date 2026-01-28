"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/spinner";
import { Users, DollarSign, CreditCard, TrendingUp, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

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
        // Fetch all stats in parallel
        const [
          affiliatesRes,
          subscriptionsRes,
          transactionsRes,
          payoutsRes,
        ] = await Promise.all([
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
          totalCommissions: transactions
            .filter((t) => t.type === "commission")
            .reduce((sum, t) => sum + t.commission_amount_cents, 0),
          pendingPayouts: payouts
            .filter((p) => p.status === "pending")
            .reduce((sum, p) => sum + p.total_payable_cents, 0),
          totalRefunds: Math.abs(
            transactions
              .filter((t) => t.type === "refund")
              .reduce((sum, t) => sum + t.commission_amount_cents, 0)
          ),
          totalDisputes: Math.abs(
            transactions
              .filter((t) => t.type === "dispute")
              .reduce((sum, t) => sum + t.commission_amount_cents, 0)
          ),
        });
      } catch (error) {
        console.error("Error fetching admin stats:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen">
      <Header title="Admin Dashboard" subtitle="Visão geral do programa de afiliados" />

      <div className="p-6 space-y-6">
        {/* Main Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total de Afiliados"
            value={stats?.totalAffiliates || 0}
            icon={Users}
            variant="primary"
          />
          <StatCard
            title="Afiliados Ativos"
            value={stats?.activeAffiliates || 0}
            icon={Users}
          />
          <StatCard
            title="Assinaturas Ativas"
            value={stats?.activeSubscriptions || 0}
            icon={CreditCard}
            variant="success"
          />
          <StatCard
            title="Total de Assinaturas"
            value={stats?.totalSubscriptions || 0}
            icon={CreditCard}
          />
        </div>

        {/* Financial Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Comissões"
            value={stats?.totalCommissions || 0}
            isCurrency
            icon={DollarSign}
            variant="success"
          />
          <StatCard
            title="Pagamentos Pendentes"
            value={stats?.pendingPayouts || 0}
            isCurrency
            icon={TrendingUp}
            variant="warning"
          />
          <StatCard
            title="Total Estornos"
            value={stats?.totalRefunds || 0}
            isCurrency
            icon={AlertTriangle}
          />
          <StatCard
            title="Total Disputas"
            value={stats?.totalDisputes || 0}
            isCurrency
            icon={AlertTriangle}
          />
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a
                href="/admin/afiliados"
                className="p-4 rounded-lg border border-border hover:border-primary hover:bg-primary-lightest/20 transition-colors"
              >
                <Users className="h-8 w-8 text-primary mb-2" />
                <h3 className="font-semibold text-text-primary">Gerenciar Afiliados</h3>
                <p className="text-sm text-text-secondary">Ver e editar afiliados</p>
              </a>
              <a
                href="/admin/relatorios"
                className="p-4 rounded-lg border border-border hover:border-primary hover:bg-primary-lightest/20 transition-colors"
              >
                <TrendingUp className="h-8 w-8 text-primary mb-2" />
                <h3 className="font-semibold text-text-primary">Relatórios</h3>
                <p className="text-sm text-text-secondary">Análise de desempenho</p>
              </a>
              <a
                href="/admin/pagamentos"
                className="p-4 rounded-lg border border-border hover:border-primary hover:bg-primary-lightest/20 transition-colors"
              >
                <DollarSign className="h-8 w-8 text-primary mb-2" />
                <h3 className="font-semibold text-text-primary">Pagamentos</h3>
                <p className="text-sm text-text-secondary">Gerenciar payouts mensais</p>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
