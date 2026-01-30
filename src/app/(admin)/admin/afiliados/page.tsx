"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Badge, LoadingScreen, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Input, MetricCard, Select } from "@/components/ui/index";
import { Search, Users, UserCheck, DollarSign, Filter } from "lucide-react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
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

type SortField = "name" | "code" | "tier" | "sales" | "commissions" | "created";
type SortOrder = "asc" | "desc";

export default function AfiliadosPage() {
  const [affiliates, setAffiliates] = useState<AffiliateWithStats[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("created");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
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

  const filteredAndSortedAffiliates = useMemo(() => {
    let result = affiliates;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((a) =>
        a.affiliate_code.toLowerCase().includes(query) ||
        a.profile.full_name?.toLowerCase().includes(query) ||
        a.user.email.toLowerCase().includes(query)
      );
    }

    // Filter by tier
    if (tierFilter !== "all") {
      result = result.filter((a) => a.commission_tier === parseInt(tierFilter));
    }

    // Filter by status
    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      result = result.filter((a) => a.is_active === isActive);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = (a.profile.full_name || "").localeCompare(b.profile.full_name || "");
          break;
        case "code":
          comparison = a.affiliate_code.localeCompare(b.affiliate_code);
          break;
        case "tier":
          comparison = a.commission_tier - b.commission_tier;
          break;
        case "sales":
          comparison = a.paid_subscriptions_count - b.paid_subscriptions_count;
          break;
        case "commissions":
          comparison = a.totalCommissions - b.totalCommissions;
          break;
        case "created":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });

    return result;
  }, [affiliates, searchQuery, tierFilter, statusFilter, sortField, sortOrder]);

  const totalCommissions = affiliates.reduce((sum, a) => sum + a.totalCommissions, 0);

  if (isLoading) return <LoadingScreen message="Carregando afiliados..." />;

  return (
    <div className="flex-1 p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto space-y-8 animate-fade-in-up">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Afiliados</h1>
          <p className="text-zinc-500 mt-1">Gerencie todos os afiliados do programa</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <MetricCard icon={Users} label="Total" value={affiliates.length.toString()} color="primary" />
          <MetricCard icon={UserCheck} label="Ativos" value={affiliates.filter((a) => a.is_active).length.toString()} color="success" />
          <MetricCard icon={DollarSign} label="Total Comissões" value={formatCurrency(totalCommissions / 100)} color="info" />
        </div>

        {/* Filters */}
        <Card>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nome, código ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Select
                options={[
                  { value: "all", label: "Todos os Tiers" },
                  { value: "1", label: "Tier 1 (30%)" },
                  { value: "2", label: "Tier 2 (35%)" },
                  { value: "3", label: "Tier 3 (40%)" },
                ]}
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="w-40"
              />
              <Select
                options={[
                  { value: "all", label: "Todos os Status" },
                  { value: "active", label: "Ativos" },
                  { value: "inactive", label: "Inativos" },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-40"
              />
              <Select
                options={[
                  { value: "created", label: "Data de Criação" },
                  { value: "name", label: "Nome" },
                  { value: "code", label: "Código" },
                  { value: "tier", label: "Tier" },
                  { value: "sales", label: "Vendas" },
                  { value: "commissions", label: "Comissões" },
                ]}
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="w-44"
              />
              <Select
                options={[
                  { value: "desc", label: "Decrescente" },
                  { value: "asc", label: "Crescente" },
                ]}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="w-36"
              />
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card noPadding>
          <div className="p-6 border-b border-zinc-100">
            <h3 className="text-lg font-bold text-zinc-900">Lista de Afiliados</h3>
            <p className="text-sm text-zinc-500">{filteredAndSortedAffiliates.length} de {affiliates.length} afiliados</p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
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
              {filteredAndSortedAffiliates.map((affiliate) => (
                <TableRow key={affiliate.id} className="hover:bg-zinc-50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center">
                        <span className="text-sm font-bold text-zinc-500">
                          {(affiliate.profile.full_name || "?")[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-900">{affiliate.profile.full_name || "Sem nome"}</p>
                        <p className="text-xs text-zinc-500">{affiliate.user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="px-2 py-1 bg-zinc-100 rounded-md text-sm font-mono">
                      {affiliate.affiliate_code}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="primary">
                      Tier {affiliate.commission_tier} • {COMMISSION_TIERS[affiliate.commission_tier as 1 | 2 | 3].percent}%
                    </Badge>
                  </TableCell>
                  <TableCell className="font-bold text-zinc-900">{affiliate.paid_subscriptions_count}</TableCell>
                  <TableCell className="text-zinc-600">{affiliate.activeSubscriptions}</TableCell>
                  <TableCell className="font-bold text-success-600">{formatCurrency(affiliate.totalCommissions / 100)}</TableCell>
                  <TableCell>
                    <Badge variant={affiliate.is_active ? "success" : "default"} dot>
                      {affiliate.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-zinc-500">{formatDate(affiliate.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
