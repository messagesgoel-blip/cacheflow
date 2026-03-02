'use client'

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
    <div 
      data-testid="cf-shortcuts-help"
      className="fixed inset-0 z-[2000] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 bg-gradient-to-br from-blue-600 to-purple-700 text-white">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <span>⌨️</span> Keyboard Shortcuts
          </h3>
          <p className="text-blue-100 text-xs mt-1 font-medium uppercase tracking-widest opacity-80">
            Power-user controls
          </p>
        </div>
        
        <div className="p-6 space-y-3">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between group">
              <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">
                {s.desc}
              </span>
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[10px] font-bold font-mono shadow-sm min-w-[40px] text-center">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-950 text-center">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
