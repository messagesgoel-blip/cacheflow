"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
}

export function DetailDrawer({ isOpen, onClose, item }: DetailDrawerProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="w-96 h-full border-l flex flex-col"
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
        animation: 'slideInRight 280ms cubic-bezier(0.32, 0.72, 0, 1)',
      }}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <h2 className="font-medium" style={{ color: 'var(--text-primary)' }}>
          Details
        </h2>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ background: 'transparent' }}
        >
          <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {item ? (
            <>
              <div>
                <div className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Name</div>
                <div style={{ color: 'var(--text-primary)' }}>{item.name}</div>
              </div>
              <div>
                <div className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Type</div>
                <div style={{ color: 'var(--text-primary)' }}>{item.type || 'File'}</div>
              </div>
              <div>
                <div className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Modified</div>
                <div style={{ color: 'var(--text-primary)' }}>{item.modified || 'Today'}</div>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>
              Select a file or folder to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
