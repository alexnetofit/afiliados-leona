"use client";

import { formatCurrency, formatDate } from "@/lib/utils";
import { DollarSign, Clock, CheckCircle, Wallet, ArrowRight } from "lucide-react";
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
  pending: { label: "Pendente", bg: "bg-amber-50", text: "text-amber-700", icon: Clock },
  available: { label: "Disponível", bg: "bg-emerald-50", text: "text-emerald-700", icon: CheckCircle },
  paid: { label: "Pago", bg: "bg-blue-50", text: "text-blue-700", icon: Wallet },
};

export function RecentSales({ sales }: RecentSalesProps) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-[#E5E7F2] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(58,29,122,0.06)]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
            <DollarSign className="h-4 w-4 text-emerald-600" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#1F1F2E]">Vendas recentes</h3>
            <p className="text-xs text-[#6B6F8D]">Últimas comissões</p>
          </div>
        </div>
        <Link 
          href="/vendas" 
          className="flex items-center gap-1 text-sm font-medium text-[#3A1D7A] hover:text-[#5B3FA6] transition-colors"
        >
          Ver todas
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="space-y-3">
        {sales.length === 0 ? (
          <div className="text-center py-10 bg-[#F8F9FC] rounded-xl border border-dashed border-[#E5E7F2]">
            <div className="h-10 w-10 mx-auto rounded-lg bg-[#EEF0F6] flex items-center justify-center mb-3">
              <DollarSign className="h-5 w-5 text-[#6B6F8D]" />
            </div>
            <p className="text-sm font-medium text-[#1F1F2E]">Nenhuma venda ainda</p>
            <p className="text-xs text-[#6B6F8D] mt-1">Compartilhe seus links para começar</p>
          </div>
        ) : (
          sales.map((sale) => {
            const status = statusConfig[sale.status];
            const StatusIcon = status.icon;
            
            return (
              <div
                key={sale.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#F8F9FC] hover:bg-[#EEF0F6] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-white border border-[#E5E7F2] flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1F1F2E]">{sale.customerName}</p>
                    <p className="text-xs text-[#6B6F8D]">{formatDate(sale.date)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#1F1F2E]">{formatCurrency(sale.commission)}</p>
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
