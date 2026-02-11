"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Badge, LoadingScreen, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, MetricCard } from "@/components/ui/index";
import { Users, UserCheck, DollarSign, KeyRound, X, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { COMMISSION_TIERS } from "@/types";
import { AffiliateFilters, type AffiliateFilterState } from "@/components/admin";

interface AffiliateWithStats {
  id: string;
  user_id: string;
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

const DEFAULT_FILTERS: AffiliateFilterState = {
  search: "",
  tier: "all",
  status: "all",
  sortBy: "created-desc",
  onlyWithSales: false,
};

export default function AfiliadosPage() {
  const [affiliates, setAffiliates] = useState<AffiliateWithStats[]>([]);
  const [filters, setFilters] = useState<AffiliateFilterState>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  // Password reset modal state
  const [selectedAffiliate, setSelectedAffiliate] = useState<AffiliateWithStats | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleFiltersChange = useCallback((newFilters: AffiliateFilterState) => {
    setFilters(newFilters);
  }, []);

  const openResetModal = (affiliate: AffiliateWithStats) => {
    setSelectedAffiliate(affiliate);
    setNewPassword("");
    setShowPassword(false);
    setResetStatus(null);
  };

  const closeResetModal = () => {
    setSelectedAffiliate(null);
    setNewPassword("");
    setShowPassword(false);
    setResetStatus(null);
  };

  const handleResetPassword = async () => {
    if (!selectedAffiliate || !newPassword) return;

    setIsResetting(true);
    setResetStatus(null);

    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedAffiliate.user_id,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResetStatus({ type: "error", message: data.error || "Erro ao alterar senha" });
      } else {
        setResetStatus({ type: "success", message: "Senha alterada com sucesso!" });
        setNewPassword("");
      }
    } catch {
      setResetStatus({ type: "error", message: "Erro de conexão" });
    } finally {
      setIsResetting(false);
    }
  };

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
    if (filters.search) {
      const query = filters.search.toLowerCase();
      result = result.filter((a) =>
        a.affiliate_code.toLowerCase().includes(query) ||
        a.profile.full_name?.toLowerCase().includes(query) ||
        a.user.email.toLowerCase().includes(query)
      );
    }

    // Filter by tier
    if (filters.tier !== "all") {
      result = result.filter((a) => a.commission_tier === parseInt(filters.tier));
    }

    // Filter by status
    if (filters.status !== "all") {
      const isActive = filters.status === "active";
      result = result.filter((a) => a.is_active === isActive);
    }

    // Filter by only with sales
    if (filters.onlyWithSales) {
      result = result.filter((a) => a.paid_subscriptions_count > 0);
    }

    // Parse sort option (e.g., "created-desc" -> field: "created", order: "desc")
    const [sortField, sortOrder] = filters.sortBy.split("-") as [string, "asc" | "desc"];

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
  }, [affiliates, filters]);

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
        <AffiliateFilters
          filters={filters}
          onChange={handleFiltersChange}
          totalCount={affiliates.length}
          filteredCount={filteredAndSortedAffiliates.length}
        />

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
                <TableHead className="text-right">Ações</TableHead>
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
                  <TableCell className="text-right">
                    <button
                      onClick={() => openResetModal(affiliate)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
                      title="Alterar senha"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Senha
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Password Reset Modal */}
      {selectedAffiliate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeResetModal}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center">
                  <KeyRound className="h-5 w-5 text-zinc-500" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900">Alterar Senha</h3>
              </div>
              <button
                onClick={closeResetModal}
                className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Affiliate Info */}
            <div className="bg-zinc-50 rounded-xl p-4 mb-6">
              <p className="font-semibold text-zinc-900">
                {selectedAffiliate.profile.full_name || "Sem nome"}
              </p>
              <p className="text-sm text-zinc-500">{selectedAffiliate.user.email}</p>
              <p className="text-xs text-zinc-400 mt-1">
                Código: {selectedAffiliate.affiliate_code}
              </p>
            </div>

            {/* Password Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Nova senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite a nova senha"
                  className="w-full px-4 py-2.5 pr-10 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300 transition-all"
                  disabled={isResetting}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newPassword.length >= 6) {
                      handleResetPassword();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPassword.length > 0 && newPassword.length < 6 && (
                <p className="text-xs text-red-500 mt-1">Mínimo de 6 caracteres</p>
              )}
            </div>

            {/* Status Message */}
            {resetStatus && (
              <div
                className={`flex items-center gap-2 p-3 rounded-xl mb-4 text-sm ${
                  resetStatus.type === "success"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {resetStatus.type === "success" ? (
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                )}
                {resetStatus.message}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={closeResetModal}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-colors"
              >
                {resetStatus?.type === "success" ? "Fechar" : "Cancelar"}
              </button>
              {resetStatus?.type !== "success" && (
                <button
                  onClick={handleResetPassword}
                  disabled={isResetting || newPassword.length < 6}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed rounded-xl transition-colors"
                >
                  {isResetting ? "Alterando..." : "Alterar Senha"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
