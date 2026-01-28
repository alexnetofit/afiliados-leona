// LEONA DESIGN SYSTEM v3.0
// Premium Modern UI Components

import { forwardRef, ButtonHTMLAttributes, InputHTMLAttributes, HTMLAttributes, SelectHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { Loader2, LucideIcon, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// BUTTON - Premium with gradient and glow
// ============================================
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg" | "xl";
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon: Icon,
  iconPosition = "left",
  disabled,
  className = "",
  ...props
}, ref) => {
  const baseStyles = cn(
    "relative inline-flex items-center justify-center gap-2",
    "font-semibold tracking-tight",
    "transition-all duration-200 ease-out",
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
    "active:scale-[0.98]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
  );
  
  const variants = {
    primary: cn(
      "bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800",
      "text-white",
      "shadow-primary hover:shadow-primary-lg",
      "hover:from-primary-500 hover:via-primary-600 hover:to-primary-700",
      "focus-visible:ring-primary-500"
    ),
    secondary: cn(
      "bg-white text-zinc-900",
      "border border-zinc-200",
      "shadow-sm hover:shadow-md",
      "hover:bg-zinc-50 hover:border-zinc-300",
      "focus-visible:ring-zinc-400"
    ),
    ghost: cn(
      "bg-transparent text-zinc-600",
      "hover:bg-zinc-100 hover:text-zinc-900",
      "focus-visible:ring-zinc-400"
    ),
    danger: cn(
      "bg-gradient-to-r from-error-500 to-error-600",
      "text-white",
      "shadow-error hover:shadow-lg",
      "hover:from-error-400 hover:to-error-500",
      "focus-visible:ring-error-500"
    ),
    success: cn(
      "bg-gradient-to-r from-success-500 to-success-600",
      "text-white",
      "shadow-success hover:shadow-lg",
      "hover:from-success-400 hover:to-success-500",
      "focus-visible:ring-success-500"
    ),
  };
  
  const sizes = {
    sm: "h-8 px-3 text-xs rounded-lg",
    md: "h-10 px-4 text-sm rounded-xl",
    lg: "h-12 px-6 text-sm rounded-xl",
    xl: "h-14 px-8 text-base rounded-2xl",
  };

  const iconSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
    xl: "h-5 w-5",
  };

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading ? (
        <Loader2 className={cn(iconSizes[size], "animate-spin")} />
      ) : Icon && iconPosition === "left" ? (
        <Icon className={iconSizes[size]} />
      ) : null}
      {children}
      {!loading && Icon && iconPosition === "right" && (
        <Icon className={iconSizes[size]} />
      )}
    </button>
  );
});
Button.displayName = "Button";

// ============================================
// INPUT - Premium with focus glow
// ============================================
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: LucideIcon;
  rightIcon?: LucideIcon;
  onRightIconClick?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  hint,
  icon: Icon,
  rightIcon: RightIcon,
  onRightIconClick,
  className = "",
  ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block mb-2 text-sm font-medium text-zinc-700">
          {label}
        </label>
      )}
      <div className="relative group">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-primary-600 transition-colors">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full h-12 px-4",
            Icon && "pl-12",
            RightIcon && "pr-12",
            "bg-white",
            "border-2 border-zinc-200",
            "rounded-xl",
            "text-zinc-900 text-sm",
            "placeholder:text-zinc-400",
            "transition-all duration-200",
            "hover:border-zinc-300",
            "focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10",
            "disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed",
            error && "border-error-500 focus:border-error-500 focus:ring-error-500/10",
            className
          )}
          {...props}
        />
        {RightIcon && (
          <button
            type="button"
            onClick={onRightIconClick}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <RightIcon className="h-5 w-5" />
          </button>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-error-600 flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-error-500" />
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="mt-2 text-sm text-zinc-500">{hint}</p>
      )}
    </div>
  );
});
Input.displayName = "Input";

// ============================================
// TEXTAREA
// ============================================
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  error,
  hint,
  className = "",
  ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block mb-2 text-sm font-medium text-zinc-700">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={cn(
          "w-full px-4 py-3",
          "bg-white",
          "border-2 border-zinc-200",
          "rounded-xl",
          "text-zinc-900 text-sm font-mono",
          "placeholder:text-zinc-400",
          "transition-all duration-200",
          "hover:border-zinc-300",
          "focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10",
          "disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed",
          "resize-none",
          error && "border-error-500 focus:border-error-500 focus:ring-error-500/10",
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-2 text-sm text-error-600">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-2 text-sm text-zinc-500">{hint}</p>
      )}
    </div>
  );
});
Textarea.displayName = "Textarea";

// ============================================
// CARD - Premium with subtle gradient border
// ============================================
interface CardProps {
  children?: ReactNode;
  noPadding?: boolean;
  className?: string;
  hover?: boolean;
  gradient?: boolean;
}

