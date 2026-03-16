import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  indicatorClassName?: string;
  "data-testid"?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, indicatorClassName, "data-testid": dataTestId, ...props }, ref) => {
    const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
    const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), safeMax) : 0;
    const percentage = (safeValue / safeMax) * 100;

    return (
      <div
        ref={ref}
        data-testid={dataTestId || "progressbar"}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={Math.round(safeValue)}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-[var(--bg-hover)]",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full bg-[var(--accent-blue)] transition-all duration-300",
            indicatorClassName
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
