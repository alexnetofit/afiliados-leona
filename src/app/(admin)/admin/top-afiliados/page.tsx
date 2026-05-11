"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Card, LoadingScreen, Badge, Button, Input,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/index";
import {
  DollarSign, TrendingUp, Clock, CreditCard, RefreshCw, Star,
  ArrowDownRight, ArrowUpRight, Plus, Trash2,
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

interface WiseTx {
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: string;
  runningBalance: number;
}

interface Transaction {
  id: string;
  type: string;
  amount_gross_cents: number;
  commission_percent: number;
  commission_amount_cents: number;
  paid_at: string | null;
  available_at: string | null;
  description: string | null;
}

interface PixExpense {
  id: string;
  amount_brl_cents: number;
  paid_at: string;
  description: string | null;
}

interface TopAffiliateData {
  affiliate: {
    name: string;
    email: string;
    code: string;
    tier: number;
    salesCount: number;
  };
  commission: {
    grossCents: number;
    refundCents: number;
    totalCents: number;
    releasedCents: number;
    pendingCents: number;
  };
  wise: {
    totalSpentCents: number;
    transactions: WiseTx[];
  } | null;
  wiseConfigured: boolean;
  pixExpenses: PixExpense[];
  pixTotalBrlCents: number;
  transactions: Transaction[];
}

export default function TopAfiliadosPage() {
  const [data, setData] = useState<TopAffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [wiseLoading, setWiseLoading] = useState(false);
  const [error, setError] = useState("");
  const [usdRate, setUsdRate] = useState(0);
  const didInit = useRef(false);

  const todayBrt = () =>
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  const [pixFormOpen, setPixFormOpen] = useState(false);
  const [pixAmount, setPixAmount] = useState("");
  const [pixDate, setPixDate] = useState(todayBrt());
  const [pixDescription, setPixDescription] = useState("");
  const [pixSubmitting, setPixSubmitting] = useState(false);
  const [pixError, setPixError] = useState("");

  const fetchUsdRate = useCallback(async () => {
    try {
      const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
      if (res.ok) {
        const json = await res.json();
        setUsdRate(parseFloat(json.USDBRL?.ask || "0"));
      }
    } catch { /* silently fail */ }
  }, []);

  const fetchData = useCallback(async (withWise = false) => {
    try {
      const url = `/api/admin/top-affiliates${withWise ? "?wise=true" : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erro ao carregar dados");
      const json = await res.json();
      setData(json);
    } catch {
      setError("Erro ao carregar dados do afiliado");
    }
  }, []);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    setLoading(true);
    Promise.all([fetchData(true), fetchUsdRate()]).finally(() => setLoading(false));
  }, [fetchData, fetchUsdRate]);

  const handleRefreshWise = async () => {
    setWiseLoading(true);
    await fetchData(true);
    setWiseLoading(false);
  };

  const resetPixForm = () => {
    setPixAmount("");
    setPixDate(todayBrt());
    setPixDescription("");
    setPixError("");
  };

  const handleAddPix = async (e: React.FormEvent) => {
    e.preventDefault();
    setPixError("");

    const parsed = Number(pixAmount.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setPixError("Informe um valor em BRL maior que zero");
      return;
    }
    const cents = Math.round(parsed * 100);

    setPixSubmitting(true);
    try {
      const res = await fetch("/api/admin/top-affiliates/pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_brl_cents: cents,
          paid_at: new Date(`${pixDate}T12:00:00-03:00`).toISOString(),
          description: pixDescription.trim() || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Erro ao salvar Pix");
      }
      await fetchData(true);
      resetPixForm();
      setPixFormOpen(false);
    } catch (err) {
      setPixError(err instanceof Error ? err.message : "Erro ao salvar Pix");
    } finally {
      setPixSubmitting(false);
    }
  };

  const handleDeletePix = async (id: string) => {
    if (!confirm("Remover este lançamento de Pix?")) return;
    try {
      const res = await fetch(`/api/admin/top-affiliates/pix?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro ao remover");
      await fetchData(true);
    } catch {
      alert("Não foi possível remover o lançamento.");
    }
  };

  if (loading) return <LoadingScreen message="Carregando Top Afiliados..." />;
  if (error || !data) {
    return (
      <div className="flex-1 p-6 lg:p-8">
        <div className="max-w-5xl mx-auto text-center py-20 text-zinc-500">
          {error || "Dados não encontrados"}
        </div>
      </div>
    );
  }

  const { affiliate, commission, wise, wiseConfigured, pixExpenses, pixTotalBrlCents, transactions } = data;
  const tierName = affiliate.tier === 3 ? "Ouro" : affiliate.tier === 2 ? "Prata" : "Bronze";
  const wiseUsdCents = wise?.totalSpentCents || 0;
  const pixUsdCents = usdRate > 0 ? Math.round(pixTotalBrlCents / usdRate) : 0;
  const usedCents = wiseUsdCents + pixUsdCents;
  const releasedUsdCents = usdRate > 0 ? Math.round(commission.releasedCents / usdRate) : 0;
  const availableCents = releasedUsdCents - usedCents;

  const wiseTxs = wise?.transactions || [];

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
              <Star className="h-7 w-7 text-amber-500" />
              Top Afiliados
            </h1>
            <p className="text-zinc-500 mt-1">
              Acompanhamento de comissões e gastos
            </p>
          </div>
        </div>

        {/* Affiliate Info */}
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-lg">
              {affiliate.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-zinc-900">
                {affiliate.name}
              </h2>
              <p className="text-sm text-zinc-500">{affiliate.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="default" size="sm">
                {tierName} · {affiliate.tier === 3 ? 40 : affiliate.tier === 2 ? 35 : 30}%
              </Badge>
              <Badge variant="success" size="sm">
                {affiliate.salesCount} vendas
              </Badge>
            </div>
          </div>
        </Card>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-purple-600" />
              </div>
              <p className="text-sm font-medium text-zinc-500">Comissão Total</p>
            </div>
            <p className="text-2xl font-bold text-zinc-900">
              {formatCurrency(commission.totalCents / 100)}
            </p>
            {commission.refundCents > 0 && (
              <p className="text-xs text-zinc-400 mt-1">
                Bruto {formatCurrency(commission.grossCents / 100)} − {formatCurrency(commission.refundCents / 100)} estornos
              </p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-sm font-medium text-zinc-500">Liberado</p>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(commission.releasedCents / 100)}
            </p>
            {usdRate > 0 && (
              <p className="text-xs text-zinc-400 mt-1">
                ≈ {formatCurrency(releasedUsdCents / 100, "USD")} (câmbio {usdRate.toFixed(2)})
              </p>
            )}
            {commission.pendingCents > 0 && (
              <p className="text-xs text-zinc-400 mt-0.5">
                + {formatCurrency(commission.pendingCents / 100)} pendente
              </p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex items-center gap-2 flex-1">
                <p className="text-sm font-medium text-zinc-500">Usado (Wise + Pix)</p>
                <button
                  onClick={handleRefreshWise}
                  disabled={wiseLoading}
                  className="p-1 rounded hover:bg-zinc-100 transition-colors"
                  title="Atualizar gastos Wise"
                >
                  <RefreshCw
                    className={cn("h-3.5 w-3.5 text-zinc-400", wiseLoading && "animate-spin")}
                  />
                </button>
              </div>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {wise ? formatCurrency(usedCents / 100, "USD") : "—"}
            </p>
            {wise && (
              <div className="mt-1 space-y-0.5">
                <p className="text-xs text-zinc-400">
                  Wise {formatCurrency(wiseUsdCents / 100, "USD")}
                </p>
                {pixTotalBrlCents > 0 && (
                  <p className="text-xs text-zinc-400">
                    Pix {formatCurrency(pixTotalBrlCents / 100)}
                    {usdRate > 0 && ` (≈ ${formatCurrency(pixUsdCents / 100, "USD")})`}
                  </p>
                )}
              </div>
            )}
            {!wiseConfigured && (
              <p className="text-xs text-amber-500 mt-1">Wise não configurada</p>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-sm font-medium text-zinc-500">Saldo Disponível</p>
            </div>
            <p className={cn("text-2xl font-bold", availableCents > 0 ? "text-blue-600" : availableCents < 0 ? "text-red-600" : "text-zinc-400")}>
              {wise
                ? `${availableCents < 0 ? "−" : ""}${formatCurrency(Math.abs(availableCents) / 100, "USD")}`
                : "—"}
            </p>
            <p className="text-xs text-zinc-400 mt-1">Liberado − Usado (em USD)</p>
          </Card>
        </div>

        {/* Pix Expenses (lançamento manual — vem ANTES do Wise pra ficar à mão) */}
        <Card noPadding>
          <div className="p-5 border-b border-zinc-100 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-500" />
                Gastos via Pix
              </h3>
              <p className="text-sm text-zinc-500 mt-0.5">
                {pixExpenses.length} lançamento{pixExpenses.length === 1 ? "" : "s"}
                {pixTotalBrlCents > 0 &&
                  ` · Total ${formatCurrency(pixTotalBrlCents / 100)}`}
              </p>
            </div>
            <Button
              size="sm"
              variant={pixFormOpen ? "secondary" : "primary"}
              onClick={() => {
                setPixFormOpen((v) => !v);
                setPixError("");
              }}
              icon={Plus}
            >
              {pixFormOpen ? "Cancelar" : "Adicionar Pix"}
            </Button>
          </div>

          {pixFormOpen && (
            <form
              onSubmit={handleAddPix}
              className="p-5 border-b border-zinc-100 bg-zinc-50/60 grid grid-cols-1 md:grid-cols-4 gap-3"
            >
              <Input
                label="Valor (R$)"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={pixAmount}
                onChange={(e) => setPixAmount(e.target.value)}
                disabled={pixSubmitting}
                required
              />
              <Input
                label="Data"
                type="date"
                value={pixDate}
                onChange={(e) => setPixDate(e.target.value)}
                disabled={pixSubmitting}
                required
              />
              <Input
                label="Descrição (opcional)"
                type="text"
                placeholder="Ex: Pix semanal"
                value={pixDescription}
                onChange={(e) => setPixDescription(e.target.value)}
                disabled={pixSubmitting}
              />
              <div className="flex items-end">
                <Button
                  type="submit"
                  size="sm"
                  className="w-full"
                  loading={pixSubmitting}
                >
                  Salvar
                </Button>
              </div>
              {pixError && (
                <p className="md:col-span-4 text-xs text-red-600">{pixError}</p>
              )}
            </form>
          )}

          {pixExpenses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pixExpenses.map((p) => (
                  <TableRow key={p.id} className="hover:bg-zinc-50">
                    <TableCell className="text-sm text-zinc-600">
                      {new Date(p.paid_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        timeZone: "America/Sao_Paulo",
                      })}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-900">
                      {p.description || "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-red-600">
                      {formatCurrency(p.amount_brl_cents / 100)}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => handleDeletePix(p.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-zinc-400 hover:text-red-600 transition-colors"
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            !pixFormOpen && (
              <div className="p-8 text-center text-sm text-zinc-500">
                Nenhum gasto Pix registrado. Clique em &quot;Adicionar Pix&quot; para começar.
              </div>
            )
          )}
        </Card>

        {/* Wise Transactions (automático — vem depois do Pix manual) */}
        {wise && wiseTxs.length > 0 && (
          <Card noPadding>
            <div className="p-5 border-b border-zinc-100">
              <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-red-500" />
                Gastos no Cartão Wise
              </h3>
              <p className="text-sm text-zinc-500 mt-0.5">
                Cartão ****1421 · {wiseTxs.length} transações
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wiseTxs.map((tx, i) => (
                  <TableRow key={i} className="hover:bg-zinc-50">
                    <TableCell className="text-sm text-zinc-600">
                      {tx.date
                        ? new Date(tx.date).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            timeZone: "America/Sao_Paulo",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-900 font-medium">
                      {tx.description}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-red-600">
                      {formatCurrency(Math.abs(tx.amount), "USD")}
                    </TableCell>
                    <TableCell className="text-right text-sm text-zinc-500">
                      {formatCurrency(tx.runningBalance, "USD")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Commission Transactions */}
        <Card noPadding>
          <div className="p-5 border-b border-zinc-100">
            <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-500" />
              Comissões
            </h3>
            <p className="text-sm text-zinc-500 mt-0.5">
              {transactions.length} transações
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead>Liberação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => {
                const isRefund = tx.type === "refund" || tx.type === "dispute";
                return (
                  <TableRow key={tx.id} className="hover:bg-zinc-50">
                    <TableCell className="text-sm text-zinc-600">
                      {tx.paid_at
                        ? new Date(tx.paid_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            timeZone: "America/Sao_Paulo",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {isRefund ? (
                          <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
                        )}
                        <Badge
                          variant={isRefund ? "default" : "success"}
                          size="sm"
                        >
                          {tx.type === "commission"
                            ? "Comissão"
                            : tx.type === "refund"
                            ? "Estorno"
                            : "Disputa"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-zinc-600">
                      {tx.description || "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-zinc-600">
                      {formatCurrency(Math.abs(tx.amount_gross_cents) / 100)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-zinc-500">
                      {tx.commission_percent}%
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right text-sm font-semibold",
                        isRefund ? "text-red-600" : "text-green-600"
                      )}
                    >
                      {isRefund ? "−" : "+"}
                      {formatCurrency(
                        Math.abs(tx.commission_amount_cents) / 100
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-zinc-500">
                      {tx.available_at
                        ? new Date(tx.available_at).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            timeZone: "America/Sao_Paulo",
                          })
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
