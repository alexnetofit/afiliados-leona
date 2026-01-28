"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[#3A1D7A] text-white hover:bg-[#5B3FA6] shadow-md hover:shadow-lg",
        secondary:
          "bg-[#C6BEF5] text-[#3A1D7A] hover:bg-[#8E7EEA]/30",
        outline:
          "border-2 border-[#E5E7F2] bg-transparent text-[#1F1F2E] hover:bg-[#F8F9FC] hover:border-[#8E7EEA]",
        ghost:
          "text-[#6B6F8D] hover:bg-[#F8F9FC] hover:text-[#1F1F2E]",
        link:
          "text-[#3A1D7A] underline-offset-4 hover:underline",
        destructive:
          "bg-red-500 text-white hover:bg-red-600",
        success:
          "bg-green-500 text-white hover:bg-green-600",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
