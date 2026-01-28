"use client";

import { useState } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { Header } from "@/components/layout/header";
import { Card, Badge } from "@/components/ui/index";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { Clock, CheckCircle, Wallet, Trophy, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, affiliate, isLoading: userLoading } = useUser();
  const { summary, transactions, isLoading: dataLoading } = useAffiliateData(affiliate?.id);

  const isLoading = userLoading || dataLoading;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#5B21B6]" />
      </div>
    );
  }

  const chartData = generateChartData(transactions || []);
  const tierName = affiliate?.commission_tier === 3 ? "Ouro" : affiliate?.commission_tier === 2 ? "Prata" : "Bronze";
  const tierPercent = affiliate?.commission_tier === 3 ? 40 : affiliate?.commission_tier === 2 ? 35 : 30;

  return (
    <>
      <Header
        title="Dashboard"
        description={`Bem-vindo, ${profile?.full_name?.split(" ")[0] || "Parceiro"}`}
        user={profile ? { name: profile.full_name || "" } : undefined}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Container principal com max-width e padding consistente */}
      <div className="flex-1 p-6 lg:p-8">
        <div className="max-w-[1320px] mx-auto space-y-6">
          
          {/* Grid de métricas - 4 colunas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              icon={Clock}
              label="Saldo pendente"
              value={formatCurrency((summary?.pending_cents || 0) / 100)}
              color="warning"
            />
            <MetricCard
              icon={CheckCircle}
              label="Saldo disponível"
              value={formatCurrency((summary?.available_cents || 0) / 100)}
              color="success"
            />
            <MetricCard
              icon={Wallet}
              label="Total recebido"
              value={formatCurrency((summary?.paid_cents || 0) / 100)}
              color="primary"
            />
            <MetricCard
              icon={Trophy}
              label="Seu nível"
              value={`${tierName} • ${tierPercent}%`}
              color="default"
              extra={`${affiliate?.paid_subscriptions_count || 0} vendas`}
            />
          </div>

          {/* Gráfico - full width */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-semibold text-[#111827]">Comissões</h3>
                <p className="text-sm text-[#6B7280]">Últimos 6 meses</p>
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorComm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5B21B6" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#5B21B6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F3F7" vertical={false} />
                  <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip
                    contentStyle={{ background: "#fff", border: "1px solid #E8EAF0", borderRadius: "12px" }}
                    formatter={(value) => [formatCurrency(value as number), "Comissão"]}
                  />
                  <Area type="monotone" dataKey="value" stroke="#5B21B6" strokeWidth={2} fill="url(#colorComm)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Vendas recentes - full width */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-semibold text-[#111827]">Vendas recentes</h3>
                <p className="text-sm text-[#6B7280]">Últimas comissões</p>
              </div>
            </div>
            
            {(!transactions || transactions.length === 0) ? (
              <div className="py-12 text-center">
                <p className="text-[#6B7280]">Nenhuma venda ainda</p>
                <p className="text-sm text-[#9CA3AF] mt-1">Compartilhe seus links para começar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#F1F3F7]">
                      <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280] uppercase">Data</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280] uppercase">Tipo</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280] uppercase">Comissão</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280] uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.filter(t => t.type === "commission").slice(0, 5).map((tx, i) => (
                      <tr key={tx.id} className={i % 2 === 1 ? "bg-[#F8F9FC]" : ""}>
                        <td className="py-3 px-4 text-sm text-[#111827]">
                          {tx.paid_at ? new Date(tx.paid_at).toLocaleDateString("pt-BR") : "-"}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="success">Comissão</Badge>
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-[#059669]">
                          +{formatCurrency(tx.commission_amount_cents / 100)}
                        </td>
                        <td className="py-3 px-4">
                          {tx.available_at && new Date(tx.available_at) <= new Date() ? (
                            <Badge variant="success">Disponível</Badge>
                          ) : (
                            <Badge variant="warning">Pendente</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

// Componente local para metric cards
function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  color, 
  extra 
}: { 
  icon: any; 
  label: string; 
  value: string; 
  color: "default" | "success" | "warning" | "primary";
  extra?: string;
}) {
  const colors = {
    default: "bg-[#F8F9FC] text-[#6B7280]",
    success: "bg-[#D1FAE5] text-[#059669]",
    warning: "bg-[#FEF3C7] text-[#D97706]",
    primary: "bg-[#EDE9FE] text-[#5B21B6]",
  };

  return (
    <Card className="flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-[#6B7280] truncate">{label}</p>
        <p className="text-xl font-semibold text-[#111827] truncate">{value}</p>
        {extra && <p className="text-xs text-[#9CA3AF]">{extra}</p>}
      </div>
    </Card>
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
      if (key in months) months[key] += t.commission_amount_cents / 100;
    });

  return Object.entries(months).map(([month, value]) => ({ month, value }));
}
