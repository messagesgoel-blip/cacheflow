import { FileMetadata } from './providers/types'

const DB_NAME = 'CacheFlowMetadata'
const DB_VERSION = 2
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
        
        // If upgrading from version 1, clear old store to avoid key collisions
        if (event.oldVersion < 2 && db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME)
        }

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' })
          store.createIndex('provider', 'provider', { unique: false })
          store.createIndex('accountKey', 'accountKey', { unique: false })
          store.createIndex('folderId', 'folderId', { unique: false })
        }
      }
    })
  }

  private getKey(providerId: string, accountKey: string, folderId: string): string {
    return `${providerId}:${accountKey}:${folderId || 'root'}`
  }

  async getCachedFiles(providerId: string, accountKey: string, folderId: string): Promise<FileMetadata[] | null> {
    const db = await this.initDB()
    const key = this.getKey(providerId, accountKey, folderId)
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result ? request.result.files : null)
    })
  }

  async cacheFiles(providerId: string, accountKey: string, folderId: string, files: FileMetadata[]): Promise<void> {
    const db = await this.initDB()
    const key = this.getKey(providerId, accountKey, folderId)
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put({ 
        key, 
        provider: providerId, 
        accountKey, 
        folderId: folderId || 'root', 
        files, 
        timestamp: Date.now() 
      })
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async invalidateCache(providerId: string, accountKey?: string, folderId?: string): Promise<void> {
    const db = await this.initDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      
      if (accountKey !== undefined && folderId !== undefined) {
        const key = this.getKey(providerId, accountKey, folderId)
        const request = store.delete(key)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve()
      } else if (accountKey !== undefined) {
        // Invalidate all folders for a specific account
        const index = store.index('accountKey')
        const request = index.openCursor(IDBKeyRange.only(accountKey))
        request.onerror = () => reject(request.error)
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
          if (cursor) {
            if (cursor.value.provider === providerId) {
              cursor.delete()
            }
            cursor.continue()
          } else {
            resolve()
          }
        }
      } else {
        // Invalidate all accounts for a specific provider
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