export function Card({ children, noPadding = false, className = "", hover = false, gradient = false }: CardProps) {
  return (
    <div
      className={cn(
        "relative bg-white rounded-2xl",
        "border border-zinc-200/80",
        "shadow-card",
        hover && "transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5",
        gradient && "before:absolute before:inset-0 before:rounded-2xl before:p-[1px] before:bg-gradient-to-br before:from-primary-200/50 before:via-transparent before:to-transparent before:-z-10",
        !noPadding && "p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================
// BADGE - Premium with subtle gradients
// ============================================
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "primary" | "info";
  size?: "sm" | "md" | "lg";
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(({
  children,
  variant = "default",
  size = "md",
  dot = false,
  className = "",
  ...props
}, ref) => {
  const variants = {
    default: "bg-zinc-100 text-zinc-600 border-zinc-200",
    success: "bg-success-50 text-success-700 border-success-200",
    warning: "bg-warning-50 text-warning-700 border-warning-200",
    error: "bg-error-50 text-error-700 border-error-200",
    primary: "bg-primary-50 text-primary-700 border-primary-200",
    info: "bg-info-50 text-info-700 border-info-200",
  };

  const dotColors = {
    default: "bg-zinc-400",
    success: "bg-success-500",
    warning: "bg-warning-500",
    error: "bg-error-500",
    primary: "bg-primary-500",
    info: "bg-info-500",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  };

  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5",
        "font-medium rounded-full",
        "border",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn("w-1.5 h-1.5 rounded-full", dotColors[variant])} />
      )}
      {children}
    </span>
  );
});
Badge.displayName = "Badge";

// ============================================
// METRIC CARD - Premium stats display
// ============================================
interface MetricCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  trend?: { value: number; positive: boolean };
  color?: "default" | "success" | "warning" | "error" | "primary" | "info";
  className?: string;
}

export function MetricCard({ label, value, icon: Icon, trend, color = "primary", className }: MetricCardProps) {
  const iconColors = {
    default: "bg-zinc-100 text-zinc-600",
    success: "bg-success-100 text-success-600",
    warning: "bg-warning-100 text-warning-600",
    error: "bg-error-100 text-error-600",
    primary: "bg-primary-100 text-primary-600",
    info: "bg-info-100 text-info-600",
  };

  return (
    <Card hover className={cn("overflow-hidden", className)}>
      <div className="flex items-start gap-4">
        {Icon && (
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
            iconColors[color]
          )}>
            <Icon className="h-6 w-6" strokeWidth={1.75} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-500 truncate mb-1">{label}</p>
          <p className="text-2xl font-bold text-zinc-900 tracking-tight truncate">{value}</p>
          {trend && (
            <div className={cn(
              "inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium",
              trend.positive ? "bg-success-100 text-success-700" : "bg-error-100 text-error-700"
            )}>
              <span>{trend.positive ? "+" : ""}{trend.value}%</span>
              <span className="text-[10px] opacity-70">vs mês anterior</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ============================================
// SELECT - Premium dropdown
// ============================================
interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  options,
  label,
  error,
  className = "",
  ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block mb-2 text-sm font-medium text-zinc-700">{label}</label>
      )}
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            "w-full h-12 pl-4 pr-10",
            "bg-white",
            "border-2 border-zinc-200",
            "rounded-xl",
            "text-zinc-900 text-sm",
            "transition-all duration-200",
            "appearance-none cursor-pointer",
            "hover:border-zinc-300",
            "focus:outline-none focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10",
            error && "border-error-500 focus:border-error-500 focus:ring-error-500/10",
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
      </div>
      {error && (
        <p className="mt-2 text-sm text-error-600">{error}</p>
      )}
    </div>
  );
});
Select.displayName = "Select";

// ============================================
// CHECKBOX - Premium toggle
// ============================================
interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(({
  label,
  className = "",
  checked,
  ...props
}, ref) => {
  return (
    <label className="inline-flex items-center gap-3 cursor-pointer group">
      <div className="relative">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          className="peer sr-only"
          {...props}
        />
        <div className={cn(
          "h-5 w-5 rounded-md border-2",
          "border-zinc-300",
          "transition-all duration-200",
          "peer-checked:bg-primary-600 peer-checked:border-primary-600",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2",
          "group-hover:border-zinc-400 peer-checked:group-hover:bg-primary-500",
          className
        )} />
        <Check className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
      </div>
      {label && <span className="text-sm text-zinc-700 select-none">{label}</span>}
    </label>
  );
});
Checkbox.displayName = "Checkbox";

// ============================================
// TABLE - Premium data table
// ============================================
interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className = "" }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full", className)}>{children}</table>
    </div>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  return <thead className="bg-zinc-50/80">{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-zinc-100">{children}</tbody>;
}

