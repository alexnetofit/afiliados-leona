"use client";

import { formatCurrency, formatDate } from "@/lib/utils";
import { DollarSign, Clock, CheckCircle, Wallet, ArrowRight, User } from "lucide-react";
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
  pending: { 
    label: "Pendente", 
    bg: "bg-amber-50", 
    text: "text-amber-600",
    border: "border-amber-100",
    icon: Clock
  },
  available: { 
    label: "Disponível", 
    bg: "bg-emerald-50", 
    text: "text-emerald-600",
    border: "border-emerald-100",
    icon: CheckCircle
  },
  paid: { 
    label: "Pago", 
    bg: "bg-blue-50", 
    text: "text-blue-600",
    border: "border-blue-100",
    icon: Wallet
  },
};

export function RecentSales({ sales }: RecentSalesProps) {
  return (
    <div className="bg-white rounded-[32px] p-8 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.04)] border border-slate-100">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-emerald-50">
            <DollarSign className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Vendas Recentes</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Últimas atividades</p>
          </div>
        </div>
        <Link 
          href="/vendas" 
          className="p-2.5 rounded-xl bg-slate-50 text-slate-400 hover:text-[#3A1D7A] hover:bg-indigo-50 transition-all group"
        >
          <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      <div className="space-y-4">
        {sales.length === 0 ? (
          <div className="text-center py-16 px-4 bg-slate-50 rounded-[24px] border border-dashed border-slate-200">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-white flex items-center justify-center mb-4 shadow-sm">
              <DollarSign className="h-8 w-8 text-slate-200" />
            </div>
            <p className="text-slate-900 font-black tracking-tight">Nenhuma venda ainda</p>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Comece a compartilhar seus links!</p>
          </div>
        ) : (
          sales.map((sale) => {
            const status = statusConfig[sale.status];
            const StatusIcon = status.icon;
            
            return (
              <div
                key={sale.id}
                className="group flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-all duration-300 border border-transparent hover:border-slate-100"
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                    <User className="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {sale.customerName}
                    </p>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      {formatDate(sale.date)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">
                    {formatCurrency(sale.commission)}
                  </p>
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg mt-1.5 border ${status.bg} ${status.text} ${status.border}`}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
      
      <div className="mt-8 pt-6 border-t border-slate-50">
        <Link 
          href="/vendas" 
          className="flex items-center justify-center gap-2 text-xs font-black text-slate-400 hover:text-[#3A1D7A] uppercase tracking-[2px] transition-colors"
        >
          Ver relatório completo
        </Link>
      </div>
    </div>
  );
}
