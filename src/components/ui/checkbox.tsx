"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const checkboxId = id || React.useId();

    return (
      <div className="flex items-center">
        <div className="relative">
          <input
            type="checkbox"
            id={checkboxId}
            className={cn(
              "peer h-5 w-5 cursor-pointer appearance-none rounded border-2 border-border bg-surface",
              "checked:border-primary checked:bg-primary",
              "focus:outline-none focus:ring-2 focus:ring-primary-lighter focus:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "transition-colors duration-200",
              className
            )}
            ref={ref}
            {...props}
          />
          <Check className="absolute left-0.5 top-0.5 h-4 w-4 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
        </div>
        {label && (
          <label
            htmlFor={checkboxId}
            className="ml-2 text-sm font-medium text-text-primary cursor-pointer select-none"
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
