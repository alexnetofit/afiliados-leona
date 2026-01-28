// LEONA DESIGN SYSTEM v2.0
// Componentes Base - Construídos do zero

import { forwardRef, ButtonHTMLAttributes, InputHTMLAttributes, HTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";
import { Loader2, LucideIcon } from "lucide-react";

// ============================================
// BUTTON
// ============================================
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon: Icon,
  disabled,
  className = "",
  ...props
}, ref) => {
  const baseStyles = "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-[#5B21B6] text-white hover:bg-[#4C1D95] active:bg-[#4C1D95]",
    secondary: "bg-white text-[#111827] border border-[#E8EAF0] hover:bg-[#F8F9FC] active:bg-[#F1F3F7]",
    ghost: "bg-transparent text-[#6B7280] hover:bg-[#F8F9FC] hover:text-[#111827]",
    danger: "bg-[#DC2626] text-white hover:bg-[#B91C1C]",
  };
  
  const sizes = {
    sm: "h-8 px-3 text-sm rounded-lg",
    md: "h-10 px-4 text-sm rounded-[10px]",
    lg: "h-12 px-6 text-base rounded-xl",
  };

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : Icon ? (
        <Icon className="h-4 w-4" />
      ) : null}
      {children}
    </button>
  );
});
Button.displayName = "Button";

// ============================================
// INPUT
// ============================================
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: LucideIcon;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  icon: Icon,
  className = "",
  ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block mb-2 text-sm font-medium text-[#111827]">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <input
          ref={ref}
          className={`
            w-full h-11 px-4 ${Icon ? "pl-12" : ""}
            bg-white border border-[#E8EAF0] rounded-xl
            text-[#111827] text-sm placeholder:text-[#9CA3AF]
            transition-all duration-150
            hover:border-[#D1D5DB]
            focus:outline-none focus:border-[#5B21B6] focus:ring-4 focus:ring-[#5B21B6]/10
            disabled:bg-[#F8F9FC] disabled:cursor-not-allowed
            ${error ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/10" : ""}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-2 text-sm text-[#DC2626]">{error}</p>
      )}
    </div>
  );
});
Input.displayName = "Input";

// ============================================
// CARD
// ============================================
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md" | "lg";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(({
  children,
  padding = "md",
  className = "",
  ...props
}, ref) => {
  const paddings = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <div
      ref={ref}
      className={`
        bg-white rounded-2xl border border-[#E8EAF0]
        shadow-[0_1px_3px_0_rgb(0_0_0/0.04),0_4px_16px_0_rgb(0_0_0/0.04)]
        ${paddings[padding]}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
});
Card.displayName = "Card";

// ============================================
// BADGE
// ============================================
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "primary";
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(({
  children,
  variant = "default",
  className = "",
  ...props
}, ref) => {
  const variants = {
    default: "bg-[#F1F3F7] text-[#6B7280]",
    success: "bg-[#D1FAE5] text-[#059669]",
    warning: "bg-[#FEF3C7] text-[#D97706]",
    error: "bg-[#FEE2E2] text-[#DC2626]",
    primary: "bg-[#EDE9FE] text-[#5B21B6]",
  };

  return (
    <span
      ref={ref}
      className={`
        inline-flex items-center gap-1 px-2.5 py-1
        text-xs font-medium rounded-md
        ${variants[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
});
Badge.displayName = "Badge";

// ============================================
// METRIC CARD
// ============================================
interface MetricCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  trend?: { value: number; positive: boolean };
}

export function MetricCard({ label, value, icon: Icon, trend }: MetricCardProps) {
  return (
    <Card className="flex items-start gap-4">
      {Icon && (
        <div className="h-12 w-12 rounded-xl bg-[#F8F9FC] flex items-center justify-center shrink-0">
          <Icon className="h-6 w-6 text-[#6B7280]" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#6B7280] truncate">{label}</p>
        <p className="text-2xl font-semibold text-[#111827] tracking-tight mt-1">{value}</p>
        {trend && (
          <p className={`text-xs font-medium mt-1 ${trend.positive ? "text-[#059669]" : "text-[#DC2626]"}`}>
            {trend.positive ? "+" : "-"}{trend.value}% vs mês anterior
          </p>
        )}
      </div>
    </Card>
  );
}

// ============================================
// SELECT
// ============================================
interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  options,
  label,
  className = "",
  ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block mb-2 text-sm font-medium text-[#111827]">{label}</label>
      )}
      <select
        ref={ref}
        className={`
          w-full h-11 px-4
          bg-white border border-[#E8EAF0] rounded-xl
          text-[#111827] text-sm
          focus:outline-none focus:border-[#5B21B6] focus:ring-4 focus:ring-[#5B21B6]/10
          transition-all cursor-pointer
          ${className}
        `}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
});
Select.displayName = "Select";

// ============================================
// CHECKBOX
// ============================================
interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
  label,
  className = "",
  ...props
}, ref) => {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input
        ref={ref}
        type="checkbox"
        className={`
          h-4 w-4 rounded border-[#E8EAF0]
          text-[#5B21B6] focus:ring-[#5B21B6]/20
          cursor-pointer
          ${className}
        `}
        {...props}
      />
      {label && <span className="text-sm text-[#111827]">{label}</span>}
    </label>
  );
});
Checkbox.displayName = "Checkbox";

// ============================================
// TABLE
// ============================================
export function Table({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <table className={`w-full ${className}`}>{children}</table>;
}

export function TableHeader({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={`border-b border-[#F1F3F7] last:border-0 ${className}`}>{children}</tr>;
}

export function TableHead({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`py-3 px-4 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wide ${className}`}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`py-4 px-4 text-sm text-[#111827] ${className}`}>{children}</td>;
}

// ============================================
// LOADING SCREEN
// ============================================
export function LoadingScreen() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-[#5B21B6]" />
    </div>
  );
}

// ============================================
// EMPTY STATE
// ============================================
interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="py-16 text-center">
      {Icon && (
        <div className="h-12 w-12 mx-auto rounded-xl bg-[#F8F9FC] flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-[#9CA3AF]" />
        </div>
      )}
      <p className="text-[#111827] font-medium">{title}</p>
      {description && <p className="text-sm text-[#6B7280] mt-1">{description}</p>}
      {action && (
        <Button onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
}
