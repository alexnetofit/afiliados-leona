"use client";

import { useState, useMemo } from "react";
import { useAppData } from "@/contexts";
import { Header } from "@/components/layout/header";
import { Card, Badge, LoadingScreen, Select, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, EmptyState, Button, Input } from "@/components/ui/index";
import { AlertTriangle, RefreshCcw, Users, UserCheck, UserX, AlertCircle, Clock, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

const STATUS_MAP = {
  trialing: { label: "Trial", variant: "info" as const, icon: Clock },
  active: { label: "Ativa", variant: "success" as const, icon: UserCheck },
  past_due: { label: "Atrasada", variant: "warning" as const, icon: AlertCircle },
  canceled: { label: "Cancelada", variant: "default" as const, icon: UserX },
  unpaid: { label: "Não paga", variant: "error" as const, icon: AlertTriangle },
};

const ITEMS_PER_PAGE = 10;

export default function AssinaturasPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, subscriptions, isLoading, isInitialized } = useAppData();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    let result = subscriptions || [];
    
    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter);
    }
    
    // Filter by search (customer name)
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter((s) => 
        s.customer_name?.toLowerCase().includes(searchLower) ||
        s.stripe_customer_id?.toLowerCase().includes(searchLower)
      );
    }
    
    return result;
  }, [subscriptions, statusFilter, search]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  // Reset page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [statusFilter, search]);

  const stats = useMemo(() => {
    const subs = subscriptions || [];
    return {
      trialing: subs.filter(s => s.status === "trialing").length,
      active: subs.filter(s => s.status === "active").length,
      canceled: subs.filter(s => s.status === "canceled").length,
      refund: subs.filter(s => s.has_refund).length,
      dispute: subs.filter(s => s.has_dispute).length,
    };
  }, [subscriptions]);

  // Only show loading on first load, not on navigation
  if (isLoading && !isInitialized) {
    return <LoadingScreen message="Carregando assinaturas..." />;
  }

  return (
    <>
      <Header
        title="Assinaturas"
        description="Clientes indicados por você"
        user={profile ? { name: profile.full_name || "" } : undefined}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 p-6 lg:p-8">
        <div className="max-w-[1400px] mx-auto space-y-8 animate-fade-in-up">
          
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: "Trial", value: stats.trialing, icon: Clock, color: "text-info-600", bg: "bg-info-100" },
              { label: "Ativas", value: stats.active, icon: UserCheck, color: "text-success-600", bg: "bg-success-100" },
              { label: "Canceladas", value: stats.canceled, icon: UserX, color: "text-zinc-500", bg: "bg-zinc-100" },
              { label: "Refunds", value: stats.refund, icon: RefreshCcw, color: "text-warning-600", bg: "bg-warning-100" },
              { label: "Disputas", value: stats.dispute, icon: AlertTriangle, color: "text-error-600", bg: "bg-error-100" },
            ].map((stat) => (
              <Card key={stat.label} hover className="!p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", stat.bg)}>
                    <stat.icon className={cn("h-5 w-5", stat.color)} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-500 uppercase">{stat.label}</p>
                    <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Table */}
          <Card noPadding>
            <div className="p-6 border-b border-zinc-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Lista de assinaturas</h3>
                  <p className="text-sm text-zinc-500">{filtered.length} assinaturas encontradas</p>
                </div>
              </div>
              
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="Pesquisar por nome do cliente..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    icon={Search}
                  />
                </div>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={[
                    { value: "all", label: "Todos os status" },
                    { value: "trialing", label: "Trial" },
                    { value: "active", label: "Ativa" },
                    { value: "past_due", label: "Atrasada" },
                    { value: "canceled", label: "Cancelada" },
                    { value: "unpaid", label: "Não paga" },
                  ]}
                  className="w-full sm:w-48"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhuma assinatura"
                description={search ? "Nenhum resultado para sua pesquisa" : "Quando seus indicados assinarem, aparecerão aqui"}
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Próxima cobrança</TableHead>
                      <TableHead>Trial</TableHead>
                      <TableHead>Flags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((sub) => {
                      const st = STATUS_MAP[sub.status as keyof typeof STATUS_MAP] || STATUS_MAP.active;
                      return (
                        <TableRow key={sub.id} className="hover:bg-zinc-50">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center">
                                <span className="text-xs font-bold text-zinc-500">
                                  {(sub.customer_name || "C")[0].toUpperCase()}
                                </span>
                              </div>
                              <span className="font-semibold text-zinc-900">{sub.customer_name || "Cliente"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={st.variant} dot>{st.label}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {sub.amount_cents ? formatCurrency(sub.amount_cents / 100) : "-"}
                          </TableCell>
                          <TableCell className="text-zinc-500">
                            {sub.started_at ? formatDate(sub.started_at) : "-"}
                          </TableCell>
                          <TableCell className="text-zinc-500">
                            {sub.current_period_end ? formatDate(sub.current_period_end) : "-"}
                          </TableCell>
                          <TableCell>
                            {sub.is_trial || sub.status === "trialing" ? (
                              <Badge variant="info" size="sm">Sim</Badge>
                            ) : (
                              <span className="text-sm text-zinc-400">Não</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {sub.has_refund && (
                                <div className="h-8 w-8 rounded-lg bg-warning-100 flex items-center justify-center" title="Refund">
                                  <RefreshCcw className="h-4 w-4 text-warning-600" />
                                </div>
                              )}
                              {sub.has_dispute && (
                                <div className="h-8 w-8 rounded-lg bg-error-100 flex items-center justify-center" title="Disputa">
                                  <AlertTriangle className="h-4 w-4 text-error-600" />
                                </div>
                              )}
                              {!sub.has_refund && !sub.has_dispute && (
                                <span className="text-sm text-zinc-400">-</span>
                              )}
                            </div>
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
