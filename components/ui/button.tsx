import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C75B12] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F] disabled:pointer-events-none disabled:opacity-40 cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-[#C75B12] text-white shadow-[0_0_20px_rgba(199,91,18,0.3)] hover:bg-[#AE4E10] hover:shadow-[0_0_30px_rgba(199,91,18,0.5)] active:scale-95",
        mint:
          "bg-[#2F9E44] text-white font-bold shadow-[0_0_20px_rgba(47,158,68,0.3)] hover:bg-[#288A3B] active:scale-95",
        outline:
          "border border-[rgba(255,255,255,0.15)] bg-transparent text-white hover:border-[#C75B12] hover:bg-[rgba(199,91,18,0.08)] active:scale-95",
        ghost:
          "bg-transparent text-[rgba(240,240,255,0.6)] hover:text-white hover:bg-[rgba(255,255,255,0.06)] active:scale-95",
        danger:
          "bg-[#D64545] text-white hover:bg-[#BD3D3D] active:scale-95",
        surface:
          "bg-[#1A1A24] border border-[rgba(255,255,255,0.08)] text-white hover:border-[#C75B12] hover:bg-[rgba(199,91,18,0.1)] active:scale-95"
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
