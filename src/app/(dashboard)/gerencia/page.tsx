"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppData } from "@/contexts";
import { Header } from "@/components/layout/header";
import {
  Card,
  Badge,
  LoadingScreen,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  MetricCard,
} from "@/components/ui/index";
import { Crown, Users, DollarSign, CreditCard } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";

interface ManagedAffiliate {
  id: string;
  name: string;
  affiliate_code: string;
  tier: number;
  tier_name: string;
  commission_percent: number;
  manager_commission_percent: number;
  total_sales: number;
  total_revenue_cents: number;
  active_subscriptions: number;
  total_subscriptions: number;
  created_at: string;
}

export default function GerenciaPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, isLoading, isInitialized } = useAppData();
  const [affiliates, setAffiliates] = useState<ManagedAffiliate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAffiliates = useCallback(async () => {
    try {
      const res = await fetch("/api/manager/affiliates");
      if (res.ok) {
        const data = await res.json();
        setAffiliates(data.affiliates || []);
      }
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isInitialized) fetchAffiliates();
  }, [isInitialized, fetchAffiliates]);

  if ((isLoading && !isInitialized) || loading) {
    return <LoadingScreen message="Carregando gerência..." />;
  }

  const totalSales = affiliates.reduce((sum, a) => sum + a.total_sales, 0);
  const totalActiveSubs = affiliates.reduce((sum, a) => sum + a.active_subscriptions, 0);
  const totalRevenue = affiliates.reduce((sum, a) => sum + a.total_revenue_cents, 0);

  const tierColor = (tier: number) =>
    tier === 3
      ? "bg-yellow-100 text-yellow-800"
      : tier === 2
        ? "bg-zinc-200 text-zinc-700"
        : "bg-amber-100 text-amber-800";

  return (
    <>
      <Header
        title="Gerência"
        description="Gerencie seus afiliados recrutados"
        user={profile ? { name: profile.full_name || "" } : undefined}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex-1 p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in-up">
          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Afiliados recrutados"
              value={String(affiliates.length)}
              icon={Users}
              color="warning"
            />
            <MetricCard
              label="Total de vendas"
              value={String(totalSales)}
              icon={DollarSign}
              color="warning"
            />
            <MetricCard
              label="Assinaturas ativas"
              value={String(totalActiveSubs)}
              icon={CreditCard}
              color="warning"
            />
            <MetricCard
              label="Faturamento total"
              value={formatCurrency(totalRevenue / 100)}
              icon={Crown}
              color="warning"
            />
          </div>

          {/* Table */}
          <Card noPadding>
            <div className="p-4 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center">
                  <Crown className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-900">Seus Afiliados</h3>
                  <p className="text-sm text-zinc-500">
                    Desempenho dos afiliados recrutados por você
                  </p>
                </div>
              </div>
            </div>

            {affiliates.length === 0 ? (
              <div className="py-16 text-center">
                <Crown className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
                <p className="font-medium text-zinc-600">Nenhum afiliado recrutado</p>
                <p className="text-sm text-zinc-500 mt-1">
                  Compartilhe seu link de gerência na aba Links
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Vendas</TableHead>
                    <TableHead>Subs Ativas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affiliates.map((aff) => (
                    <TableRow key={aff.id}>
                      <TableCell className="font-medium">{aff.name}</TableCell>
                      <TableCell>
                        <code className="px-1.5 py-0.5 bg-zinc-100 rounded text-xs font-mono">
                          {aff.affiliate_code}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge className={tierColor(aff.tier)} size="sm">
                          {aff.tier_name}
                        </Badge>
                      </TableCell>
                      <TableCell>{aff.commission_percent}%</TableCell>
                      <TableCell>{aff.total_sales}</TableCell>
                      <TableCell>
                        <Badge
                          variant={aff.active_subscriptions > 0 ? "success" : "default"}
                          size="sm"
                        >
                          {aff.active_subscriptions}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
