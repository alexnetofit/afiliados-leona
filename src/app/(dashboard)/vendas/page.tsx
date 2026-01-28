"use client";

import { useState, useMemo } from "react";
import { useAppData } from "@/contexts";
import { Header } from "@/components/layout/header";
import { Card, Badge, MetricCard, LoadingScreen, Select, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState, Button, Input } from "@/components/ui/index";
import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Receipt, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency, formatDateTime, isDateAvailable, cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 10;

export default function VendasPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, transactions, summary, isLoading, isInitialized } = useAppData();
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    let result = transactions || [];
    
    // Filter by type
    if (typeFilter !== "all") {
      result = result.filter((t) => t.type === typeFilter);
    }
    
    // Filter by search (description, date)
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter((t) => 
        t.description?.toLowerCase().includes(searchLower) ||
        t.paid_at?.toLowerCase().includes(searchLower) ||
        formatCurrency(Math.abs(t.commission_amount_cents) / 100).includes(search)
      );
    }
    
    return result;
  }, [transactions, typeFilter, search]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  // Reset page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [typeFilter, search]);

  const totalComm = (transactions || []).filter(t => t.type === "commission").reduce((s, t) => s + t.commission_amount_cents, 0);
  const totalRef = Math.abs((transactions || []).filter(t => t.type === "refund" || t.type === "dispute").reduce((s, t) => s + t.commission_amount_cents, 0));

  // Only show loading on first load, not on navigation
  if (isLoading && !isInitialized) {
    return <LoadingScreen message="Carregando vendas..." />;
  }

  return (
    <>
      <Header
        title="Vendas"
        description="Histórico de comissões e transações"
        user={profile ? { name: profile.full_name || "" } : undefined}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 p-6 lg:p-8">
        <div className="max-w-[1400px] mx-auto space-y-8 animate-fade-in-up">
          
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <MetricCard
              icon={TrendingUp}
              label="Total em comissões"
              value={formatCurrency(totalComm / 100)}
              color="success"
            />
            <MetricCard
              icon={TrendingDown}
              label="Estornos e disputas"
              value={formatCurrency(totalRef / 100)}
              color="error"
            />
            <MetricCard
              icon={DollarSign}
              label="Saldo líquido"
              value={formatCurrency(((summary?.pending_cents || 0) + (summary?.available_cents || 0)) / 100)}
              color="primary"
            />
          </div>

          {/* Table */}
          <Card noPadding>
            <div className="p-6 border-b border-zinc-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Transações</h3>
                  <p className="text-sm text-zinc-500">{filtered.length} transações encontradas</p>
                </div>
              </div>
              
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="Pesquisar por valor, data..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    icon={Search}
                  />
                </div>
                <Select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  options={[
                    { value: "all", label: "Todos os tipos" },
                    { value: "commission", label: "Comissões" },
                    { value: "refund", label: "Estornos" },
                    { value: "dispute", label: "Disputas" },
                  ]}
                  className="w-full sm:w-48"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Nenhuma transação"
                description={search ? "Nenhum resultado para sua pesquisa" : "Suas transações aparecerão aqui quando você começar a vender"}
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor bruto</TableHead>
                      <TableHead>Comissão</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((tx) => {
                      const neg = tx.commission_amount_cents < 0;
                      const avail = tx.available_at ? isDateAvailable(tx.available_at) : false;
                      return (
                        <TableRow key={tx.id} className="hover:bg-zinc-50">
                          <TableCell className="font-medium">
                            {tx.paid_at ? formatDateTime(tx.paid_at) : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={tx.type === "commission" ? "success" : tx.type === "refund" ? "error" : "warning"}
                              dot
                            >
                              {tx.type === "commission" ? "Comissão" : tx.type === "refund" ? "Estorno" : "Disputa"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-zinc-500">
                            {formatCurrency(Math.abs(tx.amount_gross_cents) / 100)}
                          </TableCell>
                          <TableCell className="text-zinc-500">
                            {tx.commission_percent}%
                          </TableCell>
                          <TableCell>
                            <div className={cn(
                              "inline-flex items-center gap-1 font-semibold",
                              neg ? "text-error-600" : "text-success-600"
                            )}>
                              {neg ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                              {neg ? "-" : "+"}{formatCurrency(Math.abs(tx.commission_amount_cents) / 100)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {neg ? (
                              <Badge variant="error" size="sm">Debitado</Badge>
                            ) : avail ? (
                              <Badge variant="success" size="sm">Disponível</Badge>
                            ) : (
                              <Badge variant="warning" size="sm">Pendente</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100">
                    <p className="text-sm text-zinc-500">
                      Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        icon={ChevronLeft}
                      >
                        Anterior
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={cn(
                                "h-8 w-8 rounded-lg text-sm font-medium transition-colors",
                                currentPage === pageNum
                                  ? "bg-primary-600 text-white"
                                  : "text-zinc-600 hover:bg-zinc-100"
                              )}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        icon={ChevronRight}
                        iconPosition="right"
                      >
                        Próximo
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
