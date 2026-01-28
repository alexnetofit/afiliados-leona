"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, Calendar } from "lucide-react";

interface ChartData {
  month: string;
  value: number;
}

interface CommissionChartProps {
  data: ChartData[];
  title?: string;
}

export function CommissionChart({ data, title = "Desempenho de Comissões" }: CommissionChartProps) {
  return (
    <div className="bg-white rounded-[32px] p-8 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.04)] border border-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-indigo-50">
            <TrendingUp className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">{title}</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Últimos 6 meses</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Jan 2026 - Jun 2026</span>
        </div>
      </div>

      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3A1D7A" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#3A1D7A" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="6 6" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="#94a3b8"
              fontSize={11}
              fontWeight={700}
              tickLine={false}
              axisLine={false}
              dy={15}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              fontWeight={700}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `R$ ${value}`}
            />
            <Tooltip
              cursor={{ stroke: '#3A1D7A', strokeWidth: 2, strokeDasharray: '4 4' }}
              contentStyle={{
                backgroundColor: "#FFFFFF",
                border: "none",
                borderRadius: "20px",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.1)",
                padding: "16px 20px",
              }}
              itemStyle={{ fontSize: '14px', fontWeight: 900, color: '#1e293b' }}
              labelStyle={{ fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}
              formatter={(value) => [formatCurrency(value as number), "Ganhos"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3A1D7A"
              strokeWidth={4}
              fillOpacity={1}
              fill="url(#colorValue)"
              animationDuration={2000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
