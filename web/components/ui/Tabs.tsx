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

  const currentValue = value !== undefined ? value : activeTab;

  const handleTabClick = (tabValue: string) => {
    setActiveTab(tabValue);
    onValueChange?.(tabValue);
  };

  const activeContent = tabs.find((tab) => tab.value === currentValue)?.content;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex border-b border-[var(--border-subtle)]">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => !tab.disabled && handleTabClick(tab.value)}
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
      <div className="py-4">{activeContent}</div>
    </div>
  );
};

export { Tabs };
