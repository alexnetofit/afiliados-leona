"use client";

import { useState } from "react";
import { useAppData } from "@/contexts";
import { Header } from "@/components/layout/header";
import { Card, Badge, MetricCard, LoadingScreen } from "@/components/ui/index";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { Clock, CheckCircle, Wallet, Trophy, ArrowUpRight, TrendingUp } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, affiliate, summary, transactions, isLoading, isInitialized } = useAppData();

  // Only show loading on first load, not on navigation
  if (isLoading && !isInitialized) {
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
        description={`Bem-vindo, ${profile?.full_name?.split(" ")[0] || "Parceiro"}`}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 p-4 lg:p-5">
        <div className="max-w-[1200px] mx-auto space-y-4">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
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
            <Card hover>
              <div className="flex items-start gap-3">
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                  tierName === "Ouro" ? "bg-amber-50" :
                  tierName === "Prata" ? "bg-zinc-100" :
                  "bg-orange-50"
                )}>
                  <Trophy className={cn(
                    "h-4.5 w-4.5",
                    tierName === "Ouro" ? "text-amber-600" :
                    tierName === "Prata" ? "text-zinc-500" :
                    "text-orange-600"
                  )} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-500 truncate mb-0.5">Seu nível</p>
                  <div className="flex items-center gap-1.5">
                    <Badge 
                      variant={tierName === "Ouro" ? "warning" : tierName === "Prata" ? "default" : "primary"}
                      size="md"
                    >
                      {tierName}
                    </Badge>
                    <span className="text-sm font-semibold text-zinc-900">{tierPercent}%</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{affiliate?.paid_subscriptions_count || 0} vendas</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Comissões</h3>
                <p className="text-xs text-zinc-500">Últimos 6 meses</p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-success-50 rounded-md">
                <TrendingUp className="h-3.5 w-3.5 text-success-600" />
                <span className="text-xs font-semibold text-success-700">
                  {formatCurrency(chartData.reduce((sum, d) => sum + d.value, 0))}
                </span>
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorComm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C4DDB" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#7C4DDB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    stroke="#71717A" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false}
                    dy={8}
                  />
                  <YAxis 
                    stroke="#71717A" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(v) => `R$${v}`}
                    dx={-5}
                  />
                  <Tooltip
                    contentStyle={{ 
                      background: "#fff", 
                      border: "1px solid #E4E4E7", 
                      borderRadius: "6px",
                      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.04)",
                      fontSize: "12px",
                      padding: "8px 12px"
                    }}
                    formatter={(value) => [formatCurrency(value as number), "Comissão"]}
                    labelStyle={{ color: "#18181B", fontWeight: 600 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#7C4DDB" 
                    strokeWidth={2} 
                    fill="url(#colorComm)"
                    dot={false}
                    activeDot={{ fill: "#7C4DDB", strokeWidth: 2, stroke: "#fff", r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Recent Sales */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Vendas recentes</h3>
                <p className="text-xs text-zinc-500">Últimas comissões</p>
              </div>
            </div>
            
            {(!transactions || transactions.length === 0) ? (
              <div className="py-10 text-center">
                <div className="h-10 w-10 mx-auto rounded-lg bg-zinc-100 flex items-center justify-center mb-2">
                  <Wallet className="h-5 w-5 text-zinc-400" />
                </div>
                <p className="text-sm text-zinc-600 font-medium">Nenhuma venda ainda</p>
                <p className="text-xs text-zinc-500 mt-0.5">Compartilhe seus links para começar</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {transactions.filter(t => t.type === "commission").slice(0, 5).map((tx) => {
                  const isAvailable = tx.available_at && new Date(tx.available_at) <= new Date();
                  return (
                    <div 
                      key={tx.id} 
                      className="flex items-center justify-between p-2.5 rounded-md bg-zinc-50 hover:bg-zinc-100 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "h-8 w-8 rounded-md flex items-center justify-center",
                          isAvailable ? "bg-success-50" : "bg-warning-50"
                        )}>
                          {isAvailable ? (
                            <ArrowUpRight className="h-4 w-4 text-success-600" />
                          ) : (
                            <Clock className="h-4 w-4 text-warning-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-900">Comissão</p>
                          <p className="text-[11px] text-zinc-500">
                            {tx.paid_at ? new Date(tx.paid_at).toLocaleDateString("pt-BR") : "-"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-success-600">
                          +{formatCurrency(tx.commission_amount_cents / 100)}
                        </p>
                        <Badge size="sm" variant={isAvailable ? "success" : "warning"}>
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
