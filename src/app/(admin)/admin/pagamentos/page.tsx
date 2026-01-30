"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Button, Badge, Select, Checkbox, LoadingScreen, EmptyState, MetricCard, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/index";
import { Download, CheckCircle, Wallet, Users, Calendar } from "lucide-react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

interface TransactionWithAffiliate {
  id: string;
  affiliate_id: string;
  commission_amount_cents: number;
  paid_at: string;
  available_at: string;
  type: string;
}

interface AffiliatePayoutData {
  affiliate_id: string;
  affiliate_code: string;
  full_name: string | null;
  email: string;
  payout_pix_key: string | null;
  payout_wise_email: string | null;
  total_cents: number;
  transactions_count: number;
  status: "pending" | "paid";
  paid_at: string | null;
}

export default function PagamentosPage() {
  const [payoutData, setPayoutData] = useState<AffiliatePayoutData[]>([]);
  const [selectedPayoutDate, setSelectedPayoutDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paidPayouts, setPaidPayouts] = useState<Map<string, { paid_at: string }>>(new Map());
  const supabase = createClient();

  // Generate payout date options (day 05 and day 20 of each month for the next 12 months)
  const payoutDateOptions = useMemo(() => {
    const options = [{ value: "", label: "Selecione uma data de pagamento" }];
    const now = new Date();
    
    for (let i = 0; i < 6; i++) {
      const month = new Date(now.getFullYear(), now.getMonth() + i, 1);
      
      // Day 05
      const day05 = new Date(month.getFullYear(), month.getMonth(), 5);
      if (day05 >= now || i === 0) {
        options.push({
          value: day05.toISOString().split("T")[0],
          label: `05/${String(month.getMonth() + 1).padStart(2, "0")}/${month.getFullYear()} (Pagamentos 01-15 do mês anterior)`
        });
      }
      
      // Day 20
      const day20 = new Date(month.getFullYear(), month.getMonth(), 20);
      if (day20 >= now || i === 0) {
        options.push({
          value: day20.toISOString().split("T")[0],
          label: `20/${String(month.getMonth() + 1).padStart(2, "0")}/${month.getFullYear()} (Pagamentos 16-31 do mês anterior)`
        });
      }
    }
    
    // Also add past dates for history
    for (let i = 1; i <= 6; i++) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      
      const day05 = new Date(month.getFullYear(), month.getMonth(), 5);
      options.push({
        value: day05.toISOString().split("T")[0],
        label: `05/${String(month.getMonth() + 1).padStart(2, "0")}/${month.getFullYear()}`
      });
      
      const day20 = new Date(month.getFullYear(), month.getMonth(), 20);
      options.push({
        value: day20.toISOString().split("T")[0],
        label: `20/${String(month.getMonth() + 1).padStart(2, "0")}/${month.getFullYear()}`
      });
    }
    
    return options;
  }, []);

  useEffect(() => {
    if (selectedPayoutDate) fetchPayoutData();
  }, [selectedPayoutDate, statusFilter]);

  async function fetchPayoutData() {
    setIsLoading(true);
    try {
      const payoutDate = new Date(selectedPayoutDate);
      const payoutDay = payoutDate.getDate();
      
      // Calculate the date range for transactions based on payout date
      // For day 05: transactions from day 01-15 of previous month
      // For day 20: transactions from day 16-31 of previous month
      let startDate: Date;
      let endDate: Date;
      
      const prevMonth = new Date(payoutDate.getFullYear(), payoutDate.getMonth() - 1, 1);
      
      if (payoutDay === 5) {
        // Transactions from day 01-15 of previous month
        startDate = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
        endDate = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 15, 23, 59, 59);
      } else {
        // Transactions from day 16-31 of previous month
        startDate = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 16);
        endDate = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0, 23, 59, 59); // Last day of month
      }
      
      // Fetch transactions paid within this date range
      const { data: transactions } = await supabase
        .from("transactions")
        .select("id, affiliate_id, commission_amount_cents, paid_at, available_at, type")
        .gte("paid_at", startDate.toISOString())
        .lte("paid_at", endDate.toISOString())
        .eq("type", "commission");

      if (!transactions || transactions.length === 0) {
        setPayoutData([]);
        setIsLoading(false);
        return;
      }

      // Fetch existing payout records
      const { data: existingPayouts } = await supabase
        .from("monthly_payouts")
        .select("affiliate_id, status, paid_at")
        .eq("month", selectedPayoutDate);

      const paidMap = new Map<string, { paid_at: string }>();
      (existingPayouts || []).forEach((p: { affiliate_id: string; status: string; paid_at: string | null }) => {
        if (p.status === "paid" && p.paid_at) {
          paidMap.set(p.affiliate_id, { paid_at: p.paid_at });
        }
      });
      setPaidPayouts(paidMap);

      // Group transactions by affiliate
      const affiliateMap = new Map<string, { total: number; count: number }>();
      (transactions as TransactionWithAffiliate[]).forEach((tx) => {
        const existing = affiliateMap.get(tx.affiliate_id) || { total: 0, count: 0 };
        existing.total += tx.commission_amount_cents;
        existing.count += 1;
        affiliateMap.set(tx.affiliate_id, existing);
      });

      // Fetch affiliate details
      const affiliateIds = Array.from(affiliateMap.keys());
      const { data: affiliates } = await supabase
        .from("affiliates")
        .select("id, affiliate_code, payout_pix_key, payout_wise_email, user_id")
        .in("id", affiliateIds);

      if (!affiliates) {
        setPayoutData([]);
        setIsLoading(false);
        return;
      }

      // Enrich with profile data
      const enrichedData: AffiliatePayoutData[] = await Promise.all(
        (affiliates as Array<{ id: string; affiliate_code: string; payout_pix_key: string | null; payout_wise_email: string | null; user_id: string }>).map(async (aff) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", aff.user_id)
            .single();

          let email = "N/A";
          try {
            const { data: authData } = await supabase.auth.admin.getUserById(aff.user_id);
            email = authData?.user?.email || "N/A";
          } catch {
            email = "N/A";
          }

          const txData = affiliateMap.get(aff.id) || { total: 0, count: 0 };
          const isPaid = paidMap.has(aff.id);

          return {
            affiliate_id: aff.id,
            affiliate_code: aff.affiliate_code,
            full_name: (profile as { full_name: string | null } | null)?.full_name || null,
            email,
            payout_pix_key: aff.payout_pix_key,
            payout_wise_email: aff.payout_wise_email,
            total_cents: txData.total,
            transactions_count: txData.count,
            status: isPaid ? "paid" : "pending",
            paid_at: paidMap.get(aff.id)?.paid_at || null,
          };
        })
      );

      // Apply status filter
      let filtered = enrichedData;
      if (statusFilter !== "all") {
        filtered = enrichedData.filter((p) => p.status === statusFilter);
      }

      // Sort by total descending
      filtered.sort((a, b) => b.total_cents - a.total_cents);

      setPayoutData(filtered);
    } catch (error) {
      console.error("Error fetching payout data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function markAsPaid(affiliateIds: string[]) {
    if (!selectedPayoutDate) return;
    setIsProcessing(true);
    try {
      // Insert or update monthly_payouts records
      for (const id of affiliateIds) {
        const data = payoutData.find((p) => p.affiliate_id === id);
        const payoutRecord = {
          affiliate_id: id,
          month: selectedPayoutDate,
          total_commission_cents: data?.total_cents || 0,
          total_negative_cents: 0,
          total_payable_cents: data?.total_cents || 0,
          status: "paid" as const,
          paid_at: new Date().toISOString(),
        };

        // Check if record exists
        const { data: existingData } = await supabase
          .from("monthly_payouts")
          .select("id")
          .eq("affiliate_id", id)
          .eq("month", selectedPayoutDate)
          .single();

        const existing = existingData as { id: string } | null;

        if (existing) {
          // Update existing record
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from("monthly_payouts") as any).update({
              status: "paid",
              paid_at: new Date().toISOString(),
              total_commission_cents: payoutRecord.total_commission_cents,
              total_payable_cents: payoutRecord.total_payable_cents,
            })
            .eq("id", existing.id);
        } else {
          // Insert new record
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from("monthly_payouts") as any).insert(payoutRecord);
        }
      }

      setSelectedIds(new Set());
      await fetchPayoutData();
    } catch (error) {
      console.error("Error marking as paid:", error);
      alert("Erro ao marcar como pago");
    } finally {
      setIsProcessing(false);
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(payoutData.filter((p) => p.status === "pending").map((p) => p.affiliate_id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedIds(newSet);
  };

  const handleExportCSV = () => {
    const headers = ["Afiliado", "Código", "Email", "PIX", "Wise Email", "Total", "Transações", "Status"];
    const rows = payoutData.map((p) => [
      p.full_name || "N/A",
      p.affiliate_code,
      p.email,
      p.payout_pix_key || "",
      p.payout_wise_email || "",
      (p.total_cents / 100).toFixed(2),
      p.transactions_count.toString(),
      p.status,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `pagamentos-${selectedPayoutDate}.csv`;
    link.click();
  };

  const pendingTotal = payoutData.filter((p) => p.status === "pending").reduce((sum, p) => sum + p.total_cents, 0);
  const paidTotal = payoutData.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.total_cents, 0);
  const pendingCount = payoutData.filter((p) => p.status === "pending").length;

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto space-y-8 animate-fade-in-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Pagamentos</h1>
            <p className="text-zinc-500 mt-1">Gerencie os pagamentos dos afiliados</p>
          </div>
          <Button variant="secondary" onClick={handleExportCSV} disabled={payoutData.length === 0} icon={Download}>
            Exportar CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <Select
            options={payoutDateOptions}
            value={selectedPayoutDate}
            onChange={(e) => setSelectedPayoutDate(e.target.value)}
            className="w-96"
          />
          <Select
            options={[
              { value: "all", label: "Todos os status" },
              { value: "pending", label: "Pendente" },
              { value: "paid", label: "Pago" },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-40"
          />
        </div>

        {/* Stats */}
        {selectedPayoutDate && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            <MetricCard icon={Wallet} label="Pendente" value={formatCurrency(pendingTotal / 100)} color="warning" />
            <MetricCard icon={CheckCircle} label="Pago" value={formatCurrency(paidTotal / 100)} color="success" />
            <MetricCard icon={Users} label="Afiliados Pendentes" value={pendingCount.toString()} color="primary" />
            <MetricCard icon={Calendar} label="Data Pagamento" value={formatDate(selectedPayoutDate)} color="info" />
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
            <p className="text-sm text-zinc-500">
              {selectedPayoutDate ? `Pagamento em ${formatDate(selectedPayoutDate)}` : "Selecione uma data de pagamento"}
            </p>
          </div>

          {!selectedPayoutDate ? (
            <EmptyState icon={Wallet} title="Selecione uma data" description="Escolha uma data de pagamento para ver os valores" />
          ) : isLoading ? (
            <LoadingScreen />
          ) : payoutData.length === 0 ? (
            <EmptyState icon={Wallet} title="Nenhum pagamento" description="Não há comissões disponíveis para esta data" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={pendingCount > 0 && selectedIds.size === pendingCount}
                      onChange={(e) => handleSelectAll((e.target as HTMLInputElement).checked)}
                    />
                  </TableHead>
                  <TableHead>Afiliado</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>PIX</TableHead>
                  <TableHead>Wise</TableHead>
                  <TableHead className="text-center">Transações</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payoutData.map((payout) => (
                  <TableRow key={payout.affiliate_id} className="hover:bg-zinc-50">
                    <TableCell>
                      {payout.status === "pending" && (
                        <Checkbox
                          checked={selectedIds.has(payout.affiliate_id)}
                          onChange={(e) => handleSelectOne(payout.affiliate_id, (e.target as HTMLInputElement).checked)}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-zinc-100 flex items-center justify-center">
                          <span className="text-xs font-bold text-zinc-500">
                            {(payout.full_name || "?")[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-900">{payout.full_name || "N/A"}</p>
                          <code className="text-xs text-zinc-500">{payout.affiliate_code}</code>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-600">{payout.email}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-zinc-100 px-2 py-1 rounded">{payout.payout_pix_key || "-"}</code>
                    </TableCell>
                    <TableCell className="text-zinc-600">{payout.payout_wise_email || "-"}</TableCell>
                    <TableCell className="text-center text-zinc-600">{payout.transactions_count}</TableCell>
                    <TableCell className="text-right font-bold text-zinc-900">{formatCurrency(payout.total_cents / 100)}</TableCell>
                    <TableCell>
                      <Badge variant={payout.status === "paid" ? "success" : "warning"} dot>
                        {payout.status === "paid" ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {payout.status === "pending" && (
                        <Button variant="ghost" size="sm" onClick={() => markAsPaid([payout.affiliate_id])}>
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
