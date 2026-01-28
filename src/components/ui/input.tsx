"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, hint, id, ...props }, ref) => {
    const inputId = id || React.useId();
    
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[#1F1F2E] mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          className={cn(
            "flex h-10 w-full rounded-lg border border-[#E5E7F2] bg-white px-3 py-2 text-sm text-[#1F1F2E]",
            "placeholder:text-[#6B6F8D]/60",
            "focus:outline-none focus:ring-2 focus:ring-[#8E7EEA] focus:border-[#8E7EEA]",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#F8F9FC]",
            "transition-colors duration-200",
            error && "border-red-500 focus:ring-red-300 focus:border-red-500",
            className
          )}
          ref={ref}
          {...props}
        />
        {hint && !error && (
          <p className="mt-1.5 text-xs text-[#6B6F8D]">{hint}</p>
        )}
        {error && (
          <p className="mt-1.5 text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
