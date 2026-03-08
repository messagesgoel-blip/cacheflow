'use client'

import { useState, useRef, useEffect } from 'react'
import { PROVIDERS, ProviderId } from '@/lib/providers/types'
import { tokenManager } from '@/lib/tokenManager'
import RemoteUploadModal from './RemoteUploadModal'

interface ActionBarProps {
  onUploadFiles?: () => void
  refreshKey?: number
}

export default function ActionBar({ onUploadFiles, refreshKey }: ActionBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showRemoteUpload, setShowRemoteUpload] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  // Get connected providers that support uploads
  const connectedProviders = PROVIDERS.filter(p => {
    const tokens = tokenManager.getTokens(p.id).filter(t => !t.disabled)
    return tokens.length > 0 && p.id !== 'local'
  })

  const handleUploadFiles = () => {
    setDropdownOpen(false)
    if (onUploadFiles) {
      onUploadFiles()
    }
  }

  const handleRemoteUpload = () => {
    setDropdownOpen(false)
    setShowRemoteUpload(true)
  }

  return (
    <>
      <div className="flex items-center gap-2" ref={dropdownRef}>
        {/* Upload Button with Dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload
            <svg
              className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={handleUploadFiles}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
              >
                <span className="text-lg">📁</span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Upload Files</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Select files from your device</p>
                </div>
              </button>

              <div className="my-1 border-t border-gray-100 dark:border-gray-700" />

              <button
                onClick={handleRemoteUpload}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
              >
                <span className="text-lg">🔗</span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Remote Upload</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Download from a URL</p>
                </div>
              </button>

              {connectedProviders.length > 0 && (
                <>
                  <div className="my-1 border-t border-gray-100 dark:border-gray-700" />

                  <div className="px-4 py-2">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Quick Upload To
                    </p>
                  </div>

                  {connectedProviders.slice(0, 5).map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => {
                        setDropdownOpen(false)
                        // Trigger upload with pre-selected provider
                        if (onUploadFiles) {
                          onUploadFiles()
                        }
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3"
                    >
                      <span className="text-base">{provider.icon}</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{provider.name}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* New Folder Button */}
        <button
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors"
          onClick={() => {
            // This would trigger a new folder modal - placeholder for now
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          New Folder
        </button>
      </div>

      {/* Remote Upload Modal */}
      <RemoteUploadModal
        isOpen={showRemoteUpload}
        onClose={() => setShowRemoteUpload(false)}
      />
    </>
  )
}

