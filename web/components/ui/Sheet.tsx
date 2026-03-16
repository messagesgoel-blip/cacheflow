"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const Sheet = ({ open, onOpenChange, children }: SheetProps) => {
  return <>{children}</>;
};

interface SheetContentProps {
  side?: "top" | "bottom" | "left" | "right";
  onClose?: () => void;
  className?: string;
  children?: React.ReactNode;
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, side = "right", children, onClose }, ref) => {
    const sides = {
      top: "top-0 left-0 right-0 w-full animate-slide-in-up",
      bottom: "bottom-0 left-0 right-0 w-full animate-slide-in-down",
      left: "top-0 left-0 h-full animate-slide-in-left",
      right: "top-0 right-0 h-full animate-slide-in-right",
    };

    return (
      <>
        <div
          className="fixed inset-0 z-[var(--z-overlay)] bg-black/50 animate-fade-in"
          onClick={onClose}
        />
        <div
          ref={ref}
          className={cn(
            "fixed z-[var(--z-modal)] bg-[var(--bg-surface)] shadow-[var(--shadow-elevated)]",
            sides[side],
            className
          )}
        >
          {children}
        </div>
      </>
    );
  }
);
SheetContent.displayName = "SheetContent";

function SheetHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col space-y-2 p-4 border-b border-[var(--border-subtle)]", className)} {...props}>
      {children}
    </div>
  );
}

function SheetTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-lg font-semibold text-[var(--text-primary)]", className)} {...props}>
      {children}
    </h2>
  );
}

function SheetDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-[var(--text-secondary)]", className)} {...props}>
      {children}
    </p>
  );
}

function SheetFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-4 border-t border-[var(--border-subtle)]", className)} {...props}>
      {children}
    </div>
  );
}

function SheetClose(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cn("absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:ring-offset-2 disabled:pointer-events-none", props.className)} {...props}>
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </button>
  );
}

const SheetTrigger = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  return <button {...props} />;
};

export {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
};
