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
  // Normalize defaultValue for single mode
  const getInitialValue = () => {
    if (type === "single") {
      return Array.isArray(defaultValue) 
        ? (defaultValue[0] ? [defaultValue[0]] : [])
        : defaultValue 
          ? [defaultValue] 
          : [];
    }
    return Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : [];
  };

  const [openValues, setOpenValues] = React.useState<string[]>(getInitialValue);
  const accordionId = React.useId();

  const handleToggle = (value: string) => {
    if (type === "single") {
      setOpenValues(openValues.includes(value) ? [] : [value]);
    } else {
      setOpenValues((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    }
  };

  const isOpen = (value: string) => openValues.includes(value);

  return (
    <div className={cn("divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)]", className)}>
      {items.map((item) => {
        const isItemOpen = isOpen(item.value);
        const triggerId = `accordion-trigger-${accordionId}-${item.value}`;
        const panelId = `accordion-panel-${accordionId}-${item.value}`;
        
        return (
          <div key={item.value}>
            <button
              type="button"
              id={triggerId}
              aria-expanded={isItemOpen}
              aria-controls={panelId}
              onClick={() => handleToggle(item.value)}
              className={cn(
                "flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium",
                "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]",
                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]"
              )}
            >
              {item.title}
              <span 
                className={cn("transition-transform", isItemOpen && "rotate-180")} 
                aria-hidden="true"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>
            {isItemOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                className="px-4 pb-3 text-sm text-[var(--text-secondary)]"
              >
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export { Accordion };
