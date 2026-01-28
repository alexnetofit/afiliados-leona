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

interface ChartData {
  month: string;
  value: number;
}

interface CommissionChartProps {
  data: ChartData[];
  title?: string;
}

export function CommissionChart({ data, title = "Comissões por Mês" }: CommissionChartProps) {
  return (
    <div className="rounded-xl bg-surface p-6 shadow-card">
      <h3 className="text-lg font-semibold text-text-primary mb-6">{title}</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3A1D7A" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3A1D7A" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7F2" />
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
              tickFormatter={(value) => formatCurrency(value)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E7F2",
                borderRadius: "8px",
                boxShadow: "0 6px 18px rgba(90, 63, 166, 0.08)",
              }}
              formatter={(value: number) => [formatCurrency(value), "Comissão"]}
              labelStyle={{ color: "#1F1F2E", fontWeight: 600 }}
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
