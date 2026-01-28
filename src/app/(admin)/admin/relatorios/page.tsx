"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Button, Select, LoadingScreen, MetricCard, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/index";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Download, TrendingUp, TrendingDown, DollarSign, Users } from "lucide-react";
import { formatCurrency, formatMonth, cn } from "@/lib/utils";

interface MonthlyReport {
  month: string;
  totalCommissions: number;
  totalRefunds: number;
  totalDisputes: number;
  netCommissions: number;
  newSubscriptions: number;
  canceledSubscriptions: number;
}

export default function RelatoriosPage() {
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 3 }, (_, i) => ({ value: (currentYear - i).toString(), label: (currentYear - i).toString() }));
  }, []);

  useEffect(() => {
    fetchReports();
  }, [selectedYear]);

  async function fetchReports() {
    setIsLoading(true);
    try {
      const year = parseInt(selectedYear);
      const monthlyData: MonthlyReport[] = [];

      for (let month = 0; month < 12; month++) {
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0, 23, 59, 59);
        if (startDate > new Date()) continue;

        const { data: transactions } = await supabase.from("transactions").select("type, commission_amount_cents").gte("paid_at", startDate.toISOString()).lte("paid_at", endDate.toISOString());
        const { count: newSubs } = await supabase.from("subscriptions").select("id", { count: "exact", head: true }).gte("started_at", startDate.toISOString()).lte("started_at", endDate.toISOString());
        const { count: canceledSubs } = await supabase.from("subscriptions").select("id", { count: "exact", head: true }).gte("canceled_at", startDate.toISOString()).lte("canceled_at", endDate.toISOString());

        type TransactionRow = { type: string; commission_amount_cents: number };
        const txs = (transactions || []) as TransactionRow[];
        const commissions = txs.filter((t) => t.type === "commission").reduce((sum, t) => sum + t.commission_amount_cents, 0);
        const refunds = Math.abs(txs.filter((t) => t.type === "refund").reduce((sum, t) => sum + t.commission_amount_cents, 0));
        const disputes = Math.abs(txs.filter((t) => t.type === "dispute").reduce((sum, t) => sum + t.commission_amount_cents, 0));

        monthlyData.push({
          month: startDate.toISOString(),
          totalCommissions: commissions,
          totalRefunds: refunds,
          totalDisputes: disputes,
          netCommissions: commissions - refunds - disputes,
          newSubscriptions: newSubs || 0,
          canceledSubscriptions: canceledSubs || 0,
        });
      }

      setReports(monthlyData.reverse());
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const chartData = reports.map((r) => ({ 
    month: formatMonth(r.month).split(" ")[0].slice(0, 3), 
    value: r.netCommissions / 100 
  })).reverse();
  
  const totals = useMemo(() => reports.reduce((acc, r) => ({ 
    commissions: acc.commissions + r.totalCommissions, 
    refunds: acc.refunds + r.totalRefunds, 
    disputes: acc.disputes + r.totalDisputes, 
    net: acc.net + r.netCommissions, 
    newSubs: acc.newSubs + r.newSubscriptions, 
    canceledSubs: acc.canceledSubs + r.canceledSubscriptions 
  }), { commissions: 0, refunds: 0, disputes: 0, net: 0, newSubs: 0, canceledSubs: 0 }), [reports]);

  const handleExportCSV = () => {
    const headers = ["Mês", "Comissões", "Estornos", "Disputas", "Líquido", "Novas", "Cancelamentos"];
    const rows = reports.map((r) => [formatMonth(r.month), (r.totalCommissions / 100).toFixed(2), (r.totalRefunds / 100).toFixed(2), (r.totalDisputes / 100).toFixed(2), (r.netCommissions / 100).toFixed(2), r.newSubscriptions, r.canceledSubscriptions]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-${selectedYear}.csv`;
    link.click();
  };

  if (isLoading) return <LoadingScreen message="Carregando relatórios..." />;

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto space-y-8 animate-fade-in-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Relatórios</h1>
            <p className="text-zinc-500 mt-1">Análise de desempenho do programa</p>
          </div>
          <div className="flex gap-3">
            <Select options={yearOptions} value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="w-32" />
            <Button variant="secondary" onClick={handleExportCSV} icon={Download}>Exportar</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard icon={TrendingUp} label="Total Comissões" value={formatCurrency(totals.commissions / 100)} color="success" />
          <MetricCard icon={TrendingDown} label="Total Estornos" value={formatCurrency((totals.refunds + totals.disputes) / 100)} color="error" />
          <MetricCard icon={DollarSign} label="Líquido" value={formatCurrency(totals.net / 100)} color="primary" />
          <MetricCard icon={Users} label="Novas Assinaturas" value={totals.newSubs.toString()} color="info" />
        </div>

        {/* Chart */}
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h3 className="text-lg font-bold text-zinc-900">Comissões Líquidas {selectedYear}</h3>
              <p className="text-sm text-zinc-500">Evolução mensal</p>
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
                <XAxis dataKey="month" stroke="#71717A" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#71717A" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} dx={-10} />
                <Tooltip 
                  contentStyle={{ background: "#fff", border: "1px solid #E4E4E7", borderRadius: "16px", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }} 
                  formatter={(value) => [formatCurrency(value as number), "Comissão"]} 
                  labelStyle={{ color: "#18181B", fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="value" stroke="#9333EA" strokeWidth={3} fill="url(#colorComm)" dot={{ fill: "#9333EA", strokeWidth: 0, r: 4 }} activeDot={{ fill: "#9333EA", strokeWidth: 2, stroke: "#fff", r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Table */}
        <Card noPadding>
          <div className="p-6 border-b border-zinc-100">
            <h3 className="text-lg font-bold text-zinc-900">Detalhamento Mensal</h3>
            <p className="text-sm text-zinc-500">Dados completos por mês</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Comissões</TableHead>
                <TableHead className="text-right">Estornos</TableHead>
                <TableHead className="text-right">Disputas</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead className="text-right">Novas</TableHead>
                <TableHead className="text-right">Cancelamentos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.month} className="hover:bg-zinc-50">
                  <TableCell className="font-semibold">{formatMonth(report.month)}</TableCell>
                  <TableCell className="text-right text-success-600 font-medium">{formatCurrency(report.totalCommissions / 100)}</TableCell>
                  <TableCell className="text-right text-warning-600">{formatCurrency(report.totalRefunds / 100)}</TableCell>
                  <TableCell className="text-right text-error-600">{formatCurrency(report.totalDisputes / 100)}</TableCell>
                  <TableCell className="text-right font-bold text-zinc-900">{formatCurrency(report.netCommissions / 100)}</TableCell>
                  <TableCell className="text-right text-success-600">{report.newSubscriptions}</TableCell>
                  <TableCell className="text-right text-error-600">{report.canceledSubscriptions}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
