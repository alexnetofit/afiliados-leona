"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Button, Badge, Select, Checkbox, LoadingScreen, EmptyState, MetricCard, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/index";
import { Download, CheckCircle, Wallet, RefreshCw, Users } from "lucide-react";
import { formatCurrency, formatMonth, getStatusLabel, cn } from "@/lib/utils";

interface PayoutWithAffiliate {
  id: string;
  month: string;
  total_commission_cents: number;
  total_negative_cents: number;
  total_payable_cents: number;
  status: string;
  paid_at: string | null;
  affiliate: {
    affiliate_code: string;
    payout_pix_key: string | null;
    payout_wise_details: Record<string, unknown> | null;
    profile: { full_name: string | null };
    email: string;
  };
}

export default function PagamentosPage() {
  const [payouts, setPayouts] = useState<PayoutWithAffiliate[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const supabase = createClient();

  const monthOptions = useMemo(() => {
    const options = [{ value: "", label: "Selecione um mês" }];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = date.toISOString().split("T")[0];
      options.push({ value, label: formatMonth(date) });
    }
    return options;
  }, []);

  useEffect(() => {
    if (selectedMonth) fetchPayouts();
  }, [selectedMonth, statusFilter]);

  async function fetchPayouts() {
    setIsLoading(true);
    try {
      let query = supabase.from("monthly_payouts").select("id, month, total_commission_cents, total_negative_cents, total_payable_cents, status, paid_at, affiliate_id").eq("month", selectedMonth);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data: payoutsData } = await query;
      if (!payoutsData) { setPayouts([]); return; }

      type PayoutRecord = { id: string; month: string; total_commission_cents: number; total_negative_cents: number; total_payable_cents: number; status: string; paid_at: string | null; affiliate_id: string };

      const enrichedPayouts = await Promise.all((payoutsData as PayoutRecord[]).map(async (payout) => {
        const { data: affiliate } = await supabase.from("affiliates").select("affiliate_code, payout_pix_key, payout_wise_details, user_id").eq("id", payout.affiliate_id).single();
        const affiliateData = affiliate as { affiliate_code: string; payout_pix_key: string | null; payout_wise_details: Record<string, unknown> | null; user_id: string } | null;
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", affiliateData?.user_id || "").single();
        let userEmail = "N/A";
        try { const { data: authData } = await supabase.auth.admin.getUserById(affiliateData?.user_id || ""); userEmail = authData?.user?.email || "N/A"; } catch { userEmail = "N/A"; }

        return { ...payout, affiliate: { affiliate_code: affiliateData?.affiliate_code || "", payout_pix_key: affiliateData?.payout_pix_key || null, payout_wise_details: affiliateData?.payout_wise_details || null, profile: (profile as { full_name: string | null } | null) || { full_name: null }, email: userEmail } };
      }));

      setPayouts(enrichedPayouts);
    } catch (error) { console.error("Error fetching payouts:", error); } finally { setIsLoading(false); }
  }

  async function generatePayouts() {
    if (!selectedMonth) return;
    setIsProcessing(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.rpc as any)("generate_all_monthly_payouts", { p_month: selectedMonth });
      if (error) throw error;
      await fetchPayouts();
    } catch (error) { console.error("Error generating payouts:", error); alert("Erro ao gerar pagamentos."); } finally { setIsProcessing(false); }
  }

  async function markAsPaid(ids: string[]) {
    setIsProcessing(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("monthly_payouts") as any).update({ status: "paid", paid_at: new Date().toISOString() }).in("id", ids);
      if (error) throw error;
      setSelectedIds(new Set());
      await fetchPayouts();
    } catch (error) { console.error("Error marking as paid:", error); alert("Erro ao marcar como pago"); } finally { setIsProcessing(false); }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(payouts.filter((p) => p.status === "pending").map((p) => p.id)));
    else setSelectedIds(new Set());
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) newSet.add(id); else newSet.delete(id);
    setSelectedIds(newSet);
  };

  const handleExportCSV = () => {
    const headers = ["Afiliado", "Email", "PIX", "Wise", "Total", "Status"];
    const rows = payouts.map((p) => [p.affiliate.profile.full_name || "N/A", p.affiliate.email, p.affiliate.payout_pix_key || "", p.affiliate.payout_wise_details ? JSON.stringify(p.affiliate.payout_wise_details) : "", (p.total_payable_cents / 100).toFixed(2), p.status]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pagamentos-${selectedMonth}.csv`;
    link.click();
  };

  const pendingTotal = payouts.filter((p) => p.status === "pending").reduce((sum, p) => sum + p.total_payable_cents, 0);
  const paidTotal = payouts.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.total_payable_cents, 0);

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto space-y-8 animate-fade-in-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Pagamentos</h1>
            <p className="text-zinc-500 mt-1">Gerencie os pagamentos mensais dos afiliados</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={generatePayouts} loading={isProcessing} icon={RefreshCw}>
              Gerar Payouts
            </Button>
            <Button variant="secondary" onClick={handleExportCSV} disabled={payouts.length === 0} icon={Download}>
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <Select 
            options={monthOptions} 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)} 
            className="w-56" 
          />
          <Select 
            options={[{ value: "all", label: "Todos os status" }, { value: "pending", label: "Pendente" }, { value: "paid", label: "Pago" }]} 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)} 
            className="w-40" 
          />
        </div>

        {/* Stats */}
        {selectedMonth && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <MetricCard icon={Wallet} label="Pendente" value={formatCurrency(pendingTotal / 100)} color="warning" />
            <MetricCard icon={CheckCircle} label="Pago" value={formatCurrency(paidTotal / 100)} color="success" />
            <MetricCard icon={Users} label="Afiliados" value={payouts.length.toString()} color="primary" />
          </div>
        )}

        {/* Batch Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-4 p-4 bg-primary-50 border border-primary-100 rounded-2xl">
            <span className="text-sm font-semibold text-primary-700">{selectedIds.size} selecionado(s)</span>
            <Button size="sm" onClick={() => markAsPaid(Array.from(selectedIds))} loading={isProcessing} icon={CheckCircle}>
              Marcar como Pago
            </Button>
          </div>
        )}

        {/* Table */}
        <Card noPadding>
          <div className="p-6 border-b border-zinc-100">
            <h3 className="text-lg font-bold text-zinc-900">Relatório de Pagamentos</h3>
            <p className="text-sm text-zinc-500">{selectedMonth ? formatMonth(selectedMonth) : "Selecione um mês"}</p>
          </div>

          {!selectedMonth ? (
            <EmptyState icon={Wallet} title="Selecione um mês" description="Escolha um mês para ver os pagamentos" />
          ) : isLoading ? (
            <LoadingScreen />
          ) : payouts.length === 0 ? (
            <EmptyState icon={Wallet} title="Nenhum pagamento" description="Não há pagamentos para este mês" action={{ label: "Gerar Payouts", onClick: generatePayouts }} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={payouts.filter((p) => p.status === "pending").length > 0 && selectedIds.size === payouts.filter((p) => p.status === "pending").length} 
                      onChange={(e) => handleSelectAll((e.target as HTMLInputElement).checked)} 
                    />
                  </TableHead>
                  <TableHead>Afiliado</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>PIX</TableHead>
                  <TableHead>Wise</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id} className="hover:bg-zinc-50">
                    <TableCell>
                      {payout.status === "pending" && (
                        <Checkbox 
                          checked={selectedIds.has(payout.id)} 
                          onChange={(e) => handleSelectOne(payout.id, (e.target as HTMLInputElement).checked)} 
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-zinc-100 flex items-center justify-center">
                          <span className="text-xs font-bold text-zinc-500">
                            {(payout.affiliate.profile.full_name || "?")[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-900">{payout.affiliate.profile.full_name || "N/A"}</p>
                          <code className="text-xs text-zinc-500">{payout.affiliate.affiliate_code}</code>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-600">{payout.affiliate.email}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-zinc-100 px-2 py-1 rounded">{payout.affiliate.payout_pix_key || "-"}</code>
                    </TableCell>
                    <TableCell className="text-zinc-600">{payout.affiliate.payout_wise_details ? "Sim" : "-"}</TableCell>
                    <TableCell className="text-right font-bold text-zinc-900">{formatCurrency(payout.total_payable_cents / 100)}</TableCell>
                    <TableCell>
                      <Badge variant={payout.status === "paid" ? "success" : "warning"} dot>
                        {getStatusLabel(payout.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {payout.status === "pending" && (
                        <Button variant="ghost" size="sm" onClick={() => markAsPaid([payout.id])}>
                          Pagar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
