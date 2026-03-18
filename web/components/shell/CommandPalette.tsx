"use client";

import { Search, Upload, FolderPlus, Link2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const quickActions = [
  { icon: Upload, label: "Upload files", shortcut: "⌘U" },
  { icon: FolderPlus, label: "Create folder", shortcut: "⌘⇧N" },
  { icon: Link2, label: "Connect provider", shortcut: "" },
  { icon: RefreshCw, label: "Retry failed transfers", shortcut: "" },
];

const jumpTo = [
  { label: "Library", shortcut: "G L", path: "/library" },
  { label: "Spaces", shortcut: "G S", path: "/spaces" },
  { label: "Transfers", shortcut: "G T", path: "/transfers" },
  { label: "Connections", shortcut: "G C", path: "/connections" },
];

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      } else if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleJumpTo = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-32"
      style={{ background: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: 'var(--bg-surface-raised)',
          boxShadow: 'var(--shadow-strong)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <Search className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          <input
            data-testid="command-palette-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files, spaces, people..."
            autoFocus
            className="flex-1 bg-transparent outline-none text-base"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto p-2">
          {!query && (
            <>
              {/* Quick Actions */}
              <div className="px-3 py-2">
                <div className="text-xs font-medium tracking-wide uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
                  Quick Actions
                </div>
                <div className="space-y-1">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      data-testid={`quick-action-${action.label.replace(/\s+/g, '-').toLowerCase()}`}
                      onClick={() => { console.log(action.label); onClose(); }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <action.icon className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                      <span className="flex-1">{action.label}</span>
                      {action.shortcut && (
                        <kbd className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                          {action.shortcut}
                        </kbd>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Jump To */}
              <div className="px-3 py-2 mt-4">
                <div className="text-xs font-medium tracking-wide uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
                  Jump To
                </div>
                <div className="space-y-1">
                  {jumpTo.map((item) => (
                    <button
                      key={item.path}
                      data-testid={`jump-to-${item.label.replace(/\s+/g, '-').toLowerCase()}`}
                      onClick={() => handleJumpTo(item.path)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span className="flex-1">{item.label}</span>
                      <kbd className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                        {item.shortcut}
                      </kbd>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {query && (
            <div className="px-3 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
              No results found for "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
