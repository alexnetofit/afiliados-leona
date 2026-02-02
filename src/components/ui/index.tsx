// LEONA DESIGN SYSTEM v4.0
// Production Enterprise UI Components

import { forwardRef, ButtonHTMLAttributes, InputHTMLAttributes, HTMLAttributes, SelectHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { Loader2, LucideIcon, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// BUTTON - Clean, minimal with subtle hover
// ============================================
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "xs" | "sm" | "md" | "lg";
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
    "relative inline-flex items-center justify-center gap-1.5",
    "font-medium",
    "transition-colors duration-100",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
  );
  
  const variants = {
    primary: cn(
      "bg-primary-600 text-white",
      "hover:bg-primary-700",
      "focus-visible:ring-primary-500"
    ),
    secondary: cn(
      "bg-white text-zinc-700",
      "border border-zinc-200",
      "hover:bg-zinc-50 hover:border-zinc-300",
      "focus-visible:ring-zinc-400"
    ),
    ghost: cn(
      "bg-transparent text-zinc-600",
      "hover:bg-zinc-100 hover:text-zinc-900",
      "focus-visible:ring-zinc-400"
    ),
    danger: cn(
      "bg-error-600 text-white",
      "hover:bg-error-700",
      "focus-visible:ring-error-500"
    ),
    success: cn(
      "bg-success-600 text-white",
      "hover:bg-success-700",
      "focus-visible:ring-success-500"
    ),
  };
  
  const sizes = {
    xs: "h-6 px-2 text-xs rounded",
    sm: "h-7 px-2.5 text-xs rounded-md",
    md: "h-8 px-3 text-sm rounded-md",
    lg: "h-9 px-4 text-sm rounded-lg",
  };

  const iconSizes = {
    xs: "h-3 w-3",
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-4 w-4",
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
// INPUT - Clean with subtle focus
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
        <label className="block mb-1.5 text-xs font-medium text-zinc-600">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full h-8 px-2.5",
            Icon && "pl-8",
            RightIcon && "pr-8",
            "bg-white",
            "border border-zinc-200",
            "rounded-md",
            "text-zinc-900 text-sm",
            "placeholder:text-zinc-400",
            "transition-colors duration-100",
            "hover:border-zinc-300",
            "focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20",
            "disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed",
            error && "border-error-500 focus:border-error-500 focus:ring-error-500/20",
            className
          )}
          {...props}
        />
        {RightIcon && (
          <button
            type="button"
            onClick={onRightIconClick}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <RightIcon className="h-4 w-4" />
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-error-600">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1 text-xs text-zinc-500">{hint}</p>
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
        <label className="block mb-1.5 text-xs font-medium text-zinc-600">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={cn(
          "w-full px-2.5 py-2",
          "bg-white",
          "border border-zinc-200",
          "rounded-md",
          "text-zinc-900 text-sm font-mono",
          "placeholder:text-zinc-400",
          "transition-colors duration-100",
          "hover:border-zinc-300",
          "focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20",
          "disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed",
          "resize-none",
          error && "border-error-500 focus:border-error-500 focus:ring-error-500/20",
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-error-600">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1 text-xs text-zinc-500">{hint}</p>
      )}
    </div>
  );
});
Textarea.displayName = "Textarea";

// ============================================
// CARD - Clean with subtle border
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
        "bg-white rounded-lg",
        "border border-zinc-200",
        hover && "transition-shadow duration-150 hover:shadow-sm",
        gradient && "bg-gradient-to-br from-primary-50/50 to-white",
        !noPadding && "p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================
// BADGE - Clean pill
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
    default: "bg-zinc-100 text-zinc-600",
    success: "bg-success-50 text-success-700",
    warning: "bg-warning-50 text-warning-700",
    error: "bg-error-50 text-error-700",
    primary: "bg-primary-50 text-primary-700",
    info: "bg-info-50 text-info-700",
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
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-0.5 text-xs",
    lg: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1",
        "font-medium rounded-md",
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
// METRIC CARD - Compact stats
// ============================================
interface MetricCardProps {
  label: string;
  value: string;
  description?: string;
  icon?: LucideIcon;
  trend?: { value: number; positive: boolean };
  color?: "default" | "success" | "warning" | "error" | "primary" | "info";
  className?: string;
}

