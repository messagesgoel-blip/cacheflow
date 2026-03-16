"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

const Tooltip = ({ content, children, side = "top", delay = 300 }: TooltipProps) => {
  const [show, setShow] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = React.useId();

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setShow(true), delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShow(false);
  };

  const handleFocus = () => {
    timeoutRef.current = setTimeout(() => setShow(true), delay);
  };

  const handleBlur = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShow(false);
  };

  const positions = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <div aria-describedby={show ? tooltipId : undefined}>
        {children}
      </div>
      {show && (
        <div
          id={tooltipId}
          role="tooltip"
          className={cn(
            "absolute z-[var(--z-toast)] whitespace-nowrap rounded-md bg-[var(--bg-surface-raised)] px-3 py-1.5 text-xs text-[var(--text-primary)] shadow-[var(--shadow-medium)] animate-fade-in",
            positions[side]
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export { Tooltip };
