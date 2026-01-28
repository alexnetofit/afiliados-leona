"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, LoadingScreen } from "@/components/ui/index";
import { Users, DollarSign, CreditCard, TrendingUp, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
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

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-[1320px] mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#111827]">Admin Dashboard</h1>
          <p className="text-[#6B7280]">Visão geral do programa de afiliados</p>
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard icon={Users} label="Total de Afiliados" value={stats?.totalAffiliates || 0} color="primary" />
          <StatCard icon={Users} label="Afiliados Ativos" value={stats?.activeAffiliates || 0} color="default" />
          <StatCard icon={CreditCard} label="Assinaturas Ativas" value={stats?.activeSubscriptions || 0} color="success" />
          <StatCard icon={CreditCard} label="Total de Assinaturas" value={stats?.totalSubscriptions || 0} color="default" />
        </div>

        {/* Financial Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard icon={DollarSign} label="Total Comissões" value={formatCurrency((stats?.totalCommissions || 0) / 100)} color="success" />
          <StatCard icon={TrendingUp} label="Pagamentos Pendentes" value={formatCurrency((stats?.pendingPayouts || 0) / 100)} color="warning" />
          <StatCard icon={AlertTriangle} label="Total Estornos" value={formatCurrency((stats?.totalRefunds || 0) / 100)} color="default" />
          <StatCard icon={AlertTriangle} label="Total Disputas" value={formatCurrency((stats?.totalDisputes || 0) / 100)} color="default" />
        </div>

        {/* Quick Actions */}
        <Card>
          <h3 className="font-semibold text-[#111827] mb-6">Ações Rápidas</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/admin/afiliados" className="p-4 rounded-xl border border-[#E8EAF0] hover:border-[#5B21B6] hover:bg-[#EDE9FE]/20 transition-colors">
              <Users className="h-8 w-8 text-[#5B21B6] mb-2" />
              <h4 className="font-semibold text-[#111827]">Gerenciar Afiliados</h4>
              <p className="text-sm text-[#6B7280]">Ver e editar afiliados</p>
            </Link>
            <Link href="/admin/relatorios" className="p-4 rounded-xl border border-[#E8EAF0] hover:border-[#5B21B6] hover:bg-[#EDE9FE]/20 transition-colors">
              <TrendingUp className="h-8 w-8 text-[#5B21B6] mb-2" />
              <h4 className="font-semibold text-[#111827]">Relatórios</h4>
              <p className="text-sm text-[#6B7280]">Análise de desempenho</p>
            </Link>
            <Link href="/admin/pagamentos" className="p-4 rounded-xl border border-[#E8EAF0] hover:border-[#5B21B6] hover:bg-[#EDE9FE]/20 transition-colors">
              <DollarSign className="h-8 w-8 text-[#5B21B6] mb-2" />
              <h4 className="font-semibold text-[#111827]">Pagamentos</h4>
              <p className="text-sm text-[#6B7280]">Gerenciar payouts mensais</p>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: "default" | "primary" | "success" | "warning" }) {
  const colors = {
    default: "bg-[#F8F9FC] text-[#6B7280]",
    primary: "bg-[#EDE9FE] text-[#5B21B6]",
    success: "bg-[#D1FAE5] text-[#059669]",
    warning: "bg-[#FEF3C7] text-[#D97706]",
  };

  return (
    <Card className="flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-[#6B7280] truncate">{label}</p>
        <p className="text-xl font-semibold text-[#111827] truncate">{value}</p>
      </div>
    </Card>
  );
}
