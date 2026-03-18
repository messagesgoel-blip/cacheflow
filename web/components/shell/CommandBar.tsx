"use client";

import { Search, Upload, Plus, Bell, User } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Tooltip } from "../ui/Tooltip";

interface CommandBarProps {
  onOpenCommandPalette: () => void;
}

export function CommandBar({ onOpenCommandPalette }: CommandBarProps) {
  const pathname = usePathname() || "/";
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenCommandPalette();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenCommandPalette]);

  const getPageLabel = () => {
    if (pathname === "/") return "Home";
    if (pathname.startsWith("/library")) return "Library";
    if (pathname.startsWith("/spaces")) return "Spaces";
    if (pathname.startsWith("/transfers")) return "Transfers";
    if (pathname.startsWith("/automations")) return "Automations";
    if (pathname.startsWith("/connections")) return "Connections";
    if (pathname.startsWith("/activity")) return "Activity";
    if (pathname.startsWith("/settings")) return "Settings";
    return "Homeport";
  };

  return (
    <div
      className="h-12 flex items-center justify-between px-4 border-b shrink-0 backdrop-blur-sm animate-fade-in"
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
        zIndex: 'var(--z-sticky)',
      }}
    >
      {/* Left: Page label */}
      <div style={{ color: 'var(--text-secondary)' }} className="text-sm truncate min-w-0 font-medium">
        {getPageLabel()}
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-md mx-6">
        <button
          onClick={onOpenCommandPalette}
          className="w-full h-8 px-3 flex items-center gap-2 rounded-lg transition-all hover:shadow-md"
          style={{
            background: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-muted)',
          }}
        >
          <Search className="w-4 h-4" />
          <span className="text-sm">Search files, spaces, people...</span>
          <kbd 
            className="ml-auto text-xs px-1.5 py-0.5 rounded border" 
            style={{ 
              background: 'var(--bg-hover)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {isMac ? '⌘K' : 'Ctrl+K'}
          </kbd>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <Tooltip content="Upload files" side="bottom">
          <button
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-[var(--bg-hover)]"
            style={{
              border: '1px solid var(--border-strong)',
              color: 'var(--text-primary)',
            }}
          >
            <Upload className="w-4 h-4" />
          </button>
        </Tooltip>

        <Tooltip content="New space" side="bottom">
          <button
            className="btn-primary w-8 h-8 rounded-lg flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
        </Tooltip>

        <Tooltip content="Notifications" side="bottom">
          <button
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-[var(--bg-hover)] relative"
            style={{ background: 'transparent' }}
          >
            <Bell className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            <span
              className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: 'var(--accent-red)' }}
            />
          </button>
        </Tooltip>

        <Tooltip content="Account settings" side="bottom">
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:shadow-md hover:scale-105"
            style={{ background: 'var(--accent-blue)' }}
          >
            <User className="w-4 h-4" style={{ color: 'white' }} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
