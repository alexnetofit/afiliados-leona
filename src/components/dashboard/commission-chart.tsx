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
import { TrendingUp } from "lucide-react";

interface ChartData {
  month: string;
  value: number;
}

interface CommissionChartProps {
  data: ChartData[];
  title?: string;
}

export function CommissionChart({ data, title = "Comissões" }: CommissionChartProps) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-[#E5E7F2] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(58,29,122,0.06)]">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-9 w-9 rounded-lg bg-[#3A1D7A]/10 flex items-center justify-center">
          <TrendingUp className="h-4 w-4 text-[#3A1D7A]" strokeWidth={1.75} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[#1F1F2E]">{title}</h3>
          <p className="text-xs text-[#6B6F8D]">Últimos 6 meses</p>
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3A1D7A" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#3A1D7A" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F6" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="#6B6F8D"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#6B6F8D"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `R$${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #E5E7F2",
                borderRadius: "12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
              formatter={(value) => [formatCurrency(value as number), "Comissão"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3A1D7A"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
