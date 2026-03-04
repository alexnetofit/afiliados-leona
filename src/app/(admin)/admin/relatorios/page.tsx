"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Button, Select, LoadingScreen, MetricCard, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/index";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Download, TrendingUp, TrendingDown, DollarSign, Users } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface PeriodReport {
  periodKey: string;
  periodLabel: string;
  totalCommissions: number;
  totalRefunds: number;
  totalDisputes: number;
  netCommissions: number;
  newSubscriptions: number;
  canceledSubscriptions: number;
}

type TxRow = { type: string; commission_amount_cents: number; available_at: string | null };
type SubStartRow = { started_at: string | null };
type SubCancelRow = { canceled_at: string | null };

function getReleasePeriodKey(dateStr: string): string {
  const d = new Date(dateStr);
  const brt = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const day = brt.getDate();
  const nextMonth = new Date(brt.getFullYear(), brt.getMonth() + 1, 1);
  if (day <= 15) {
    return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-05`;
  }
  return `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-20`;
}

function getAvailableAtKey(dateStr: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateStr));
}

export default function RelatoriosPage() {
  const [reports, setReports] = useState<PeriodReport[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 3 }, (_, i) => ({ value: (currentYear - i).toString(), label: (currentYear - i).toString() }));
  }, []);

  useEffect(() => {
    fetchReports();
  }, [selectedYear]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchReports() {
    setIsLoading(true);
    try {
      const year = parseInt(selectedYear);
      const yearStart = `${year}-01-01T00:00:00Z`;
      const yearEnd = `${year}-12-31T23:59:59Z`;

      const [txResult, newSubsResult, canceledSubsResult] = await Promise.all([
        supabase.from("transactions")
          .select("type, commission_amount_cents, available_at")
          .gte("available_at", yearStart)
          .lte("available_at", yearEnd),
        supabase.from("subscriptions")
          .select("started_at")
          .gte("started_at", yearStart)
          .lte("started_at", yearEnd),
        supabase.from("subscriptions")
          .select("canceled_at")
          .not("canceled_at", "is", null)
          .gte("canceled_at", yearStart)
          .lte("canceled_at", yearEnd),
      ]);

      const transactions = (txResult.data || []) as TxRow[];
      const newSubs = (newSubsResult.data || []) as SubStartRow[];
      const canceledSubs = (canceledSubsResult.data || []) as SubCancelRow[];

      const now = new Date();
      const periods: { key: string; label: string }[] = [];
      for (let month = 0; month < 12; month++) {
        for (const day of [5, 20]) {
          const periodDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
          if (periodDate > now) continue;
          const mm = String(month + 1).padStart(2, "0");
          const dd = String(day).padStart(2, "0");
          periods.push({ key: `${year}-${mm}-${dd}`, label: `${dd}/${mm}/${year}` });
        }
      }

      const txByPeriod = new Map<string, TxRow[]>();
      transactions.forEach(tx => {
        if (!tx.available_at) return;
        const key = getAvailableAtKey(tx.available_at);
        if (!txByPeriod.has(key)) txByPeriod.set(key, []);
        txByPeriod.get(key)!.push(tx);
      });

      const newSubsByPeriod = new Map<string, number>();
      newSubs.forEach(sub => {
        if (!sub.started_at) return;
        const key = getReleasePeriodKey(sub.started_at);
        newSubsByPeriod.set(key, (newSubsByPeriod.get(key) || 0) + 1);
      });

      const canceledSubsByPeriod = new Map<string, number>();
      canceledSubs.forEach(sub => {
        if (!sub.canceled_at) return;
        const key = getReleasePeriodKey(sub.canceled_at);
        canceledSubsByPeriod.set(key, (canceledSubsByPeriod.get(key) || 0) + 1);
      });

      const periodData: PeriodReport[] = periods.map(p => {
        const txs = txByPeriod.get(p.key) || [];
        const commissions = txs.filter(t => t.type === "commission").reduce((sum, t) => sum + t.commission_amount_cents, 0);
        const refunds = Math.abs(txs.filter(t => t.type === "refund").reduce((sum, t) => sum + t.commission_amount_cents, 0));
        const disputes = Math.abs(txs.filter(t => t.type === "dispute").reduce((sum, t) => sum + t.commission_amount_cents, 0));
        return {
          periodKey: p.key,
          periodLabel: p.label,
          totalCommissions: commissions,
          totalRefunds: refunds,
          totalDisputes: disputes,
          netCommissions: commissions - refunds - disputes,
          newSubscriptions: newSubsByPeriod.get(p.key) || 0,
          canceledSubscriptions: canceledSubsByPeriod.get(p.key) || 0,
        };
      });

      setReports(periodData.reverse());
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const chartData = useMemo(() =>
    [...reports].reverse().map(r => ({
      period: r.periodLabel.slice(0, 5),
      value: r.netCommissions / 100,
    }))
  , [reports]);

  const totals = useMemo(() => reports.reduce((acc, r) => ({
    commissions: acc.commissions + r.totalCommissions,
    refunds: acc.refunds + r.totalRefunds,
    disputes: acc.disputes + r.totalDisputes,
    net: acc.net + r.netCommissions,
    newSubs: acc.newSubs + r.newSubscriptions,
    canceledSubs: acc.canceledSubs + r.canceledSubscriptions,
  }), { commissions: 0, refunds: 0, disputes: 0, net: 0, newSubs: 0, canceledSubs: 0 }), [reports]);

  const handleExportCSV = () => {
    const headers = ["Liberação", "Comissões", "Estornos", "Disputas", "Líquido", "Novas Assinaturas", "Cancelamentos"];
    const rows = reports.map(r => [
      r.periodLabel,
      (r.totalCommissions / 100).toFixed(2),
      (r.totalRefunds / 100).toFixed(2),
      (r.totalDisputes / 100).toFixed(2),
      (r.netCommissions / 100).toFixed(2),
      r.newSubscriptions,
      r.canceledSubscriptions,
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Relatórios</h1>
            <p className="text-zinc-500 mt-1">Análise de desempenho por período de liberação</p>
          </div>
          <div className="flex gap-3">
            <Select options={yearOptions} value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="w-32" />
            <Button variant="secondary" onClick={handleExportCSV} icon={Download}>Exportar</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard icon={TrendingUp} label="Total Comissões" value={formatCurrency(totals.commissions / 100)} color="success" />
          <MetricCard icon={TrendingDown} label="Total Estornos" value={formatCurrency((totals.refunds + totals.disputes) / 100)} color="error" />
          <MetricCard icon={DollarSign} label="Líquido" value={formatCurrency(totals.net / 100)} color="primary" />
          <MetricCard icon={Users} label="Novas Assinaturas" value={totals.newSubs.toString()} color="info" />
        </div>

        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h3 className="text-lg font-bold text-zinc-900">Comissões Líquidas {selectedYear}</h3>
              <p className="text-sm text-zinc-500">Evolução por período de liberação</p>
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
                <XAxis dataKey="period" stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#71717A" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} dx={-10} />
                <Tooltip
                  contentStyle={{ background: "#fff", border: "1px solid #E4E4E7", borderRadius: "16px", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
                  formatter={(value) => [formatCurrency(value as number), "Comissão"]}
                  labelStyle={{ color: "#18181B", fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="value" stroke="#9333EA" strokeWidth={3} fill="url(#colorComm)" dot={{ fill: "#9333EA", strokeWidth: 0, r: 3 }} activeDot={{ fill: "#9333EA", strokeWidth: 2, stroke: "#fff", r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card noPadding>
          <div className="p-6 border-b border-zinc-100">
            <h3 className="text-lg font-bold text-zinc-900">Detalhamento por Liberação</h3>
            <p className="text-sm text-zinc-500">Dados completos por período</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Liberação</TableHead>
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
                <TableRow key={report.periodKey} className="hover:bg-zinc-50">
                  <TableCell className="font-semibold">{report.periodLabel}</TableCell>
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
