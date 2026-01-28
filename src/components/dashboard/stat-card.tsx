"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number;
  isCurrency?: boolean;
  icon?: LucideIcon;
  variant?: "default" | "primary" | "success" | "warning";
  className?: string;
}

const variantStyles = {
  default: {
    iconBg: "bg-[#EEF0F6]",
    iconColor: "text-[#6B6F8D]",
  },
  primary: {
    iconBg: "bg-[#3A1D7A]/10",
    iconColor: "text-[#3A1D7A]",
  },
  success: {
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  warning: {
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
};

export function StatCard({
  title,
  value,
  isCurrency = false,
  icon: Icon,
  variant = "default",
  className,
}: StatCardProps) {
  const styles = variantStyles[variant];

  const formattedValue = isCurrency
    ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : value.toLocaleString("pt-BR");

  return (
    <div className={cn(
      "bg-white rounded-2xl p-6 border border-[#E5E7F2] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(58,29,122,0.06)] transition-all hover:shadow-[0_1px_3px_rgba(0,0,0,0.04),0_12px_32px_rgba(58,29,122,0.10)]",
      className
    )}>
      <div className="flex items-center gap-4">
        {Icon && (
          <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center", styles.iconBg)}>
            <Icon className={cn("h-5 w-5", styles.iconColor)} strokeWidth={1.75} />
          </div>
        )}
        <div>
          <p className="text-sm text-[#6B6F8D]">{title}</p>
          <p className="text-2xl font-semibold text-[#1F1F2E] tracking-tight">{formattedValue}</p>
        </div>
      </div>
    </div>
  );
}
