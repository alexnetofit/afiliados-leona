"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Badge, LoadingScreen, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/index";
import { Search, Users } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { COMMISSION_TIERS } from "@/types";

interface AffiliateWithStats {
  id: string;
  affiliate_code: string;
  commission_tier: number;
  paid_subscriptions_count: number;
  is_active: boolean;
  created_at: string;
  profile: { full_name: string | null };
  user: { email: string };
  totalCommissions: number;
  activeSubscriptions: number;
}

export default function AfiliadosPage() {
  const [affiliates, setAffiliates] = useState<AffiliateWithStats[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchAffiliates();
  }, []);

  async function fetchAffiliates() {
    try {
      const { data: affiliatesData } = await supabase
        .from("affiliates")
        .select("id, affiliate_code, commission_tier, paid_subscriptions_count, is_active, created_at, user_id")
        .order("created_at", { ascending: false });

      if (!affiliatesData) return;

      const enrichedAffiliates = await Promise.all(
        (affiliatesData as Array<{ id: string; affiliate_code: string; commission_tier: number; paid_subscriptions_count: number; is_active: boolean; created_at: string; user_id: string }>).map(async (affiliate) => {
          const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", affiliate.user_id).single();
          let userEmail = "N/A";
          try {
            const { data: authData } = await supabase.auth.admin.getUserById(affiliate.user_id);
            userEmail = authData?.user?.email || "N/A";
          } catch { userEmail = "N/A"; }

          const { data: transactions } = await supabase.from("transactions").select("commission_amount_cents").eq("affiliate_id", affiliate.id).eq("type", "commission");
          const { count: activeCount } = await supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("affiliate_id", affiliate.id).eq("status", "active");

          return {
            ...affiliate,
            profile: profile || { full_name: null },
            user: { email: userEmail },
            totalCommissions: ((transactions || []) as Array<{ commission_amount_cents: number }>).reduce((sum, t) => sum + t.commission_amount_cents, 0),
            activeSubscriptions: activeCount || 0,
          };
        })
      );

      setAffiliates(enrichedAffiliates);
    } catch (error) {
      console.error("Error fetching affiliates:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredAffiliates = affiliates.filter((a) => {
    const query = searchQuery.toLowerCase();
    return a.affiliate_code.toLowerCase().includes(query) || a.profile.full_name?.toLowerCase().includes(query) || a.user.email.toLowerCase().includes(query);
  });

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-[1320px] mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#111827]">Afiliados</h1>
          <p className="text-[#6B7280]">Gerencie todos os afiliados do programa</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-[#EDE9FE] flex items-center justify-center"><Users className="h-5 w-5 text-[#5B21B6]" /></div>
            <div><p className="text-sm text-[#6B7280]">Total</p><p className="text-xl font-semibold text-[#111827]">{affiliates.length}</p></div>
          </Card>
          <Card className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-[#D1FAE5] flex items-center justify-center"><Users className="h-5 w-5 text-[#059669]" /></div>
            <div><p className="text-sm text-[#6B7280]">Ativos</p><p className="text-xl font-semibold text-[#111827]">{affiliates.filter((a) => a.is_active).length}</p></div>
          </Card>
          <Card className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-[#FEF3C7] flex items-center justify-center"><Users className="h-5 w-5 text-[#D97706]" /></div>
            <div><p className="text-sm text-[#6B7280]">Total Comissões</p><p className="text-xl font-semibold text-[#111827]">{formatCurrency(affiliates.reduce((sum, a) => sum + a.totalCommissions, 0) / 100)}</p></div>
          </Card>
        </div>

        {/* Search & Table */}
        <Card padding="none">
          <div className="p-6 border-b border-[#F1F3F7] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="font-semibold text-[#111827]">Lista de Afiliados</h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
              <input
                placeholder="Buscar afiliado..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-white border border-[#E8EAF0] rounded-xl text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#5B21B6]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F8F9FC]">
                  <TableHead>Afiliado</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Vendas</TableHead>
                  <TableHead>Ativas</TableHead>
                  <TableHead>Comissões</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAffiliates.map((affiliate, i) => (
                  <TableRow key={affiliate.id} className={i % 2 === 1 ? "bg-[#F8F9FC]" : ""}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-[#111827]">{affiliate.profile.full_name || "Sem nome"}</p>
                        <p className="text-xs text-[#6B7280]">{affiliate.user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell><span className="font-mono text-sm">{affiliate.affiliate_code}</span></TableCell>
                    <TableCell><Badge variant="primary">Tier {affiliate.commission_tier} - {COMMISSION_TIERS[affiliate.commission_tier as 1 | 2 | 3].percent}%</Badge></TableCell>
                    <TableCell className="font-semibold">{affiliate.paid_subscriptions_count}</TableCell>
                    <TableCell>{affiliate.activeSubscriptions}</TableCell>
                    <TableCell className="font-semibold text-[#059669]">{formatCurrency(affiliate.totalCommissions / 100)}</TableCell>
                    <TableCell><Badge variant={affiliate.is_active ? "success" : "default"}>{affiliate.is_active ? "Ativo" : "Inativo"}</Badge></TableCell>
                    <TableCell className="text-[#6B7280]">{formatDate(affiliate.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
