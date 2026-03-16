"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface Tab {
  value: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

const Tabs = ({ tabs, defaultValue, value, onValueChange, className }: TabsProps) => {
  const [activeTab, setActiveTab] = React.useState(defaultValue || tabs[0]?.value);
  const tabRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());

  const currentValue = value !== undefined ? value : activeTab;

  const handleTabClick = (tabValue: string) => {
    setActiveTab(tabValue);
    onValueChange?.(tabValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent, tabValue: string) => {
    const enabledTabs = tabs.filter(t => !t.disabled);
    const currentIndex = enabledTabs.findIndex(t => t.value === tabValue);
    let nextIndex = currentIndex;

    if (e.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % enabledTabs.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + enabledTabs.length) % enabledTabs.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = enabledTabs.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    const nextTab = enabledTabs[nextIndex];
    handleTabClick(nextTab.value);
    tabRefs.current.get(nextTab.value)?.focus();
  };

  return (
    <div className={cn("w-full", className)}>
      <div role="tablist" className="flex border-b border-[var(--border-subtle)]">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`tab-${tab.value}`}
            data-testid={`tab-${tab.value}`}
            aria-selected={currentValue === tab.value}
            aria-controls={`panel-${tab.value}`}
            aria-disabled={tab.disabled}
            tabIndex={tab.disabled ? -1 : (currentValue === tab.value ? 0 : -1)}
            ref={(el) => { if (el) tabRefs.current.set(tab.value, el); }}
            onClick={() => !tab.disabled && handleTabClick(tab.value)}
            onKeyDown={(e) => !tab.disabled && handleKeyDown(e, tab.value)}
            disabled={tab.disabled}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors relative",
              currentValue === tab.value
                ? "text-[var(--accent-blue)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              tab.disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {tab.label}
            {currentValue === tab.value && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-blue)]" />
            )}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.value}
          role="tabpanel"
          id={`panel-${tab.value}`}
          aria-labelledby={`tab-${tab.value}`}
          hidden={currentValue !== tab.value}
          className={currentValue === tab.value ? "py-4" : "hidden"}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
};

export { Tabs };