export function TableRow({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr 
      className={cn(
        "transition-colors",
        onClick && "cursor-pointer hover:bg-zinc-50",
        className
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function TableHead({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cn(
      "py-3.5 px-4 text-left",
      "text-xs font-semibold text-zinc-500 uppercase tracking-wider",
      "first:rounded-tl-lg last:rounded-tr-lg",
      className
    )}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <td className={cn(
      "py-4 px-4 text-sm text-zinc-700",
      className
    )}>
      {children}
    </td>
  );
}

// ============================================
// LOADING SCREEN - Premium spinner
// ============================================
export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="relative">
        <div className="h-12 w-12 rounded-full border-4 border-zinc-200" />
        <div className="absolute top-0 left-0 h-12 w-12 rounded-full border-4 border-transparent border-t-primary-600 animate-spin" />
      </div>
      {message && (
        <p className="text-sm text-zinc-500 animate-pulse">{message}</p>
      )}
    </div>
  );
}

// ============================================
// LOADING SPINNER - Inline version
// ============================================
export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-3",
  };

  return (
    <div className="relative inline-block">
      <div className={cn("rounded-full border-zinc-200", sizes[size])} />
      <div className={cn("absolute top-0 left-0 rounded-full border-transparent border-t-primary-600 animate-spin", sizes[size])} />
    </div>
  );
}

// ============================================
// EMPTY STATE - Premium placeholder
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
    <div className="py-16 px-6 text-center">
      {Icon && (
        <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-50 flex items-center justify-center mb-5">
          <Icon className="h-8 w-8 text-zinc-400" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="text-lg font-semibold text-zinc-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-zinc-500 mb-6 max-w-sm mx-auto">{description}</p>}
      {action && (
        <Button onClick={action.onClick} size="lg">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ============================================
// AVATAR - User avatar with fallback
// ============================================
interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Avatar({ src, name, size = "md", className }: AvatarProps) {
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-16 w-16 text-lg",
  };

  const initials = name
    ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  if (src) {
    return (
      <img
        src={src}
        alt={name || "Avatar"}
        className={cn(
          "rounded-full object-cover ring-2 ring-white shadow-md",
          sizes[size],
          className
        )}
      />
    );
  }

  return (
    <div className={cn(
      "rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center font-semibold text-white ring-2 ring-white shadow-md",
      sizes[size],
      className
    )}>
      {initials}
    </div>
  );
}

// ============================================
// DIVIDER
// ============================================
interface DividerProps {
  label?: string;
  className?: string;
}

export function Divider({ label, className }: DividerProps) {
  if (label) {
    return (
      <div className={cn("flex items-center gap-4", className)}>
        <div className="flex-1 h-px bg-zinc-200" />
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</span>
        <div className="flex-1 h-px bg-zinc-200" />
      </div>
    );
  }

  return <div className={cn("h-px bg-zinc-200", className)} />;
}

// ============================================
// ALERT - Notification banner
// ============================================
interface AlertProps {
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
  children: ReactNode;
  icon?: LucideIcon;
  className?: string;
}

export function Alert({ variant = "info", title, children, icon: Icon, className }: AlertProps) {
  const variants = {
    info: "bg-info-50 border-info-200 text-info-800",
    success: "bg-success-50 border-success-200 text-success-800",
    warning: "bg-warning-50 border-warning-200 text-warning-800",
    error: "bg-error-50 border-error-200 text-error-800",
  };

  const iconColors = {
    info: "text-info-500",
    success: "text-success-500",
    warning: "text-warning-500",
    error: "text-error-500",
  };

  return (
    <div className={cn(
      "flex items-start gap-3 p-4 rounded-xl border",
      variants[variant],
      className
    )}>
      {Icon && <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", iconColors[variant])} />}
      <div>
        {title && <p className="font-semibold mb-1">{title}</p>}
        <p className="text-sm opacity-90">{children}</p>
      </div>
    </div>
  );
}

// ============================================
// SKELETON - Loading placeholder
// ============================================
interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
}

export function Skeleton({ className, variant = "rectangular" }: SkeletonProps) {
  const variants = {
    text: "h-4 w-full rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };

  return (
    <div className={cn(
      "bg-zinc-200 animate-pulse",
      variants[variant],
      className
    )} />
  );
}

// ============================================
// PROGRESS BAR
// ============================================
interface ProgressProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "success" | "warning" | "error" | "primary";
  showLabel?: boolean;
  className?: string;
}

export function Progress({ value, max = 100, size = "md", variant = "primary", showLabel, className }: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizes = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  };

  const colors = {
    default: "bg-zinc-600",
    success: "bg-success-500",
    warning: "bg-warning-500",
    error: "bg-error-500",
    primary: "bg-gradient-to-r from-primary-500 to-primary-600",
  };

  return (
    <div className={cn("w-full", className)}>
      <div className={cn("w-full bg-zinc-200 rounded-full overflow-hidden", sizes[size])}>
        <div
          className={cn("h-full rounded-full transition-all duration-500 ease-out", colors[variant])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-zinc-500 mt-1 text-right">{Math.round(percentage)}%</p>
      )}
    </div>
  );
}
