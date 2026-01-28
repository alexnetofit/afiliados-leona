"use client";

import { useState, useMemo } from "react";
import { useUser, useAffiliateData } from "@/hooks";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingScreen } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatDateTime, isDateAvailable } from "@/lib/utils";

export default function VendasPage() {
  const { affiliate, isLoading: userLoading } = useUser();
  const { transactions, summary, isLoading: dataLoading } = useAffiliateData(affiliate?.id);
  const [typeFilter, setTypeFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");

  const isLoading = userLoading || dataLoading;

  // Generate month options
  const monthOptions = useMemo(() => {
    const options = [{ value: "all", label: "Todos os meses" }];
    const months = new Set<string>();
    
    transactions?.forEach((t) => {
      if (t.paid_at) {
        const date = new Date(t.paid_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        months.add(key);
      }
    });

    Array.from(months)
      .sort()
      .reverse()
      .forEach((key) => {
        const [year, month] = key.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1);
        options.push({
          value: key,
          label: date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
        });
      });

    return options;
  }, [transactions]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return (transactions || []).filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      
      if (monthFilter !== "all" && t.paid_at) {
        const date = new Date(t.paid_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (key !== monthFilter) return false;
      }
      
      return true;
    });
  }, [transactions, typeFilter, monthFilter]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen">
      <Header title="Minhas Vendas" subtitle="Acompanhe suas comissões e transações" />

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">Total em Comissões</p>
                  <p className="text-2xl font-bold text-text-primary mt-1">
                    {formatCurrency(
                      (transactions || [])
                        .filter((t) => t.type === "commission")
                        .reduce((sum, t) => sum + t.commission_amount_cents, 0)
                    )}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-success-light flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">Estornos</p>
                  <p className="text-2xl font-bold text-text-primary mt-1">
                    {formatCurrency(
                      Math.abs(
                        (transactions || [])
                          .filter((t) => t.type === "refund" || t.type === "dispute")
                          .reduce((sum, t) => sum + t.commission_amount_cents, 0)
                      )
                    )}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-error-light flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-error" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-secondary">Saldo Líquido</p>
                  <p className="text-2xl font-bold text-text-primary mt-1">
                    {formatCurrency(
                      (summary?.pending_cents || 0) + (summary?.available_cents || 0)
                    )}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary-lightest flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>Transações</CardTitle>
              <div className="flex gap-3">
                <Select
                  options={[
                    { value: "all", label: "Todos os tipos" },
                    { value: "commission", label: "Comissões" },
                    { value: "refund", label: "Estornos" },
                    { value: "dispute", label: "Disputas" },
                  ]}
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-40"
                />
                <Select
                  options={monthOptions}
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="w-48"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length === 0 ? (
              <EmptyState
                icon={DollarSign}
                title="Nenhuma transação encontrada"
                description="Quando você fizer vendas, elas aparecerão aqui"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor Bruto</TableHead>
                    <TableHead>Comissão (%)</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => {
                    const isNegative = transaction.commission_amount_cents < 0;
                    const available = transaction.available_at
                      ? isDateAvailable(transaction.available_at)
                      : false;

                    return (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-medium">
                          {transaction.paid_at
                            ? formatDateTime(transaction.paid_at)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              transaction.type === "commission"
                                ? "success"
                                : transaction.type === "refund"
                                ? "error"
                                : "warning"
                            }
                          >
                            {transaction.type === "commission"
                              ? "Comissão"
                              : transaction.type === "refund"
                              ? "Estorno"
                              : "Disputa"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={isNegative ? "text-error" : ""}>
                            {formatCurrency(transaction.amount_gross_cents)}
                          </span>
                        </TableCell>
                        <TableCell>{transaction.commission_percent}%</TableCell>
                        <TableCell>
                          <span
                            className={`font-semibold ${
                              isNegative ? "text-error" : "text-success"
                            }`}
                          >
                            {formatCurrency(transaction.commission_amount_cents)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {isNegative ? (
                            <Badge variant="error">Debitado</Badge>
                          ) : available ? (
                            <Badge variant="success">Disponível</Badge>
                          ) : (
                            <Badge variant="warning">Pendente</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
