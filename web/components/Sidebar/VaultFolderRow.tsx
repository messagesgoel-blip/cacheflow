'use client'

interface VaultFolderRowProps {
  isSelected: boolean
  isLocked: boolean
  onClick: () => void
}

export default function VaultFolderRow({ isSelected, isLocked, onClick }: VaultFolderRowProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
        isSelected
          ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-medium'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
      aria-pressed={isSelected}
    >
      <span className="text-xl">
        {isLocked ? '🔒' : '🔓'}
      </span>
      <span>Private Folder</span>
    </button>
  )
}
