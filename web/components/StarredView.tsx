'use client'

import { useState, useEffect } from 'react'
import { FileMetadata, PROVIDERS, formatBytes } from '@/lib/providers/types'

interface StarredItem {
  id: string
  provider: string
  account_key: string
  file_id: string
  file_name: string
  mime_type: string
  is_folder: boolean
  path: string
  created_at: string
}

interface StarredViewProps {
  onFileClick: (file: FileMetadata) => void
  onRemoveFavorite: (fileId: string, provider: string, accountKey: string) => Promise<void>
}

export default function StarredView({ onFileClick, onRemoveFavorite }: StarredViewProps) {
  const [favorites, setFavorites] = useState<StarredItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchFavorites() {
      const token = localStorage.getItem('cf_token')

      try {
        const res = await fetch('/api/favorites', {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        const body = await res.json()
        if (body.ok) {
          setFavorites(body.data.favorites)
        }
      } catch (err) {
        console.error('Failed to fetch favorites:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchFavorites()
  }, [])

  const mapToMetadata = (fav: StarredItem): FileMetadata => ({
    id: fav.file_id,
    name: fav.file_name,
    mimeType: fav.mime_type,
    isFolder: fav.is_folder,
    path: fav.path,
    pathDisplay: fav.path,
    size: 0, // Metadata only
    modifiedTime: fav.created_at,
    provider: fav.provider as any,
    providerName: PROVIDERS.find(p => p.id === fav.provider)?.name || fav.provider
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Starred Items</h2>
        <span data-testid="cf-starred-count" className="px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold">
          {favorites.length} items
        </span>
      </div>

      {loading ? (
        <div data-testid="cf-starred-loading" className="py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : favorites.length === 0 ? (
        <div className="py-24 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <span className="text-4xl mb-4 block">⭐</span>
          <p className="text-gray-500">You haven't starred any files yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {favorites.map((fav) => (
            <div 
              key={fav.id}
              data-testid={`cf-starred-list-item-${fav.id}`}
              className="group relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 hover:shadow-md transition-all cursor-pointer"
              onClick={() => onFileClick(mapToMetadata(fav))}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">
                  {fav.is_folder ? '📁' : '📄'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate pr-6">{fav.file_name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm">{PROVIDERS.find(p => p.id === fav.provider)?.icon}</span>
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter truncate">
                      {fav.provider} • {fav.path}
                    </span>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveFavorite(fav.file_id, fav.provider, fav.account_key)
                  setFavorites(prev => prev.filter(f => f.id !== fav.id))
                }}
                className="absolute top-3 right-3 text-yellow-400 hover:text-gray-300 transition-colors"
                title="Remove from Starred"
              >
                ⭐
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

