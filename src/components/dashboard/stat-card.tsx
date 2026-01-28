"use client";

import { cn, formatCurrency } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number;
  isCurrency?: boolean;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning" | "info";
  className?: string;
}

const variantStyles = {
  default: {
    iconBg: "bg-gray-100",
    iconColor: "text-gray-500",
  },
  primary: {
    iconBg: "bg-[#EDE9FE]",
    iconColor: "text-[#5B3FA6]",
  },
  success: {
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
  },
  warning: {
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
  },
  info: {
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
};

export function StatCard({
  title,
  value,
  isCurrency = false,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-500">
            {title}
          </p>
          <p className="text-3xl font-bold text-gray-900">
            {isCurrency ? formatCurrency(value) : value.toLocaleString("pt-BR")}
          </p>
          {trend && (
            <div className="flex items-center gap-1.5 mt-2">
              <span
                className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded-full",
                  trend.isPositive
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-700"
                )}
              >
                {trend.isPositive ? "+" : ""}
                {trend.value}%
              </span>
              <span className="text-xs text-gray-400">
                vs mês anterior
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn("rounded-xl p-3", styles.iconBg)}>
            <Icon className={cn("h-6 w-6", styles.iconColor)} />
          </div>
        )}
      </div>
    </div>
  );
}
