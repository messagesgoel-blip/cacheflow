import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "destructive" | "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-[var(--accent-blue-soft)] text-[var(--accent-blue)] border-[var(--accent-blue)]/20",
    secondary: "bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
    success: "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] border-[var(--accent-teal)]/20",
    warning: "bg-[var(--accent-amber-soft)] text-[var(--accent-amber)] border-[var(--accent-amber)]/20",
    destructive: "bg-[var(--accent-red-soft)] text-[var(--accent-red)] border-[var(--accent-red)]/20",
    outline: "bg-transparent text-[var(--text-secondary)] border-[var(--border-strong)]",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
