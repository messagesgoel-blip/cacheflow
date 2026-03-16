"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface AccordionItem {
  value: string;
  title: string;
  content: React.ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  type?: "single" | "multiple";
  defaultValue?: string | string[];
  className?: string;
}

const Accordion = ({ items, type = "single", defaultValue, className }: AccordionProps) => {
  const [openValues, setOpenValues] = React.useState<string[]>(
    Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : []
  );

  const handleToggle = (value: string) => {
    if (type === "single") {
      setOpenValues(openValues.includes(value) ? [] : [value]);
    } else {
      setOpenValues((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    }
  };

  return (
    <div className={cn("divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)]", className)}>
      {items.map((item) => {
        const isOpen = openValues.includes(item.value);
        return (
          <div key={item.value}>
            <button
              type="button"
              onClick={() => handleToggle(item.value)}
              className={cn(
                "flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium",
                "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
                "transition-colors"
              )}
            >
              {item.title}
              <span className={cn("transition-transform", isOpen && "rotate-180")}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>
            {isOpen && <div className="px-4 pb-3 text-sm text-[var(--text-secondary)]">{item.content}</div>}
          </div>
        );
      })}
    </div>
  );
};

export { Accordion };
