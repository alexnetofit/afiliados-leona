"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingScreen } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Users, Eye } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { COMMISSION_TIERS } from "@/types";

interface AffiliateWithStats {
  id: string;
  affiliate_code: string;
  commission_tier: number;
  paid_subscriptions_count: number;
  is_active: boolean;
  created_at: string;
  profile: {
    full_name: string | null;
  };
  user: {
    email: string;
  };
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
      // Fetch affiliates with profiles
      const { data: affiliatesData } = await supabase
        .from("affiliates")
        .select(`
          id,
          affiliate_code,
          commission_tier,
          paid_subscriptions_count,
          is_active,
          created_at,
          user_id
        `)
        .order("created_at", { ascending: false });

      if (!affiliatesData) return;

      // Fetch additional data for each affiliate
      const enrichedAffiliates = await Promise.all(
        (affiliatesData as Array<{
          id: string;
          affiliate_code: string;
          commission_tier: number;
          paid_subscriptions_count: number;
          is_active: boolean;
          created_at: string;
          user_id: string;
        }>).map(async (affiliate) => {
          // Get profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", affiliate.user_id)
            .single();

          // Get user email - using profiles table since admin API requires service role
          let userEmail = "N/A";
          // Note: auth.admin requires service role key, using fallback
          try {
            const { data: authData } = await supabase.auth.admin.getUserById(affiliate.user_id);
            userEmail = authData?.user?.email || "N/A";
          } catch {
            userEmail = "N/A";
          }

          // Get total commissions
          const { data: transactions } = await supabase
            .from("transactions")
            .select("commission_amount_cents")
            .eq("affiliate_id", affiliate.id)
            .eq("type", "commission");

          // Get active subscriptions count
          const { count: activeCount } = await supabase
            .from("subscriptions")
            .select("id", { count: "exact", head: true })
            .eq("affiliate_id", affiliate.id)
            .eq("status", "active");

          return {
            ...affiliate,
            profile: profile || { full_name: null },
            user: { email: userEmail },
            totalCommissions: ((transactions || []) as Array<{ commission_amount_cents: number }>).reduce(
              (sum, t) => sum + t.commission_amount_cents,
              0
            ),
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
    return (
      a.affiliate_code.toLowerCase().includes(query) ||
      a.profile.full_name?.toLowerCase().includes(query) ||
      a.user.email.toLowerCase().includes(query)
    );
  });

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen">
      <Header title="Afiliados" subtitle="Gerencie todos os afiliados do programa" />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary-lightest flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Total de Afiliados</p>
                  <p className="text-xl font-bold text-text-primary">{affiliates.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-success-light flex items-center justify-center">
                  <Users className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Afiliados Ativos</p>
                  <p className="text-xl font-bold text-text-primary">
                    {affiliates.filter((a) => a.is_active).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-warning-light flex items-center justify-center">
                  <Users className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Total em Comissões</p>
                  <p className="text-xl font-bold text-text-primary">
                    {formatCurrency(
                      affiliates.reduce((sum, a) => sum + a.totalCommissions, 0)
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>Lista de Afiliados</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                <Input
                  placeholder="Buscar afiliado..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Afiliado</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Assinaturas Pagas</TableHead>
                    <TableHead>Assinaturas Ativas</TableHead>
                    <TableHead>Total Comissões</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAffiliates.map((affiliate) => (
                    <TableRow key={affiliate.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-text-primary">
                            {affiliate.profile.full_name || "Sem nome"}
                          </p>
                          <p className="text-xs text-text-secondary">{affiliate.user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{affiliate.affiliate_code}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">
                          Tier {affiliate.commission_tier} - {COMMISSION_TIERS[affiliate.commission_tier as 1 | 2 | 3].percent}%
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {affiliate.paid_subscriptions_count}
                      </TableCell>
                      <TableCell>{affiliate.activeSubscriptions}</TableCell>
                      <TableCell className="font-semibold text-success">
                        {formatCurrency(affiliate.totalCommissions)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={affiliate.is_active ? "success" : "secondary"}>
                          {affiliate.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-text-secondary">
                        {formatDate(affiliate.created_at)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
