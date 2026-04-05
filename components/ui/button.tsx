import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F] disabled:pointer-events-none disabled:opacity-40 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-[#6C63FF] text-white shadow-[0_0_20px_rgba(108,99,255,0.3)] hover:bg-[#5a52e0] hover:shadow-[0_0_30px_rgba(108,99,255,0.5)] active:scale-95",
        mint:
          "bg-[#00E5A0] text-[#0A0A0F] font-bold shadow-[0_0_20px_rgba(0,229,160,0.3)] hover:bg-[#00cc8e] active:scale-95",
        outline:
          "border border-[rgba(255,255,255,0.15)] bg-transparent text-white hover:border-[#6C63FF] hover:bg-[rgba(108,99,255,0.08)] active:scale-95",
        ghost:
          "bg-transparent text-[rgba(240,240,255,0.6)] hover:text-white hover:bg-[rgba(255,255,255,0.06)] active:scale-95",
        danger:
          "bg-[#FF4D6D] text-white hover:bg-[#e63d5c] active:scale-95",
        surface:
          "bg-[#1A1A24] border border-[rgba(255,255,255,0.08)] text-white hover:border-[#6C63FF] hover:bg-[rgba(108,99,255,0.1)] active:scale-95"
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-5",
        lg: "h-12 px-7 text-base",
        xl: "h-14 px-8 text-lg",
        icon: "h-10 w-10 p-0"
      }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
