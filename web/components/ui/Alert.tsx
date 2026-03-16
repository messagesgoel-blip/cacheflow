import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Info, XCircle } from "lucide-react";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "success" | "warning" | "destructive" | "info";
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const variants = {
      default: "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-primary)]",
      success: "bg-[var(--accent-teal-soft)] border-[var(--accent-teal)]/30 text-[var(--accent-teal)]",
      warning: "bg-[var(--accent-amber-soft)] border-[var(--accent-amber)]/30 text-[var(--accent-amber)]",
      destructive: "bg-[var(--accent-red-soft)] border-[var(--accent-red)]/30 text-[var(--accent-red)]",
      info: "bg-[var(--accent-blue-soft)] border-[var(--accent-blue)]/30 text-[var(--accent-blue)]",
    };

    const icons = {
      default: Info,
      success: CheckCircle,
      warning: AlertCircle,
      destructive: XCircle,
      info: Info,
    };

    const Icon = icons[variant];

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex gap-3 rounded-lg border p-4",
          variants[variant],
          className
        )}
        {...props}
      >
        <Icon className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="text-sm">{children}</div>
      </div>
    );
  }
);
Alert.displayName = "Alert";

const AlertTitle = ({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h5 className={cn("font-semibold mb-1", className)} {...props}>
    {children}
  </h5>
);

const AlertDescription = ({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <div className={cn("text-sm opacity-90", className)} {...props}>
    {children}
  </div>
);

export { Alert, AlertTitle, AlertDescription };
