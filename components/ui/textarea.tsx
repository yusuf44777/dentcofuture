import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  showCount?: boolean;
  maxLength?: number;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, showCount, maxLength, value, ...props }, ref) => (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="text-xs font-semibold uppercase tracking-wider text-[rgba(240,240,255,0.5)]">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        maxLength={maxLength}
        value={value}
        className={cn(
          "w-full rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[#1A1A24] px-4 py-3 text-sm text-white placeholder:text-[rgba(240,240,255,0.3)] transition-all resize-none",
          "focus:border-[#C75B12] focus:bg-[rgba(199,91,18,0.05)] focus:shadow-[0_0_0_3px_rgba(199,91,18,0.15)]",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          error && "border-[#D64545]",
          className
        )}
        {...props}
      />
      <div className="flex justify-between">
        {error && <p className="text-xs text-[#D64545]">{error}</p>}
        {showCount && maxLength && (
          <p className="ml-auto text-xs text-[rgba(240,240,255,0.3)]">
            {String(value ?? "").length}/{maxLength}
          </p>
        )}
      </div>
    </div>
  )
);
Textarea.displayName = "Textarea";

export { Textarea };
