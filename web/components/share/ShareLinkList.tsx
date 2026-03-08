'use client'

import { ShareLink } from './ShareLinkPanel'

interface ShareLinkListProps {
  links: ShareLink[]
  onCopy: (link: ShareLink) => void
  onRevoke: (linkId: string) => void
  copied: string | null
  formatExpiry: (dateString: string) => string
}

export function ShareLinkList({ links, onCopy, onRevoke, copied, formatExpiry }: ShareLinkListProps) {
  return (
    <div className="space-y-2">
      {links.map((link) => {
        const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date()
        const isCopied = copied === link.token

        return (
          <div
            key={link.id}
            className={`p-3 border rounded-lg ${
              isExpired
                ? 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* URL display */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={link.url}
                    className="flex-1 px-2 py-1 text-xs bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded text-gray-600 dark:text-gray-300 truncate"
                  />
                  <button
                    onClick={() => onCopy(link)}
                    className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                      isCopied
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                    }`}
                  >
                    {isCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                {/* Meta info */}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {link.createdAt ? new Date(link.createdAt).toLocaleDateString() : 'Just now'}
                  </span>

                  {link.expiresAt && (
                    <span className={`flex items-center gap-1 ${isExpired ? 'text-red-500' : ''}`}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatExpiry(link.expiresAt)}
                    </span>
                  )}

                  {link.passwordRequired && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Protected
                    </span>
                  )}

                  {link.downloadCount !== undefined && (
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {link.downloadCount} downloads
                    </span>
                  )}
                </div>
              </div>

              {/* Revoke button */}
              <button
                onClick={() => onRevoke(link.id)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                title="Revoke link"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ShareLinkList

