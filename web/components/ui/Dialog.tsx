"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const DialogContext = React.createContext<{ open: boolean; onOpenChange?: (open: boolean) => void }>({ open: false });

const Dialog = ({ open = false, onOpenChange, children }: DialogProps) => {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
};

const DialogTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ ...props }, ref) => <button ref={ref} {...props} />
);
DialogTrigger.displayName = "DialogTrigger";

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  onClose?: () => void;
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, onClose, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(DialogContext);
    const dialogId = React.useId();

    React.useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && open) {
          onClose?.();
          onOpenChange?.(false);
        }
      };
      
      if (open) {
        document.addEventListener("keydown", handleKeyDown);
        // Prevent body scroll when dialog is open
        document.body.style.overflow = "hidden";
      }
      
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }, [open, onClose, onOpenChange]);

    if (!open) return null;

    return (
      <>
        <div 
          className="fixed inset-0 z-[var(--z-overlay)] bg-black/50 animate-fade-in"
          onClick={() => {
            onClose?.();
            onOpenChange?.(false);
          }}
        />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`dialog-title-${dialogId}`}
          aria-describedby={`dialog-description-${dialogId}`}
          className={cn(
            "fixed left-[50%] top-[50%] z-[var(--z-modal)] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-elevated)] animate-scale-in rounded-xl",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </>
    );
  }
);
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props}>
    {children}
  </div>
);

const DialogFooter = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props}>
    {children}
  </div>
);

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => {
    const dialogId = React.useId();
    return (
      <h2
        ref={ref}
        id={`dialog-title-${dialogId}`}
        className={cn("text-lg font-semibold leading-none tracking-tight", className)}
        {...props}
      >
        {children}
      </h2>
    );
  }
);
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => {
    const dialogId = React.useId();
    return (
      <p
        ref={ref}
        id={`dialog-description-${dialogId}`}
        className={cn("text-sm text-[var(--text-secondary)]", className)}
        {...props}
      >
        {children}
      </p>
    );
  }
);
DialogDescription.displayName = "DialogDescription";

const DialogClose = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => {
    const { onOpenChange } = React.useContext(DialogContext);
    return (
      <button
        ref={ref}
        className={cn(
          "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:ring-offset-2 disabled:pointer-events-none",
          className
        )}
        onClick={() => onOpenChange?.(false)}
        {...props}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </button>
    );
  }
);
DialogClose.displayName = "DialogClose";

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
};
