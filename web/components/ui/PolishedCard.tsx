import { ReactNode } from "react";

interface PolishedCardProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  variant?: "default" | "elevated" | "glass";
  onClick?: () => void;
}

export function PolishedCard({
  children,
  className = "",
  interactive = false,
  variant = "default",
  onClick
}: PolishedCardProps) {
  const baseStyles = "rounded-2xl border p-5 transition-all";
  const variantStyles = {
    default: "bg-[var(--bg-surface-raised)] border-[var(--border-subtle)] shadow-[var(--shadow-soft)]",
    elevated: "bg-[var(--bg-surface-raised)] border-[var(--border-subtle)] shadow-[var(--shadow-medium)]",
    glass: "glass border-[var(--border-subtle)] shadow-[var(--shadow-soft)]",
  };

  const interactiveStyles = interactive
    ? "cursor-pointer card-interactive hover:border-[var(--border-interactive)]"
    : "";

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${interactiveStyles} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
