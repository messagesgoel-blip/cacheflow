import { FileMetadata } from './providers/types'

const DB_NAME = 'CacheFlowMetadata'
const DB_VERSION = 1
const STORE_NAME = 'metadata'

export class MetadataCache {
  private db: IDBDatabase | null = null

  private async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
          store.createIndex('provider', 'provider', { unique: false })
          store.createIndex('folderId', 'folderId', { unique: false })
        }
      }
    })
  }

  private getKey(providerId: string, folderId: string): string {
    return `${providerId}:${folderId || 'root'}`
  }

  async getCachedFiles(providerId: string, folderId: string): Promise<FileMetadata[] | null> {
    const db = await this.initDB()
    const key = this.getKey(providerId, folderId)
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result ? request.result.files : null)
    })
  }

  async cacheFiles(providerId: string, folderId: string, files: FileMetadata[]): Promise<void> {
    const db = await this.initDB()
    const key = this.getKey(providerId, folderId)
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put({ key, provider: providerId, folderId: folderId || 'root', files, timestamp: Date.now() })
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async invalidateCache(providerId: string, folderId?: string): Promise<void> {
    const db = await this.initDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      if (folderId !== undefined) {
        const key = this.getKey(providerId, folderId)
        const request = store.delete(key)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
      } else {
        const index = store.index('provider')
        const request = index.openCursor(IDBKeyRange.only(providerId))
        request.onerror = () => reject(request.error)
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
          if (cursor) {
            cursor.delete()
            cursor.continue()
          } else {
            resolve()
          }
        }
      }
    })
  }
}

export const metadataCache = new MetadataCache()
