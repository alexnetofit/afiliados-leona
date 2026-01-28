"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/ui/spinner";
import { CommissionChart } from "@/components/dashboard/commission-chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    return Array.from({ length: 3 }, (_, i) => ({
      value: (currentYear - i).toString(),
      label: (currentYear - i).toString(),
    }));
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

        // Skip future months
        if (startDate > new Date()) continue;

        // Fetch transactions for this month
        const { data: transactions } = await supabase
          .from("transactions")
          .select("type, commission_amount_cents")
          .gte("paid_at", startDate.toISOString())
          .lte("paid_at", endDate.toISOString());

        // Fetch subscription stats
        const { count: newSubs } = await supabase
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .gte("started_at", startDate.toISOString())
          .lte("started_at", endDate.toISOString());

        const { count: canceledSubs } = await supabase
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .gte("canceled_at", startDate.toISOString())
          .lte("canceled_at", endDate.toISOString());

        type TransactionRow = { type: string; commission_amount_cents: number };
        const txs = (transactions || []) as TransactionRow[];
        const commissions = txs
          .filter((t) => t.type === "commission")
          .reduce((sum, t) => sum + t.commission_amount_cents, 0);
        const refunds = Math.abs(
          txs
            .filter((t) => t.type === "refund")
            .reduce((sum, t) => sum + t.commission_amount_cents, 0)
        );
        const disputes = Math.abs(
          txs
            .filter((t) => t.type === "dispute")
            .reduce((sum, t) => sum + t.commission_amount_cents, 0)
        );

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
    value: r.netCommissions,
  })).reverse();

  const totals = useMemo(() => {
    return reports.reduce(
      (acc, r) => ({
        commissions: acc.commissions + r.totalCommissions,
        refunds: acc.refunds + r.totalRefunds,
        disputes: acc.disputes + r.totalDisputes,
        net: acc.net + r.netCommissions,
        newSubs: acc.newSubs + r.newSubscriptions,
        canceledSubs: acc.canceledSubs + r.canceledSubscriptions,
      }),
      { commissions: 0, refunds: 0, disputes: 0, net: 0, newSubs: 0, canceledSubs: 0 }
    );
  }, [reports]);

  const handleExportCSV = () => {
    const headers = [
      "Mês",
      "Comissões",
      "Estornos",
      "Disputas",
      "Líquido",
      "Novas Assinaturas",
      "Cancelamentos",
    ];
    const rows = reports.map((r) => [
      formatMonth(r.month),
      (r.totalCommissions / 100).toFixed(2),
      (r.totalRefunds / 100).toFixed(2),
      (r.totalDisputes / 100).toFixed(2),
      (r.netCommissions / 100).toFixed(2),
      r.newSubscriptions,
      r.canceledSubscriptions,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-${selectedYear}.csv`;
    link.click();
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen">
      <Header title="Relatórios" subtitle="Análise de desempenho do programa" />

      <div className="p-6 space-y-6">
        {/* Filters */}
        <div className="flex justify-between items-center">
          <Select
            options={yearOptions}
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-32"
          />
          <Button variant="secondary" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">Total Comissões</p>
                  <p className="text-2xl font-bold text-success">
                    {formatCurrency(totals.commissions)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">Total Estornos</p>
                  <p className="text-2xl font-bold text-error">
                    {formatCurrency(totals.refunds + totals.disputes)}
                  </p>
                </div>
                <TrendingDown className="h-8 w-8 text-error" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">Líquido</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(totals.net)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">Novas Assinaturas</p>
                  <p className="text-2xl font-bold text-text-primary">{totals.newSubs}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-info" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <CommissionChart data={chartData} title={`Comissões Líquidas ${selectedYear}`} />

        {/* Monthly Table */}
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Comissões</TableHead>
                  <TableHead className="text-right">Estornos</TableHead>
                  <TableHead className="text-right">Disputas</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead className="text-right">Novas Assin.</TableHead>
                  <TableHead className="text-right">Cancelamentos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.month}>
                    <TableCell className="font-medium">
                      {formatMonth(report.month)}
                    </TableCell>
                    <TableCell className="text-right text-success">
                      {formatCurrency(report.totalCommissions)}
                    </TableCell>
                    <TableCell className="text-right text-warning">
                      {formatCurrency(report.totalRefunds)}
                    </TableCell>
                    <TableCell className="text-right text-error">
                      {formatCurrency(report.totalDisputes)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(report.netCommissions)}
                    </TableCell>
                    <TableCell className="text-right">{report.newSubscriptions}</TableCell>
                    <TableCell className="text-right">{report.canceledSubscriptions}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
