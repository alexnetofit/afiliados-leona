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
  variant?: "default" | "primary" | "success" | "warning";
  className?: string;
}

const variantStyles = {
  default: {
    bg: "bg-surface",
    iconBg: "bg-background",
    iconColor: "text-text-secondary",
  },
  primary: {
    bg: "bg-gradient-leona",
    iconBg: "bg-white/20",
    iconColor: "text-white",
  },
  success: {
    bg: "bg-surface",
    iconBg: "bg-success-light",
    iconColor: "text-success",
  },
  warning: {
    bg: "bg-surface",
    iconBg: "bg-warning-light",
    iconColor: "text-warning",
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
  const isPrimary = variant === "primary";

  return (
    <div
      className={cn(
        "rounded-xl p-6 shadow-card transition-shadow hover:shadow-card-hover",
        styles.bg,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p
            className={cn(
              "text-sm font-medium",
              isPrimary ? "text-white/80" : "text-text-secondary"
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              "mt-2 text-3xl font-bold",
              isPrimary ? "text-white" : "text-text-primary"
            )}
          >
            {isCurrency ? formatCurrency(value) : value.toLocaleString("pt-BR")}
          </p>
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={cn(
                  "text-xs font-medium",
                  trend.isPositive
                    ? isPrimary
                      ? "text-white"
                      : "text-success"
                    : isPrimary
                    ? "text-white/80"
                    : "text-error"
                )}
              >
                {trend.isPositive ? "+" : ""}
                {trend.value}%
              </span>
              <span
                className={cn(
                  "text-xs",
                  isPrimary ? "text-white/60" : "text-text-secondary"
                )}
              >
                vs mês anterior
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn("rounded-lg p-3", styles.iconBg)}>
            <Icon className={cn("h-6 w-6", styles.iconColor)} />
          </div>
        )}
      </div>
    </div>
  );
}
