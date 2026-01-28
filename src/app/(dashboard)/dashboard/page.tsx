"use client";

import { useState } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { Header } from "@/components/layout/header";
import { Card, Badge, MetricCard, LoadingScreen } from "@/components/ui/index";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { Clock, CheckCircle, Wallet, Trophy, ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, affiliate, isLoading: userLoading } = useUser();
  const { summary, transactions, isLoading: dataLoading } = useAffiliateData(affiliate?.id);

  const isLoading = userLoading || dataLoading;

  if (isLoading) {
    return <LoadingScreen message="Carregando dashboard..." />;
  }

  const chartData = generateChartData(transactions || []);
  const tierName = affiliate?.commission_tier === 3 ? "Ouro" : affiliate?.commission_tier === 2 ? "Prata" : "Bronze";
  const tierPercent = affiliate?.commission_tier === 3 ? 40 : affiliate?.commission_tier === 2 ? 35 : 30;

  const pendingValue = (summary?.pending_cents || 0) / 100;
  const availableValue = (summary?.available_cents || 0) / 100;
  const paidValue = (summary?.paid_cents || 0) / 100;

  return (
    <>
      <Header
        title="Dashboard"
        description={`Bem-vindo de volta, ${profile?.full_name?.split(" ")[0] || "Parceiro"}`}
        user={profile ? { name: profile.full_name || "" } : undefined}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 p-6 lg:p-8">
        <div className="max-w-[1400px] mx-auto space-y-8 animate-fade-in-up">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            <MetricCard
              icon={Clock}
              label="Saldo pendente"
              value={formatCurrency(pendingValue)}
              color="warning"
            />
            <MetricCard
              icon={CheckCircle}
              label="Saldo disponível"
              value={formatCurrency(availableValue)}
              color="success"
            />
            <MetricCard
              icon={Wallet}
              label="Total recebido"
              value={formatCurrency(paidValue)}
              color="primary"
            />
            <Card hover className="overflow-hidden">
              <div className="flex items-start gap-4">
                <div className={cn(
                  "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                  tierName === "Ouro" ? "bg-gradient-to-br from-yellow-100 to-amber-100" :
                  tierName === "Prata" ? "bg-gradient-to-br from-zinc-100 to-zinc-200" :
                  "bg-gradient-to-br from-amber-100 to-orange-100"
                )}>
                  <Trophy className={cn(
                    "h-6 w-6",
                    tierName === "Ouro" ? "text-amber-600" :
                    tierName === "Prata" ? "text-zinc-500" :
                    "text-amber-700"
                  )} strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-500 truncate mb-1">Seu nível</p>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={tierName === "Ouro" ? "warning" : tierName === "Prata" ? "default" : "primary"}
                      size="lg"
                    >
                      {tierName}
                    </Badge>
                    <span className="text-lg font-bold text-zinc-900">{tierPercent}%</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">{affiliate?.paid_subscriptions_count || 0} vendas realizadas</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Comissões</h3>
                <p className="text-sm text-zinc-500">Evolução nos últimos 6 meses</p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-success-50 rounded-xl">
                <TrendingUp className="h-4 w-4 text-success-600" />
                <span className="text-sm font-semibold text-success-700">
                  {formatCurrency(chartData.reduce((sum, d) => sum + d.value, 0))}
                </span>
                <span className="text-xs text-success-600">total</span>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorComm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9333EA" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#9333EA" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    stroke="#71717A" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="#71717A" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(v) => `R$${v}`}
                    dx={-10}
                  />
                  <Tooltip
                    contentStyle={{ 
                      background: "#fff", 
                      border: "1px solid #E4E4E7", 
                      borderRadius: "16px",
                      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
                    }}
                    formatter={(value) => [formatCurrency(value as number), "Comissão"]}
                    labelStyle={{ color: "#18181B", fontWeight: 600 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#9333EA" 
                    strokeWidth={3} 
                    fill="url(#colorComm)"
                    dot={{ fill: "#9333EA", strokeWidth: 0, r: 4 }}
                    activeDot={{ fill: "#9333EA", strokeWidth: 2, stroke: "#fff", r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Recent Sales */}
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Vendas recentes</h3>
                <p className="text-sm text-zinc-500">Últimas comissões recebidas</p>
              </div>
            </div>
            
            {(!transactions || transactions.length === 0) ? (
              <div className="py-16 text-center">
                <div className="h-16 w-16 mx-auto rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
                  <Wallet className="h-8 w-8 text-zinc-400" />
                </div>
                <p className="text-zinc-600 font-medium">Nenhuma venda ainda</p>
                <p className="text-sm text-zinc-500 mt-1">Compartilhe seus links para começar a ganhar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.filter(t => t.type === "commission").slice(0, 5).map((tx) => {
                  const isAvailable = tx.available_at && new Date(tx.available_at) <= new Date();
                  return (
                    <div 
                      key={tx.id} 
                      className="flex items-center justify-between p-4 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "h-10 w-10 rounded-xl flex items-center justify-center",
                          isAvailable ? "bg-success-100" : "bg-warning-100"
                        )}>
                          {isAvailable ? (
                            <ArrowUpRight className="h-5 w-5 text-success-600" />
                          ) : (
                            <Clock className="h-5 w-5 text-warning-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900">Comissão</p>
                          <p className="text-xs text-zinc-500">
                            {tx.paid_at ? new Date(tx.paid_at).toLocaleDateString("pt-BR") : "-"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-success-600">
                          +{formatCurrency(tx.commission_amount_cents / 100)}
                        </p>
                        <Badge size="sm" variant={isAvailable ? "success" : "warning"} dot>
                          {isAvailable ? "Disponível" : "Pendente"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
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
    const key = date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    months[key] = 0;
  }

  transactions
    .filter(t => t.type === "commission" && t.paid_at)
    .forEach(t => {
      const date = new Date(t.paid_at!);
      const key = date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      if (key in months) months[key] += t.commission_amount_cents / 100;
    });

  return Object.entries(months).map(([month, value]) => ({ month, value }));
}
