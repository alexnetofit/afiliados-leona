"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: number;
  isCurrency?: boolean;
  icon?: LucideIcon;
  variant?: "default" | "primary" | "success" | "warning" | "info";
  className?: string;
}

const variantStyles = {
  default: {
    iconBg: "bg-gray-100",
    iconColor: "text-gray-500",
  },
  primary: {
    iconBg: "bg-violet-100",
    iconColor: "text-violet-600",
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
  variant = "default",
  className,
}: StatCardProps) {
  const styles = variantStyles[variant];

  const formattedValue = isCurrency
    ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : value.toLocaleString("pt-BR");

  return (
    <div className={cn(
      "bg-white rounded-2xl p-6 border border-gray-100 shadow-sm",
      className
    )}>
      <div className="flex items-start justify-between">
        {Icon && (
          <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", styles.iconBg)}>
            <Icon className={cn("h-6 w-6", styles.iconColor)} />
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{formattedValue}</p>
      </div>
    </div>
  );
}
