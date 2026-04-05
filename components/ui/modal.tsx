"use client";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl"
};

export function Modal({ open, onClose, title, children, className, size = "md" }: ModalProps) {
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={cn(
              "relative w-full rounded-[16px] border border-[rgba(255,255,255,0.1)] bg-[#13131A] shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden",
              sizeMap[size],
              className
            )}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-6 py-4">
                <h2 className="font-heading text-base font-semibold text-white">{title}</h2>
                <button
                  onClick={onClose}
                  className="rounded-full p-1.5 text-[rgba(240,240,255,0.5)] hover:bg-[rgba(255,255,255,0.08)] hover:text-white transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
