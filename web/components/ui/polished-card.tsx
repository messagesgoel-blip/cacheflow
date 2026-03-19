import { ReactNode } from "react";
import { cn } from "../../lib/utils";

/**
 * Props for the PolishedCard component.
 */
interface PolishedCardProps {
  /** The content to be rendered inside the card. */
  children: ReactNode;
  /** Optional additional CSS classes. */
  className?: string;
  /** Whether the card should show hover effects and change cursor to pointer. */
  interactive?: boolean;
  /** The visual style variant of the card. */
  variant?: "default" | "elevated" | "glass";
  /** Optional click handler for interactive cards. */
  onClick?: () => void;
}

/**
 * A highly reusable card component with consistent padding, 
 * border-radius, and multiple visual variants (default, elevated, glass).
 */
export function PolishedCard({ 
  children, 
  className, 
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
      className={cn(
        baseStyles,
        variantStyles[variant],
        interactiveStyles,
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
