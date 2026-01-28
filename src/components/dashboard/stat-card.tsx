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
    iconBg: "bg-slate-50",
    iconColor: "text-slate-400",
    accent: "border-slate-100",
  },
  primary: {
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    accent: "border-indigo-100",
  },
  success: {
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    accent: "border-emerald-100",
  },
  warning: {
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    accent: "border-amber-100",
  },
  info: {
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    accent: "border-blue-100",
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
        "relative bg-white rounded-[24px] p-7 shadow-[0_2px_12px_-3px_rgba(0,0,0,0.04)] border border-slate-100 transition-all duration-300 hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.08)] hover:-translate-y-1",
        className
      )}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className={cn("rounded-2xl p-3.5 shadow-sm", styles.iconBg)}>
            {Icon && <Icon className={cn("h-6 w-6", styles.iconColor)} />}
          </div>
          {trend && (
            <span
              className={cn(
                "text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider",
                trend.isPositive
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-red-50 text-red-600"
              )}
            >
              {trend.isPositive ? "+" : "-"}
              {trend.value}%
            </span>
          )}
        </div>

        <div>
          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-[1px] mb-1">
            {title}
          </p>
          <div className="flex items-baseline gap-1">
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
              {isCurrency ? (
                <>
                  <span className="text-lg font-bold text-slate-400 mr-1">R$</span>
                  {value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </>
              ) : (
                value.toLocaleString("pt-BR")
              )}
            </h3>
          </div>
        </div>
      </div>
      
      {/* Subtle bottom accent line */}
      <div className={cn("absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-1 rounded-t-full transition-all duration-300 opacity-0 group-hover:opacity-100", styles.iconBg)} />
    </div>
  );
}
