"use client";

import { formatCurrency, formatDate } from "@/lib/utils";
import { DollarSign, Clock, CheckCircle, Wallet } from "lucide-react";
import Link from "next/link";

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

const statusConfig = {
  pending: { label: "Pendente", bg: "bg-amber-100", text: "text-amber-700", icon: Clock },
  available: { label: "Disponível", bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle },
  paid: { label: "Pago", bg: "bg-blue-100", text: "text-blue-700", icon: Wallet },
};

export function RecentSales({ sales }: RecentSalesProps) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Vendas Recentes</h3>
            <p className="text-xs text-gray-400">Últimas atividades</p>
          </div>
        </div>
        <Link href="/vendas" className="text-sm font-medium text-violet-600 hover:text-violet-700">
          Ver todas →
        </Link>
      </div>

      <div className="space-y-3">
        {sales.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <div className="h-12 w-12 mx-auto rounded-xl bg-gray-100 flex items-center justify-center mb-3">
              <DollarSign className="h-6 w-6 text-gray-300" />
            </div>
            <p className="text-gray-900 font-semibold">Nenhuma venda ainda</p>
            <p className="text-gray-400 text-sm mt-1">Comece a compartilhar seus links!</p>
          </div>
        ) : (
          sales.map((sale) => {
            const status = statusConfig[sale.status];
            const StatusIcon = status.icon;
            
            return (
              <div
                key={sale.id}
                className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{sale.customerName}</p>
                    <p className="text-xs text-gray-400">{formatDate(sale.date)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(sale.commission)}</p>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md ${status.bg} ${status.text}`}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
