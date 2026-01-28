"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Badge, LoadingScreen, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Input, MetricCard } from "@/components/ui/index";
import { Search, Users, UserCheck, DollarSign } from "lucide-react";
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

        {/* Table */}
        <Card noPadding>
          <div className="p-6 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-zinc-900">Lista de Afiliados</h3>
              <p className="text-sm text-zinc-500">{filteredAffiliates.length} afiliados encontrados</p>
            </div>
            <div className="w-full sm:w-72">
              <Input
                placeholder="Buscar por nome, código ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
              />
            </div>
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
              {filteredAffiliates.map((affiliate) => (
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
