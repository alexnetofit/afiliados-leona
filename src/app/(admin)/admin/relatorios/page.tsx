"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Button, Select, LoadingScreen, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/index";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Download, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { formatCurrency, formatMonth } from "@/lib/utils";

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

  const chartData = reports.map((r) => ({ month: formatMonth(r.month).split(" ")[0].slice(0, 3), value: r.netCommissions / 100 })).reverse();
  const totals = useMemo(() => reports.reduce((acc, r) => ({ commissions: acc.commissions + r.totalCommissions, refunds: acc.refunds + r.totalRefunds, disputes: acc.disputes + r.totalDisputes, net: acc.net + r.netCommissions, newSubs: acc.newSubs + r.newSubscriptions, canceledSubs: acc.canceledSubs + r.canceledSubscriptions }), { commissions: 0, refunds: 0, disputes: 0, net: 0, newSubs: 0, canceledSubs: 0 }), [reports]);

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

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-[1320px] mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-[#111827]">Relatórios</h1>
            <p className="text-[#6B7280]">Análise de desempenho do programa</p>
          </div>
          <div className="flex gap-3">
            <Select options={yearOptions} value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="w-32" />
            <Button variant="secondary" onClick={handleExportCSV} icon={Download}>Exportar</Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="flex items-center justify-between">
            <div><p className="text-sm text-[#6B7280]">Total Comissões</p><p className="text-2xl font-semibold text-[#059669]">{formatCurrency(totals.commissions / 100)}</p></div>
            <TrendingUp className="h-8 w-8 text-[#059669]" />
          </Card>
          <Card className="flex items-center justify-between">
            <div><p className="text-sm text-[#6B7280]">Total Estornos</p><p className="text-2xl font-semibold text-[#DC2626]">{formatCurrency((totals.refunds + totals.disputes) / 100)}</p></div>
            <TrendingDown className="h-8 w-8 text-[#DC2626]" />
          </Card>
          <Card className="flex items-center justify-between">
            <div><p className="text-sm text-[#6B7280]">Líquido</p><p className="text-2xl font-semibold text-[#5B21B6]">{formatCurrency(totals.net / 100)}</p></div>
            <DollarSign className="h-8 w-8 text-[#5B21B6]" />
          </Card>
          <Card className="flex items-center justify-between">
            <div><p className="text-sm text-[#6B7280]">Novas Assinaturas</p><p className="text-2xl font-semibold text-[#111827]">{totals.newSubs}</p></div>
            <TrendingUp className="h-8 w-8 text-[#3B82F6]" />
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <h3 className="font-semibold text-[#111827] mb-6">Comissões Líquidas {selectedYear}</h3>
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
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E8EAF0", borderRadius: "12px" }} formatter={(value) => [formatCurrency(value as number), "Comissão"]} />
                <Area type="monotone" dataKey="value" stroke="#5B21B6" strokeWidth={2} fill="url(#colorComm)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Table */}
        <Card noPadding>
          <div className="p-6 border-b border-[#F1F3F7]">
            <h3 className="font-semibold text-[#111827]">Detalhamento Mensal</h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F8F9FC]">
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
                {reports.map((report, i) => (
                  <TableRow key={report.month} className={i % 2 === 1 ? "bg-[#F8F9FC]" : ""}>
                    <TableCell className="font-medium">{formatMonth(report.month)}</TableCell>
                    <TableCell className="text-right text-[#059669]">{formatCurrency(report.totalCommissions / 100)}</TableCell>
                    <TableCell className="text-right text-[#D97706]">{formatCurrency(report.totalRefunds / 100)}</TableCell>
                    <TableCell className="text-right text-[#DC2626]">{formatCurrency(report.totalDisputes / 100)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(report.netCommissions / 100)}</TableCell>
                    <TableCell className="text-right">{report.newSubscriptions}</TableCell>
                    <TableCell className="text-right">{report.canceledSubscriptions}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