export function MetricCard({ label, value, description, icon: Icon, trend, color = "primary", className }: MetricCardProps) {
  const iconColors = {
    default: "bg-zinc-100 text-zinc-600",
    success: "bg-success-50 text-success-600",
    warning: "bg-warning-50 text-warning-600",
    error: "bg-error-50 text-error-600",
    primary: "bg-primary-50 text-primary-600",
    info: "bg-info-50 text-info-600",
  };

  return (
    <Card hover className={cn("", className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
            iconColors[color]
          )}>
            <Icon className="h-4.5 w-4.5" strokeWidth={2} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-zinc-500 truncate mb-0.5">{label}</p>
          <p className="text-lg font-semibold text-zinc-900 tracking-tight truncate">{value}</p>
          {description && (
            <div className="text-[11px] text-zinc-400 mt-0.5 whitespace-pre-line">{description}</div>
          )}
          {trend && (
            <div className={cn(
              "inline-flex items-center gap-1 mt-1 text-[10px] font-medium",
              trend.positive ? "text-success-600" : "text-error-600"
            )}>
              <span>{trend.positive ? "+" : ""}{trend.value}%</span>
              <span className="text-zinc-400">vs last month</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ============================================
// SELECT - Clean dropdown
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
        <label className="block mb-1.5 text-xs font-medium text-zinc-600">{label}</label>
      )}
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            "w-full h-8 pl-2.5 pr-8",
            "bg-white",
            "border border-zinc-200",
            "rounded-md",
            "text-zinc-900 text-sm",
            "transition-colors duration-100",
            "appearance-none cursor-pointer",
            "hover:border-zinc-300",
            "focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20",
            error && "border-error-500 focus:border-error-500 focus:ring-error-500/20",
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
      </div>
      {error && (
        <p className="mt-1 text-xs text-error-600">{error}</p>
      )}
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
  checked,
  ...props
}, ref) => {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer group">
      <div className="relative">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          className="peer sr-only"
          {...props}
        />
        <div className={cn(
          "h-4 w-4 rounded border",
          "border-zinc-300",
          "transition-colors duration-100",
          "peer-checked:bg-primary-600 peer-checked:border-primary-600",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-1",
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
// TABLE - Compact data table
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
  return <thead className="bg-zinc-50">{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-zinc-100">{children}</tbody>;
}

export function TableRow({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr 
      className={cn(
        "transition-colors duration-75",
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
      "py-2 px-3 text-left",
      "text-xs font-medium text-zinc-500",
      className
    )}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <td className={cn(
      "py-2.5 px-3 text-sm text-zinc-700",
      className
    )}>
      {children}
    </td>
  );
}

// ============================================
// LOADING SCREEN
// ============================================
export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] gap-3">
      <div className="relative">
        <div className="h-8 w-8 rounded-full border-2 border-zinc-200" />
        <div className="absolute top-0 left-0 h-8 w-8 rounded-full border-2 border-transparent border-t-primary-600 animate-spin" />
      </div>
      {message && (
        <p className="text-xs text-zinc-500">{message}</p>
      )}
    </div>
  );
}

