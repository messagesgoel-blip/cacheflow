'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'

interface ShortcutHelpProps {
  onClose: () => void
}

export default function ShortcutHelp({ onClose }: ShortcutHelpProps) {
  const shortcuts = [
    { key: '↑/↓', desc: 'Move selection up/down' },
    { key: 'Enter', desc: 'Open folder or preview file' },
    { key: 'Backspace', desc: 'Navigate to parent folder' },
    { key: 'Ctrl + C', desc: 'Copy selected file' },
    { key: 'Ctrl + X', desc: 'Cut (Move) selected file' },
    { key: 'Ctrl + V', desc: 'Paste file to current folder' },
    { key: 'Delete', desc: 'Delete selected file' },
    { key: 'F2', desc: 'Rename selected file' },
    { key: '/', desc: 'Focus global search' },
    { key: '?', desc: 'Show this help menu' },
    { key: 'Esc', desc: 'Close preview or modal' },
  ]

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" style={{ borderRadius: 'var(--radius-card)' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>⌨️</span> Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between">
              <span style={{ color: 'var(--text-secondary)' }} className="text-sm">
                {s.desc}
              </span>
              <kbd 
                className="px-2 py-1 rounded-lg text-[10px] font-bold font-mono shadow-sm min-w-[40px] text-center"
                style={{ 
                  backgroundColor: 'var(--bg-hover)',
                  borderColor: 'var(--border-strong)',
                  borderWidth: '1px',
                  color: 'var(--text-primary)'
                }}
              >
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
