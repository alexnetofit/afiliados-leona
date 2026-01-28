"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Button, Badge, Select, Checkbox, LoadingScreen, EmptyState, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/index";
import { Download, CheckCircle, Wallet, RefreshCw } from "lucide-react";
import { formatCurrency, formatMonth, getStatusColor, getStatusLabel } from "@/lib/utils";

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
  const [isLoading, setIsLoading] = useState(true);
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

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-[1320px] mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#111827]">Pagamentos</h1>
          <p className="text-[#6B7280]">Gerencie os pagamentos mensais</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-3">
            <Select options={monthOptions} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-48" />
            <Select options={[{ value: "all", label: "Todos" }, { value: "pending", label: "Pendente" }, { value: "paid", label: "Pago" }]} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40" />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={generatePayouts} loading={isProcessing} icon={RefreshCw}>Gerar Payouts</Button>
            <Button variant="secondary" onClick={handleExportCSV} disabled={payouts.length === 0} icon={Download}>CSV</Button>
          </div>
        </div>

        {/* Summary */}
        {selectedMonth && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-[#FEF3C7] flex items-center justify-center"><Wallet className="h-5 w-5 text-[#D97706]" /></div>
              <div><p className="text-sm text-[#6B7280]">Pendente</p><p className="text-xl font-semibold text-[#D97706]">{formatCurrency(pendingTotal / 100)}</p></div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-[#D1FAE5] flex items-center justify-center"><CheckCircle className="h-5 w-5 text-[#059669]" /></div>
              <div><p className="text-sm text-[#6B7280]">Pago</p><p className="text-xl font-semibold text-[#059669]">{formatCurrency(payouts.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.total_payable_cents, 0) / 100)}</p></div>
            </Card>
            <Card className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-[#EDE9FE] flex items-center justify-center"><Wallet className="h-5 w-5 text-[#5B21B6]" /></div>
              <div><p className="text-sm text-[#6B7280]">Afiliados</p><p className="text-xl font-semibold text-[#111827]">{payouts.length}</p></div>
            </Card>
          </div>
        )}

        {/* Batch Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-4 p-4 bg-[#EDE9FE]/30 rounded-xl">
            <span className="text-sm font-medium">{selectedIds.size} selecionado(s)</span>
            <Button size="sm" onClick={() => markAsPaid(Array.from(selectedIds))} loading={isProcessing} icon={CheckCircle}>Marcar Pago</Button>
          </div>
        )}

        {/* Table */}
        <Card padding="none">
          <div className="p-6 border-b border-[#F1F3F7]">
            <h3 className="font-semibold text-[#111827]">Relatório de Pagamentos</h3>
          </div>

          {!selectedMonth ? (
            <EmptyState icon={Wallet} title="Selecione um mês" description="Escolha um mês para ver os pagamentos" />
          ) : isLoading ? (
            <LoadingScreen />
          ) : payouts.length === 0 ? (
            <EmptyState icon={Wallet} title="Nenhum pagamento" description="Não há pagamentos para este mês" action={{ label: "Gerar Payouts", onClick: generatePayouts }} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8F9FC]">
                    <TableHead className="w-10">
                      <Checkbox checked={payouts.filter((p) => p.status === "pending").length > 0 && selectedIds.size === payouts.filter((p) => p.status === "pending").length} onChange={(e) => handleSelectAll((e.target as HTMLInputElement).checked)} />
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
                  {payouts.map((payout, i) => (
                    <TableRow key={payout.id} className={i % 2 === 1 ? "bg-[#F8F9FC]" : ""}>
                      <TableCell>{payout.status === "pending" && <Checkbox checked={selectedIds.has(payout.id)} onChange={(e) => handleSelectOne(payout.id, (e.target as HTMLInputElement).checked)} />}</TableCell>
                      <TableCell>
                        <div><p className="font-medium">{payout.affiliate.profile.full_name || "N/A"}</p><p className="text-xs text-[#6B7280] font-mono">{payout.affiliate.affiliate_code}</p></div>
                      </TableCell>
                      <TableCell className="text-sm">{payout.affiliate.email}</TableCell>
                      <TableCell className="text-sm font-mono">{payout.affiliate.payout_pix_key || "-"}</TableCell>
                      <TableCell className="text-sm">{payout.affiliate.payout_wise_details ? "Sim" : "-"}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(payout.total_payable_cents / 100)}</TableCell>
                      <TableCell><Badge variant={payout.status === "paid" ? "success" : "warning"}>{getStatusLabel(payout.status)}</Badge></TableCell>
                      <TableCell>{payout.status === "pending" && <Button variant="ghost" size="sm" onClick={() => markAsPaid([payout.id])}>Pagar</Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
