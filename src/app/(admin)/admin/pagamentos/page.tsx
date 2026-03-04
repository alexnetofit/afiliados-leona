"use client";

import { useEffect, useState, useMemo } from "react";
import { Badge, Button, Card, EmptyState, LoadingScreen, Select, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/index";
import { ArrowUpRight, CheckCircle, ChevronLeft, ChevronRight, Search, Undo2 } from "lucide-react";

interface WithdrawRequest {
  id: string;
  affiliate_name: string | null;
  affiliate_email: string | null;
  amount_text: string;
  date_label: string | null;
  pix_key: string | null;
  wise_email: string | null;
  status: "pending" | "paid" | "rejected";
  paid_at: string | null;
  created_at: string;
}

const PAGE_SIZE = 10;

export default function PagamentosPage() {
  const [withdrawRequests, setWithdrawRequests] = useState<WithdrawRequest[]>([]);
  const [loadingWithdraws, setLoadingWithdraws] = useState(true);
  const [updatingWithdrawId, setUpdatingWithdrawId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchWithdrawRequests();
  }, []);

  async function fetchWithdrawRequests() {
    try {
      const res = await fetch("/api/admin/withdraw-requests");
      const data = await res.json();
      if (res.ok) setWithdrawRequests(data.requests || []);
    } catch {
      // silently fail
    } finally {
      setLoadingWithdraws(false);
    }
  }

  async function updateWithdrawStatus(id: string, newStatus: "paid" | "pending") {
    setUpdatingWithdrawId(id);
    try {
      const res = await fetch("/api/admin/withdraw-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        const paidAt = newStatus === "paid" ? new Date().toISOString() : null;
        setWithdrawRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: newStatus, paid_at: paidAt } : r))
        );

        if (newStatus === "paid") {
          const req = withdrawRequests.find((r) => r.id === id);
          if (req?.affiliate_email) {
            await fetch("/api/admin/notify-paid", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                affiliateName: req.affiliate_name,
                affiliateEmail: req.affiliate_email,
                amount: req.amount_text,
                dateLabel: req.date_label,
              }),
            });
          }
        }
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao atualizar status");
      }
    } catch {
      alert("Erro ao atualizar status");
    } finally {
      setUpdatingWithdrawId(null);
    }
  }

  const filtered = useMemo(() => {
    let list = withdrawRequests;

    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) =>
        (r.affiliate_name || "").toLowerCase().includes(q) ||
        (r.affiliate_email || "").toLowerCase().includes(q) ||
        (r.amount_text || "").toLowerCase().includes(q) ||
        (r.date_label || "").toLowerCase().includes(q) ||
        (r.pix_key || "").toLowerCase().includes(q) ||
        (r.wise_email || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [withdrawRequests, statusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const pendingCount = withdrawRequests.filter((w) => w.status === "pending").length;

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto space-y-8 animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Pagamentos</h1>
          <p className="text-zinc-500 mt-1">Gerencie as solicitações de saque dos afiliados</p>
        </div>

        <Card noPadding>
          <div className="p-6 border-b border-zinc-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                  <ArrowUpRight className="h-5 w-5 text-purple-600" />
                  Solicitações de Saque
                </h3>
                <p className="text-sm text-zinc-500">
                  {pendingCount} pendente(s) de {withdrawRequests.length} total
                </p>
              </div>
              {pendingCount > 0 && (
                <Badge variant="warning" size="sm">{pendingCount} pendente(s)</Badge>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <div className="relative flex-1 sm:min-w-[400px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome, email, valor, liberação..."
                  className="w-full pl-9 pr-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 transition-all"
                />
              </div>
              <Select
                options={[
                  { value: "all", label: "Todos" },
                  { value: "pending", label: "Pendentes" },
                  { value: "paid", label: "Pagos" },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-40"
              />
            </div>
          </div>

          {loadingWithdraws ? (
            <div className="p-8 text-center text-sm text-zinc-400">Carregando...</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ArrowUpRight}
              title={searchQuery || statusFilter !== "all" ? "Nenhum resultado" : "Nenhuma solicitação"}
              description={searchQuery || statusFilter !== "all" ? "Tente ajustar os filtros" : "As solicitações de saque dos afiliados aparecerão aqui"}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Afiliado</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Liberação</TableHead>
                    <TableHead>PIX</TableHead>
                    <TableHead>Wise</TableHead>
                    <TableHead>Solicitado em</TableHead>
                    <TableHead>Pago em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((req) => (
                    <TableRow key={req.id} className="hover:bg-zinc-50">
                      <TableCell>
                        <div>
                          <p className="font-semibold text-zinc-900">{req.affiliate_name || "N/A"}</p>
                          <p className="text-xs text-zinc-500">{req.affiliate_email || ""}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-zinc-900">{req.amount_text}</TableCell>
                      <TableCell className="text-zinc-600">{req.date_label || "-"}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-zinc-100 px-2 py-1 rounded">{req.pix_key || "-"}</code>
                      </TableCell>
                      <TableCell className="text-zinc-600">{req.wise_email || "-"}</TableCell>
                      <TableCell className="text-zinc-500 text-sm">
                        {new Date(req.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                          timeZone: "America/Sao_Paulo",
                        })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {req.paid_at ? (
                          <span className="text-emerald-600 font-medium">
                            {new Date(req.paid_at).toLocaleDateString("pt-BR", {
                              day: "2-digit", month: "2-digit", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                              timeZone: "America/Sao_Paulo",
                            })}
                          </span>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={req.status === "paid" ? "success" : req.status === "rejected" ? "default" : "warning"}
                          dot
                        >
                          {req.status === "paid" ? "Pago" : req.status === "rejected" ? "Rejeitado" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {req.status === "pending" ? (
                          <Button
                            size="sm"
                            onClick={() => updateWithdrawStatus(req.id, "paid")}
                            loading={updatingWithdrawId === req.id}
                            icon={CheckCircle}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            Pago
                          </Button>
                        ) : req.status === "paid" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateWithdrawStatus(req.id, "pending")}
                            loading={updatingWithdrawId === req.id}
                            icon={Undo2}
                          >
                            Voltar Pendente
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100">
                  <p className="text-sm text-zinc-500">
                    {filtered.length} resultado(s) &middot; Página {safePage} de {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      Próximo
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
