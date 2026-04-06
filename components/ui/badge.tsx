import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all",
  {
    variants: {
      variant: {
        default: "bg-[rgba(108,99,255,0.2)] text-[#A78BFA] border border-[rgba(108,99,255,0.3)]",
        mint: "bg-[rgba(0,229,160,0.15)] text-[#00E5A0] border border-[rgba(0,229,160,0.3)]",
        danger: "bg-[rgba(255,77,109,0.15)] text-[#FF4D6D] border border-[rgba(255,77,109,0.3)]",
        surface: "bg-[rgba(255,255,255,0.06)] text-[rgba(240,240,255,0.7)] border border-[rgba(255,255,255,0.1)]",
        innovator: "bg-[rgba(108,99,255,0.2)] text-[#A78BFA] border border-[rgba(108,99,255,0.3)]",
        artist: "bg-[rgba(255,77,109,0.15)] text-[#FF8FAB] border border-[rgba(255,77,109,0.3)]",
        entrepreneur: "bg-[rgba(245,158,11,0.15)] text-[#FCD34D] border border-[rgba(245,158,11,0.3)]",
        "ai-pioneer": "bg-[rgba(0,229,160,0.15)] text-[#00E5A0] border border-[rgba(0,229,160,0.3)]"
      }
    },
    defaultVariants: { variant: "default" }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
