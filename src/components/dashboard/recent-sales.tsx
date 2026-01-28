"use client";

import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";

interface Sale {
  id: string;
  customerName: string;
  amount: number;
  commission: number;
  date: string;
  status: "pending" | "available" | "paid";
}

interface RecentSalesProps {
  sales: Sale[];
}

export function RecentSales({ sales }: RecentSalesProps) {
  return (
    <div className="rounded-xl bg-surface p-6 shadow-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-text-primary">Vendas Recentes</h3>
        <a href="/vendas" className="text-sm text-primary hover:underline">
          Ver todas
        </a>
      </div>

      <div className="space-y-4">
        {sales.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            Nenhuma venda recente
          </div>
        ) : (
          sales.map((sale) => (
            <div
              key={sale.id}
              className="flex items-center justify-between py-3 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-success-light flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {sale.customerName}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {formatDate(sale.date)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-text-primary">
                  {formatCurrency(sale.commission)}
                </p>
                <Badge
                  variant={
                    sale.status === "available"
                      ? "success"
                      : sale.status === "paid"
                      ? "info"
                      : "warning"
                  }
                  className="mt-1"
                >
                  {getStatusLabel(sale.status)}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