// ============================================
// SPINNER
// ============================================
export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "h-3 w-3 border",
    md: "h-4 w-4 border-2",
    lg: "h-6 w-6 border-2",
  };

  return (
    <div className="relative inline-block">
      <div className={cn("rounded-full border-zinc-200", sizes[size])} />
      <div className={cn("absolute top-0 left-0 rounded-full border-transparent border-t-primary-600 animate-spin", sizes[size])} />
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
    <div className="py-12 px-4 text-center">
      {Icon && (
        <div className="h-10 w-10 mx-auto rounded-lg bg-zinc-100 flex items-center justify-center mb-3">
          <Icon className="h-5 w-5 text-zinc-400" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="text-sm font-medium text-zinc-900 mb-1">{title}</h3>
      {description && <p className="text-xs text-zinc-500 mb-4 max-w-xs mx-auto">{description}</p>}
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// ============================================
// AVATAR - Smaller, less rounded
// ============================================
interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export function Avatar({ src, name, size = "md", className }: AvatarProps) {
  const sizes = {
    xs: "h-5 w-5 text-[10px]",
    sm: "h-6 w-6 text-xs",
    md: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm",
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
          "rounded-md object-cover",
          sizes[size],
          className
        )}
      />
    );
  }

  return (
    <div className={cn(
      "rounded-md bg-primary-100 flex items-center justify-center font-medium text-primary-700",
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
      <div className={cn("flex items-center gap-3", className)}>
        <div className="flex-1 h-px bg-zinc-200" />
        <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">{label}</span>
        <div className="flex-1 h-px bg-zinc-200" />
      </div>
    );
  }

  return <div className={cn("h-px bg-zinc-200", className)} />;
}

// ============================================
// ALERT
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
      "flex items-start gap-2.5 p-3 rounded-lg border",
      variants[variant],
      className
    )}>
      {Icon && <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", iconColors[variant])} />}
      <div>
        {title && <p className="text-sm font-medium mb-0.5">{title}</p>}
        <p className="text-xs">{children}</p>
      </div>
    </div>
  );
}

// ============================================
// SKELETON
// ============================================
interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
}

export function Skeleton({ className, variant = "rectangular" }: SkeletonProps) {
  const variants = {
    text: "h-3 w-full rounded",
    circular: "rounded-full",
    rectangular: "rounded-md",
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
    sm: "h-1",
    md: "h-1.5",
    lg: "h-2",
  };

  const colors = {
    default: "bg-zinc-600",
    success: "bg-success-500",
    warning: "bg-warning-500",
    error: "bg-error-500",
    primary: "bg-primary-600",
  };

  return (
    <div className={cn("w-full", className)}>
      <div className={cn("w-full bg-zinc-200 rounded-full overflow-hidden", sizes[size])}>
        <div
          className={cn("h-full rounded-full transition-all duration-300", colors[variant])}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-[10px] text-zinc-500 mt-1 text-right">{Math.round(percentage)}%</p>
      )}
    </div>
  );
}

// ============================================
// PAGE SKELETON
// ============================================
interface PageSkeletonProps {
  variant?: "dashboard" | "list" | "detail";
}

export function PageSkeleton({ variant = "dashboard" }: PageSkeletonProps) {
  if (variant === "dashboard") {
    return (
      <div className="p-5 animate-pulse">
        <div className="max-w-[1200px] mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-40 mb-1.5" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-zinc-200 p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-20 mb-1.5" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg border border-zinc-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <Skeleton className="h-4 w-28 mb-1" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
            <Skeleton className="h-56 w-full rounded-md" />
          </div>

          <div className="bg-white rounded-lg border border-zinc-200 p-4">
            <div className="mb-4">
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-3 w-44" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-md bg-zinc-50">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <div>
                      <Skeleton className="h-3 w-20 mb-1" />
                      <Skeleton className="h-2.5 w-14" />
                    </div>
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-3 w-16 mb-1" />
                    <Skeleton className="h-4 w-14 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className="p-5 animate-pulse">
        <div className="max-w-[1200px] mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-40 mb-1.5" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-8 w-32 rounded-md" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-zinc-200 p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-20 mb-1.5" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
            <div className="bg-zinc-50 px-3 py-2 flex gap-4">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="divide-y divide-zinc-100">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="px-3 py-2.5 flex items-center gap-4">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-16 rounded-md" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 animate-pulse">
      <div className="max-w-[1200px] mx-auto space-y-5">
        <div>
          <Skeleton className="h-6 w-40 mb-1.5" />
          <Skeleton className="h-3 w-52" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-zinc-200 p-4 space-y-4">
              <Skeleton className="h-4 w-32" />
              <div className="space-y-3">
                <div>
                  <Skeleton className="h-3 w-20 mb-1.5" />
                  <Skeleton className="h-8 w-full rounded-md" />
                </div>
                <div>
                  <Skeleton className="h-3 w-20 mb-1.5" />
                  <Skeleton className="h-8 w-full rounded-md" />
                </div>
                <div>
                  <Skeleton className="h-3 w-20 mb-1.5" />
                  <Skeleton className="h-16 w-full rounded-md" />
                </div>
              </div>
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
