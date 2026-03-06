"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card, MetricCard, LoadingScreen, Button, Input, Select, Badge,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/index";
import {
  DollarSign, TrendingUp, TrendingDown, Wallet, Plus, Trash2,
  ChevronDown, ChevronRight, BarChart3, X,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

interface ManualCost {
  id: string;
  category: string;
  description: string | null;
  amount_cents: number;
}

interface Period {
  label: string;
  startDate: string;
  endDate: string;
  stripeRevenueCents: number;
  abacateRevenueCents: number;
  affiliateCostCents: number;
  manualCosts: ManualCost[];
  manualCostsTotalCents: number;
}

const COST_CATEGORIES = [
  "Infraestrutura",
  "Marketing",
  "Pessoal",
  "Ferramentas",
  "Impostos",
  "Outro",
];

export default function FinanceiroPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [formatLabels, setFormatLabels] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("Infraestrutura");
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/financeiro?months=6");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setPeriods(data.periods);
      setFormatLabels(data.formatLabel);
    } catch (e) {
      console.error("Error fetching financeiro:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddCost = async (periodLabel: string) => {
    if (!newAmount || parseFloat(newAmount) <= 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_label: periodLabel,
          category: newCategory,
          description: newDescription || null,
          amount_cents: Math.round(parseFloat(newAmount) * 100),
        }),
      });
      if (res.ok) {
        setAddingTo(null);
        setNewDescription("");
        setNewAmount("");
        setNewCategory("Infraestrutura");
        await fetchData();
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCost = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/costs?id=${id}`, { method: "DELETE" });
      if (res.ok) await fetchData();
    } catch {
      // silently fail
    } finally {
      setDeleting(null);
    }
  };

  if (isLoading) return <LoadingScreen message="Carregando financeiro..." />;

  const totals = periods.reduce(
    (acc, p) => {
      const totalRevenue = p.stripeRevenueCents + p.abacateRevenueCents;
      const totalCosts = p.affiliateCostCents + p.manualCostsTotalCents;
      acc.revenue += totalRevenue;
      acc.affiliateCosts += p.affiliateCostCents;
      acc.manualCosts += p.manualCostsTotalCents;
      acc.profit += totalRevenue - totalCosts;
      return acc;
    },
    { revenue: 0, affiliateCosts: 0, manualCosts: 0, profit: 0 }
  );

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto space-y-6 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Financeiro</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Fechamento mensal (dia 06 a dia 05 do mês seguinte)
          </p>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={TrendingUp}
            label="Faturamento total"
            value={formatCurrency(totals.revenue / 100)}
            color="success"
          />
          <MetricCard
            icon={DollarSign}
            label="Custo com afiliados"
            value={formatCurrency(totals.affiliateCosts / 100)}
            color="warning"
          />
          <MetricCard
            icon={TrendingDown}
            label="Outros custos"
            value={formatCurrency(totals.manualCosts / 100)}
            color="error"
          />
          <MetricCard
            icon={Wallet}
            label="Lucro líquido"
            value={formatCurrency(totals.profit / 100)}
            color={totals.profit >= 0 ? "primary" : "error"}
          />
        </div>

        {/* Periods */}
        <div className="space-y-3">
          {periods.map((period) => {
            const totalRevenue = period.stripeRevenueCents + period.abacateRevenueCents;
            const totalCosts = period.affiliateCostCents + period.manualCostsTotalCents;
            const profit = totalRevenue - totalCosts;
            const isExpanded = expandedPeriod === period.label;
            const affiliatePercent = totalRevenue > 0
              ? ((period.affiliateCostCents / totalRevenue) * 100).toFixed(1)
              : "0";
            const marginPercent = totalRevenue > 0
              ? ((profit / totalRevenue) * 100).toFixed(1)
              : "0";

            return (
              <Card key={period.label} noPadding>
                {/* Period Header */}
                <button
                  onClick={() => setExpandedPeriod(isExpanded ? null : period.label)}
                  className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-zinc-100 flex items-center justify-center">
                      <BarChart3 className="h-4 w-4 text-zinc-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-zinc-900">
                        {formatLabels[period.label] || period.label}
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        {new Date(period.startDate + "T12:00:00").toLocaleDateString("pt-BR")} — {new Date(period.endDate + "T12:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-6 text-right">
                      <div>
                        <p className="text-[10px] text-zinc-400">Faturamento</p>
                        <p className="text-sm font-semibold text-success-600">
                          {formatCurrency(totalRevenue / 100)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-400">Custos</p>
                        <p className="text-sm font-semibold text-error-600">
                          {formatCurrency(totalCosts / 100)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-zinc-400">Lucro</p>
                        <p className={cn(
                          "text-sm font-semibold",
                          profit >= 0 ? "text-primary-600" : "text-error-600"
                        )}>
                          {formatCurrency(profit / 100)}
                        </p>
                      </div>
                      <Badge variant={profit >= 0 ? "success" : "error"} size="sm">
                        {marginPercent}% margem
                      </Badge>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-zinc-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-zinc-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-zinc-100 p-4 space-y-4">
                    {/* Revenue Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-success-50 border border-success-100">
                        <p className="text-[10px] font-medium text-success-600 uppercase tracking-wider">Stripe</p>
                        <p className="text-lg font-bold text-success-700 mt-1">
                          {formatCurrency(period.stripeRevenueCents / 100)}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                        <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wider">AbacatePay</p>
                        <p className="text-lg font-bold text-emerald-700 mt-1">
                          {period.abacateRevenueCents > 0
                            ? formatCurrency(period.abacateRevenueCents / 100)
                            : "—"}
                        </p>
                        <p className="text-[10px] text-emerald-500 mt-0.5">Em breve</p>
                      </div>
                      <div className="p-3 rounded-lg bg-warning-50 border border-warning-100">
                        <p className="text-[10px] font-medium text-warning-600 uppercase tracking-wider">Afiliados ({affiliatePercent}%)</p>
                        <p className="text-lg font-bold text-warning-700 mt-1">
                          {formatCurrency(period.affiliateCostCents / 100)}
                        </p>
                      </div>
                    </div>

                    {/* Manual Costs */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-zinc-700">Custos manuais</h4>
                        <Button
                          size="xs"
                          variant="secondary"
                          icon={Plus}
                          onClick={() => {
                            setAddingTo(addingTo === period.label ? null : period.label);
                            setNewDescription("");
                            setNewAmount("");
                          }}
                        >
                          Adicionar
                        </Button>
                      </div>

                      {/* Add Cost Form */}
                      {addingTo === period.label && (
                        <div className="p-3 mb-3 border border-zinc-200 rounded-lg bg-zinc-50 space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Select
                              value={newCategory}
                              onChange={(e) => setNewCategory(e.target.value)}
                              options={COST_CATEGORIES.map((c) => ({ value: c, label: c }))}
                            />
                            <Input
                              placeholder="Descrição (opcional)"
                              value={newDescription}
                              onChange={(e) => setNewDescription(e.target.value)}
                            />
                            <Input
                              placeholder="Valor (R$)"
                              type="number"
                              step="0.01"
                              value={newAmount}
                              onChange={(e) => setNewAmount(e.target.value)}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => setAddingTo(null)}
                            >
                              Cancelar
                            </Button>
                            <Button
                              size="xs"
                              loading={saving}
                              onClick={() => handleAddCost(period.label)}
                              disabled={!newAmount || parseFloat(newAmount) <= 0}
                            >
                              Salvar
                            </Button>
                          </div>
                        </div>
                      )}

                      {period.manualCosts.length === 0 && addingTo !== period.label ? (
                        <p className="text-xs text-zinc-400 py-2">
                          Nenhum custo manual neste período
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Categoria</TableHead>
                              <TableHead>Descrição</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                              <TableHead className="w-10"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {period.manualCosts.map((cost) => (
                              <TableRow key={cost.id}>
                                <TableCell>
                                  <Badge variant="default" size="sm">{cost.category}</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-zinc-600">
                                  {cost.description || "—"}
                                </TableCell>
                                <TableCell className="text-right text-sm font-medium text-error-600">
                                  {formatCurrency(cost.amount_cents / 100)}
                                </TableCell>
                                <TableCell>
                                  <button
                                    onClick={() => handleDeleteCost(cost.id)}
                                    disabled={deleting === cost.id}
                                    className="p-1 rounded hover:bg-error-50 text-zinc-400 hover:text-error-600 transition-colors disabled:opacity-50"
                                  >
                                    {deleting === cost.id ? (
                                      <X className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}

                      {period.manualCostsTotalCents > 0 && (
                        <div className="flex justify-end pt-2 border-t border-zinc-100 mt-2">
                          <p className="text-xs text-zinc-500">
                            Total custos manuais:{" "}
                            <span className="font-semibold text-error-600">
                              {formatCurrency(period.manualCostsTotalCents / 100)}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Period Summary */}
                    <div className="p-3 rounded-lg bg-zinc-900 text-white">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-[10px] text-zinc-400 uppercase">Faturamento</p>
                          <p className="text-base font-bold text-success-400 mt-0.5">
                            {formatCurrency(totalRevenue / 100)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-400 uppercase">Afiliados</p>
                          <p className="text-base font-bold text-warning-400 mt-0.5">
                            -{formatCurrency(period.affiliateCostCents / 100)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-400 uppercase">Outros custos</p>
                          <p className="text-base font-bold text-error-400 mt-0.5">
                            -{formatCurrency(period.manualCostsTotalCents / 100)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-400 uppercase">Lucro</p>
                          <p className={cn(
                            "text-base font-bold mt-0.5",
                            profit >= 0 ? "text-white" : "text-error-400"
                          )}>
                            {formatCurrency(profit / 100)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
