import * as React from "react";
import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
}

const DropdownMenu = ({ trigger, children, align = "end" }: DropdownMenuProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const alignments = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  };

  return (
    <div className="relative inline-flex" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>
      {isOpen && (
        <div
          className={cn(
            "absolute z-[var(--z-modal)] mt-1 min-w-[160px] rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-medium)] animate-fade-in",
            alignments[align]
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
};

interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
  destructive?: boolean;
}

const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ className, children, disabled, destructive, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
          "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
          destructive && "text-[var(--accent-red)] hover:bg-[var(--accent-red-soft)]",
          disabled && "pointer-events-none opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuSeparator = ({ className }: { className?: string }) => (
  <div className={cn("-mx-1 my-1 h-px bg-[var(--border-subtle)]", className)} />
);

const DropdownMenuLabel = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cn("px-2 py-1.5 text-xs font-semibold text-[var(--text-muted)]", className)}>
    {children}
  </div>
);

export { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel };
