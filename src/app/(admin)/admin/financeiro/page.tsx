"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Card, MetricCard, LoadingScreen, Button, Input, Select, Badge,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/index";
import {
  DollarSign, TrendingUp, TrendingDown, Wallet, Plus, Trash2,
  ChevronDown, ChevronRight, BarChart3, X, RefreshCw,
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
  stripeRevenueBrlCents: number;
  stripeRevenueUsdCents: number;
  abacateRevenueCents: number;
  usdBrlRate: number;
  affiliateCostCents: number;
  manualCosts: ManualCost[];
  manualCostsTotalCents: number;
  revenueCached: boolean;
}

interface RevenueCache {
  stripeRevenueBrlCents: number;
  stripeRevenueUsdCents: number;
  abacateRevenueCents: number;
  usdBrlRate: number;
}

const LS_KEY = "fin_revenue_cache";

function readRevenueCache(): Record<string, RevenueCache> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeRevenueCache(label: string, data: RevenueCache) {
  try {
    const cache = readRevenueCache();
    cache[label] = data;
    localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch { /* */ }
}

const COST_CATEGORIES = [
  "Infraestrutura", "Marketing", "Pessoal", "Ferramentas", "Impostos", "Outro",
];

export default function FinanceiroPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [formatLabels, setFormatLabels] = useState<Record<string, string>>({});
  const [currentPeriod, setCurrentPeriod] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadingRevenue, setLoadingRevenue] = useState<Record<string, boolean>>({});
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("Infraestrutura");
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const didInit = useRef(false);

  const applyLocalFallback = useCallback((periodsData: Period[], cp: string) => {
    const cache = readRevenueCache();
    return periodsData.map((p) => {
      if (p.label === cp || p.revenueCached) return p;
      const local = cache[p.label];
      if (local) return { ...p, ...local, revenueCached: true };
      return p;
    });
  }, []);

  const fetchPeriods = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/financeiro");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const merged = applyLocalFallback(data.periods, data.currentPeriod);
      setPeriods(merged);
      setFormatLabels(data.formatLabel);
      setCurrentPeriod(data.currentPeriod);
      return data.currentPeriod as string;
    } catch (e) {
      console.error("fetchPeriods error:", e);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [applyLocalFallback]);

  const fetchRevenue = useCallback(async (label: string) => {
    setLoadingRevenue((prev) => ({ ...prev, [label]: true }));
    try {
      const res = await fetch(`/api/admin/financeiro?revenue=${label}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const rev: RevenueCache = {
        stripeRevenueBrlCents: data.stripeRevenueBrlCents,
        stripeRevenueUsdCents: data.stripeRevenueUsdCents,
        abacateRevenueCents: data.abacateRevenueCents,
        usdBrlRate: data.usdBrlRate,
      };
      writeRevenueCache(label, rev);
      setPeriods((prev) =>
        prev.map((p) =>
          p.label === label ? { ...p, ...rev, revenueCached: true } : p
        )
      );
    } catch (e) {
      console.error(`fetchRevenue(${label}) error:`, e);
    } finally {
      setLoadingRevenue((prev) => ({ ...prev, [label]: false }));
    }
  }, []);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    fetchPeriods().then((cp) => {
      if (cp) fetchRevenue(cp);
    });
  }, [fetchPeriods, fetchRevenue]);

  const handleAddCost = async (periodLabel: string) => {
    if (!newAmount || parseFloat(newAmount) <= 0) return;
    setSaving(true);

    const isTax = newCategory === "Impostos";
    let amountCents: number;
    let description: string | null;

    if (isTax) {
      const period = periods.find((p) => p.label === periodLabel);
      const abacate = period?.abacateRevenueCents || 0;
      const pct = parseFloat(newAmount);
      amountCents = Math.round(abacate * pct / 100);
      description = `${pct}% sobre AbacatePay (R$ ${(abacate / 100).toFixed(2)})`;
    } else {
      amountCents = Math.round(parseFloat(newAmount) * 100);
      description = newDescription || null;
    }

    try {
      const res = await fetch("/api/admin/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_label: periodLabel,
          category: newCategory,
          description,
          amount_cents: amountCents,
        }),
      });
      if (res.ok) {
        setAddingTo(null);
        setNewDescription("");
        setNewAmount("");
        setNewCategory("Infraestrutura");
        await fetchPeriods();
      }
    } catch { /* */ } finally {
      setSaving(false);
    }
  };

  const handleDeleteCost = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/costs?id=${id}`, { method: "DELETE" });
      if (res.ok) await fetchPeriods();
    } catch { /* */ } finally {
      setDeleting(null);
    }
  };

  if (isLoading) return <LoadingScreen message="Carregando financeiro..." />;

  const totals = periods.reduce(
    (acc, p) => {
      const totalRevenue = p.stripeRevenueBrlCents + p.abacateRevenueCents;
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
            Fechamento mensal (dia 06 a dia 05 do mês seguinte) &middot; Valores Stripe convertidos USD &rarr; BRL
          </p>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={TrendingUp} label="Faturamento total" value={formatCurrency(totals.revenue / 100)} color="success" />
          <MetricCard icon={DollarSign} label="Custo com afiliados" value={formatCurrency(totals.affiliateCosts / 100)} color="warning" />
          <MetricCard icon={TrendingDown} label="Outros custos" value={formatCurrency(totals.manualCosts / 100)} color="error" />
          <MetricCard icon={Wallet} label="Lucro líquido" value={formatCurrency(totals.profit / 100)} color={totals.profit >= 0 ? "primary" : "error"} />
        </div>

        {/* Periods */}
        <div className="space-y-3">
          {periods.map((period) => {
            const totalRevenue = period.stripeRevenueBrlCents + period.abacateRevenueCents;
            const totalCosts = period.affiliateCostCents + period.manualCostsTotalCents;
            const profit = totalRevenue - totalCosts;
            const isExpanded = expandedPeriod === period.label;
            const isCurrent = period.label === currentPeriod;
            const isLoadingRev = loadingRevenue[period.label];
            const hasRevData = period.revenueCached;
            const affiliatePercent = totalRevenue > 0 ? ((period.affiliateCostCents / totalRevenue) * 100).toFixed(1) : "0";
            const marginPercent = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : "0";

            return (
              <Card key={period.label} noPadding>
                <button
                  onClick={() => setExpandedPeriod(isExpanded ? null : period.label)}
                  className="w-full p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", isCurrent ? "bg-primary-100" : "bg-zinc-100")}>
                      <BarChart3 className={cn("h-4 w-4", isCurrent ? "text-primary-600" : "text-zinc-600")} />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-zinc-900">
                          {formatLabels[period.label] || period.label}
                        </p>
                        {isCurrent && <Badge variant="primary" size="sm">Atual</Badge>}
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        {new Date(period.startDate + "T12:00:00").toLocaleDateString("pt-BR")} — {new Date(period.endDate + "T12:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {isLoadingRev ? (
                      <div className="flex items-center gap-2 text-zinc-400">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span className="text-xs hidden sm:inline">Buscando...</span>
                      </div>
                    ) : hasRevData ? (
                      <div className="hidden sm:flex items-center gap-6 text-right">
                        <div>
                          <p className="text-[10px] text-zinc-400">Faturamento</p>
                          <p className="text-sm font-semibold text-success-600">{formatCurrency(totalRevenue / 100)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-400">Custos</p>
                          <p className="text-sm font-semibold text-error-600">{formatCurrency(totalCosts / 100)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-400">Lucro</p>
                          <p className={cn("text-sm font-semibold", profit >= 0 ? "text-primary-600" : "text-error-600")}>
                            {formatCurrency(profit / 100)}
                          </p>
                        </div>
                        <Badge variant={profit >= 0 ? "success" : "error"} size="sm">
                          {marginPercent}% margem
                        </Badge>
                      </div>
                    ) : (
                      <div className="hidden sm:flex items-center gap-4 text-right">
                        <div>
                          <p className="text-[10px] text-zinc-400">Custos afiliados</p>
                          <p className="text-sm font-semibold text-warning-600">{formatCurrency(period.affiliateCostCents / 100)}</p>
                        </div>
                        <Badge variant="default" size="sm">Faturamento pendente</Badge>
                      </div>
                    )}
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-zinc-400" />
                      : <ChevronRight className="h-4 w-4 text-zinc-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-zinc-100 p-4 space-y-4">
                    {!hasRevData && !isLoadingRev && (
                      <div className="flex items-center justify-center py-3 px-4 rounded-lg bg-amber-50 border border-amber-200">
                        <p className="text-sm text-amber-700 mr-3">Faturamento ainda não carregado.</p>
                        <Button
                          size="xs"
                          variant="secondary"
                          icon={RefreshCw}
                          onClick={() => fetchRevenue(period.label)}
                        >
                          Buscar agora
                        </Button>
                      </div>
                    )}

                    {isLoadingRev && (
                      <div className="flex items-center justify-center gap-2 py-4 text-zinc-500">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Buscando faturamento na Stripe e AbacatePay...</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className={cn("p-3 rounded-lg border", hasRevData ? "bg-success-50 border-success-100" : "bg-zinc-50 border-zinc-200")}>
                        <p className={cn("text-[10px] font-medium uppercase tracking-wider", hasRevData ? "text-success-600" : "text-zinc-400")}>
                          Stripe (USD &rarr; BRL)
                        </p>
                        {hasRevData ? (
                          <>
                            <p className="text-lg font-bold text-success-700 mt-1">
                              {formatCurrency(period.stripeRevenueBrlCents / 100)}
                            </p>
                            <p className="text-[10px] text-success-500 mt-0.5">
                              US$ {(period.stripeRevenueUsdCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              {period.usdBrlRate > 0 && ` × R$ ${period.usdBrlRate.toFixed(2)}`}
                            </p>
                          </>
                        ) : (
                          <p className="text-lg font-bold text-zinc-300 mt-1">—</p>
                        )}
                      </div>
                      <div className={cn("p-3 rounded-lg border", hasRevData ? "bg-emerald-50 border-emerald-100" : "bg-zinc-50 border-zinc-200")}>
                        <p className={cn("text-[10px] font-medium uppercase tracking-wider", hasRevData ? "text-emerald-600" : "text-zinc-400")}>AbacatePay</p>
                        <p className={cn("text-lg font-bold mt-1", hasRevData ? "text-emerald-700" : "text-zinc-300")}>
                          {hasRevData ? formatCurrency(period.abacateRevenueCents / 100) : "—"}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-warning-50 border border-warning-100">
                        <p className="text-[10px] font-medium text-warning-600 uppercase tracking-wider">
                          Afiliados {hasRevData && totalRevenue > 0 ? `(${affiliatePercent}%)` : ""}
                        </p>
                        <p className="text-lg font-bold text-warning-700 mt-1">
                          {formatCurrency(period.affiliateCostCents / 100)}
                        </p>
                      </div>
                    </div>

                    {hasRevData && !isLoadingRev && (
                      <div className="flex justify-end">
                        <Button size="xs" variant="ghost" icon={RefreshCw} onClick={() => fetchRevenue(period.label)}>
                          {isCurrent ? "Atualizar faturamento" : "Recalcular faturamento"}
                        </Button>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-zinc-700">Custos manuais</h4>
                        <Button
                          size="xs" variant="secondary" icon={Plus}
                          onClick={() => {
                            setAddingTo(addingTo === period.label ? null : period.label);
                            setNewDescription(""); setNewAmount("");
                          }}
                        >
                          Adicionar
                        </Button>
                      </div>

                      {addingTo === period.label && (() => {
                        const isTax = newCategory === "Impostos";
                        const taxBase = period.abacateRevenueCents;
                        const taxPreview = isTax && newAmount ? Math.round(taxBase * parseFloat(newAmount || "0") / 100) : 0;
                        const canSaveTax = isTax && taxBase > 0;

                        return (
                          <div className="p-3 mb-3 border border-zinc-200 rounded-lg bg-zinc-50 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Select
                                value={newCategory}
                                onChange={(e) => { setNewCategory(e.target.value); setNewAmount(""); setNewDescription(""); }}
                                options={COST_CATEGORIES.map((c) => ({ value: c, label: c }))}
                              />
                              {isTax ? (
                                <div className="sm:col-span-2 space-y-1">
                                  <Input
                                    placeholder="Alíquota (%)"
                                    type="number"
                                    step="0.01"
                                    value={newAmount}
                                    onChange={(e) => setNewAmount(e.target.value)}
                                  />
                                  {!hasRevData && (
                                    <p className="text-[11px] text-amber-600">Carregue o faturamento primeiro para calcular impostos</p>
                                  )}
                                  {hasRevData && taxBase === 0 && (
                                    <p className="text-[11px] text-zinc-400">Nenhum saque AbacatePay neste período</p>
                                  )}
                                  {taxPreview > 0 && (
                                    <p className="text-[11px] text-zinc-500">
                                      {newAmount}% sobre {formatCurrency(taxBase / 100)} = <span className="font-semibold text-error-600">{formatCurrency(taxPreview / 100)}</span>
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <>
                                  <Input placeholder="Descrição (opcional)" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
                                  <Input placeholder="Valor (R$)" type="number" step="0.01" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
                                </>
                              )}
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button size="xs" variant="ghost" onClick={() => setAddingTo(null)}>Cancelar</Button>
                              <Button
                                size="xs"
                                loading={saving}
                                onClick={() => handleAddCost(period.label)}
                                disabled={!newAmount || parseFloat(newAmount) <= 0 || (isTax && !canSaveTax)}
                              >
                                Salvar
                              </Button>
                            </div>
                          </div>
                        );
                      })()}

                      {period.manualCosts.length === 0 && addingTo !== period.label ? (
                        <p className="text-xs text-zinc-400 py-2">Nenhum custo manual neste período</p>
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
                                <TableCell><Badge variant="default" size="sm">{cost.category}</Badge></TableCell>
                                <TableCell className="text-sm text-zinc-600">{cost.description || "—"}</TableCell>
                                <TableCell className="text-right text-sm font-medium text-error-600">{formatCurrency(cost.amount_cents / 100)}</TableCell>
                                <TableCell>
                                  <button
                                    onClick={() => handleDeleteCost(cost.id)}
                                    disabled={deleting === cost.id}
                                    className="p-1 rounded hover:bg-error-50 text-zinc-400 hover:text-error-600 transition-colors disabled:opacity-50"
                                  >
                                    {deleting === cost.id ? <X className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
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
                            Total custos manuais: <span className="font-semibold text-error-600">{formatCurrency(period.manualCostsTotalCents / 100)}</span>
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="p-3 rounded-lg bg-zinc-900 text-white">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-[10px] text-zinc-400 uppercase">Faturamento</p>
                          <p className={cn("text-base font-bold mt-0.5", hasRevData ? "text-success-400" : "text-zinc-500")}>
                            {hasRevData ? formatCurrency(totalRevenue / 100) : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-400 uppercase">Afiliados</p>
                          <p className="text-base font-bold text-warning-400 mt-0.5">-{formatCurrency(period.affiliateCostCents / 100)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-400 uppercase">Outros custos</p>
                          <p className="text-base font-bold text-error-400 mt-0.5">-{formatCurrency(period.manualCostsTotalCents / 100)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-400 uppercase">Lucro</p>
                          <p className={cn("text-base font-bold mt-0.5", !hasRevData ? "text-zinc-500" : profit >= 0 ? "text-white" : "text-error-400")}>
                            {hasRevData ? formatCurrency(profit / 100) : "—"}
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
