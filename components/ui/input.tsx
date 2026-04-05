import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Icon/element shown on the left side of the input */
  inputPrefix?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, inputPrefix, type = "text", ...props }, ref) => (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="text-xs font-semibold uppercase tracking-wider text-[rgba(240,240,255,0.5)]">
          {label}
        </label>
      )}
      <div className="relative">
        {inputPrefix && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(240,240,255,0.4)]">
            {inputPrefix}
          </div>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            "w-full rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#1A1A24] px-4 py-3 text-sm text-white placeholder:text-[rgba(240,240,255,0.3)] transition-all",
            "focus:border-[#6C63FF] focus:bg-[rgba(108,99,255,0.05)] focus:shadow-[0_0_0_3px_rgba(108,99,255,0.15)]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            error && "border-[#FF4D6D] focus:border-[#FF4D6D] focus:shadow-[0_0_0_3px_rgba(255,77,109,0.15)]",
            inputPrefix && "pl-9",
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-[#FF4D6D]">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";

export { Input };
