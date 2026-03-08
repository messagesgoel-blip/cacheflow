/**
 * Token Manager
 * Handles token storage, retrieval, and auto-refresh in the browser
 */

import { ProviderToken, ProviderId } from './providers/types'

const TOKEN_PREFIX = 'cacheflow_token_'
const TOKEN_MULTI_PREFIX = 'cacheflow_tokens_'
const SETTINGS_KEY = 'cacheflow_settings'
const MAX_TOKENS_PER_PROVIDER = 3
const MAX_TOKENS_TOTAL = 15

interface StoredToken extends ProviderToken {
  accountKey: string
  disabled?: boolean
  remoteId?: string
}

interface TokenManagerSettings {
  autoRefresh: boolean
  refreshBufferMs: number // Refresh token this many ms before expiry
}

const DEFAULT_SETTINGS: TokenManagerSettings = {
  autoRefresh: true,
  refreshBufferMs: 5 * 60 * 1000, // 5 minutes
}

class TokenManager {
  private settings: TokenManagerSettings
  private refreshTimers: Map<ProviderId, NodeJS.Timeout> = new Map()
  private refreshCallbacks: Map<ProviderId, (token: ProviderToken) => Promise<ProviderToken>> = new Map()

  constructor() {
    this.settings = this.loadSettings()
  }

  /**
      console.error('[TokenManager] Failed to sync remotes:', err)
    }
  }

  // ===========================================================================
  // Storage Methods
  // ===========================================================================

  /**
   * Save token to localStorage
   */
  saveToken(provider: ProviderId, token: ProviderToken, remoteId?: string): void {
    if (typeof window === 'undefined') return
    const key = this.getMultiStorageKey(provider)
    const legacyKey = this.getStorageKey(provider)

    const accountKey = token.accountKey || this.buildAccountKey(token)
    const existing = this.getTokens(provider)

    const next: StoredToken[] = [...existing]
    const stored: StoredToken = { 
      ...token, 
      provider, 
      accountKey, 
      remoteId: remoteId || existing.find(t => t.accountKey === accountKey)?.remoteId,
      disabled: existing.find(t => t.accountKey === accountKey)?.disabled ?? false 
    }

    const existingIndex = existing.findIndex((t) => t.accountKey === accountKey)

    if (existingIndex >= 0) {
      next[existingIndex] = stored
    } else {
      const totalCount = this.countAllTokens()
      if (existing.length >= MAX_TOKENS_PER_PROVIDER) {
        throw new Error(`MAX_PER_PROVIDER_REACHED:${provider}`)
      }
      if (totalCount >= MAX_TOKENS_TOTAL) {
        throw new Error('MAX_TOTAL_REACHED')
      }
      next.push(stored)
    }

    localStorage.setItem(key, JSON.stringify(next))
    localStorage.removeItem(legacyKey)
  }

  /**
   * Get token from localStorage
   */
  getToken(provider: ProviderId, accountKey?: string): ProviderToken | null {
    if (typeof window === 'undefined') return null
    const tokens = this.getTokens(provider)
    if (tokens.length === 0) return null
    if (!accountKey) return tokens.find((t) => !t.disabled) || tokens[0]
    return tokens.find((t) => t.accountKey === accountKey) || tokens.find((t) => !t.disabled) || tokens[0]
  }

  getTokens(provider: ProviderId): StoredToken[] {
    if (typeof window === 'undefined') return []
    this.migrateLegacyToken(provider)

    const key = this.getMultiStorageKey(provider)
    const data = localStorage.getItem(key)
    if (!data) return []

    try {
      const tokens = JSON.parse(data) as StoredToken[]
      return tokens.map((t) => ({ ...t, provider, disabled: t.disabled ?? false }))
    } catch (e) {
      console.error(`[TokenManager] Failed to parse tokens for ${provider}:`, e)
      return []
    }
  }

  /**
   * Remove token from localStorage
   */
  removeToken(provider: ProviderId, accountKey?: string): void {
    if (typeof window === 'undefined') return
    const key = this.getMultiStorageKey(provider)
    if (!accountKey) {
      localStorage.removeItem(key)
      localStorage.removeItem(this.getStorageKey(provider))
      this.cancelRefresh(provider)
      return
    }

    const remaining = this.getTokens(provider).filter((t) => t.accountKey !== accountKey)
    if (remaining.length === 0) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, JSON.stringify(remaining))
    }
    this.cancelRefresh(provider)
  }

  /**
   * Get all stored tokens
   */
  getAllTokens(): Map<ProviderId, StoredToken[]> {
    if (typeof window === 'undefined') return new Map()
    const tokens = new Map<ProviderId, StoredToken[]>()
    const prefix = TOKEN_MULTI_PREFIX

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        const provider = key.replace(prefix, '') as ProviderId
        const providerTokens = this.getTokens(provider)
        if (providerTokens.length > 0) {
          tokens.set(provider, providerTokens)
        }
      }
    }

    return tokens
  }

  /**
   * Get all connected provider IDs from localStorage
   */
  getConnectedProviders(): string[] {
    if (typeof window === 'undefined') return []
    const connected: string[] = []
    for (const provider of Array.from(this.getAllTokens().keys())) {
      connected.push(provider)
    }
    return connected
  }

  /**
   * Check if token exists
   */
  hasToken(provider: ProviderId): boolean {
    return this.getTokens(provider).some((t) => !t.disabled)
  }

  setTokenEnabled(provider: ProviderId, accountKey: string, enabled: boolean): void {
    if (typeof window === 'undefined') return
    const tokens = this.getTokens(provider)
    const idx = tokens.findIndex((t) => t.accountKey === accountKey)
    if (idx === -1) return
    tokens[idx] = { ...tokens[idx], disabled: !enabled }
    localStorage.setItem(this.getMultiStorageKey(provider), JSON.stringify(tokens))
    if (!enabled) this.cancelRefresh(provider)
  }

  /**
   * Mark a specific account as active (moves it to the front of the list)
   */
  setActiveToken(provider: ProviderId, accountKey: string): void {
    if (typeof window === 'undefined') return
    const tokens = this.getTokens(provider)
    const idx = tokens.findIndex((t) => t.accountKey === accountKey)
    if (idx <= 0) return
    const [picked] = tokens.splice(idx, 1)
    tokens.unshift(picked)
    localStorage.setItem(this.getMultiStorageKey(provider), JSON.stringify(tokens))
  }

  // ===========================================================================
  // Token Validation
  // ===========================================================================

  /**
   * Check if token is valid and not expired
   */
  isTokenValid(token: ProviderToken | null): boolean {
    if (!token) return false
    if (!token.accessToken) return false
    if (!token.expiresAt) return true // No expiry means valid

    return Date.now() < token.expiresAt
  }

  /**
   * Check if token needs refresh (within buffer time)
   */
  needsRefresh(token: ProviderToken | null): boolean {
    if (!token) return false
    if (!token.expiresAt) return false
    if (!token.refreshToken) return false

    return Date.now() >= token.expiresAt - this.settings.refreshBufferMs
  }

  // ===========================================================================
  // Auto-Refresh
  // ===========================================================================

  /**
   * Register a refresh callback for a provider
   */
  onRefresh(provider: ProviderId, callback: (token: ProviderToken) => Promise<ProviderToken>): void {
    this.refreshCallbacks.set(provider, callback)
  }

  /**
   * Start auto-refresh timer for a token
   */
  startAutoRefresh(provider: ProviderId, token: ProviderToken): void {
    if (!this.settings.autoRefresh) return
    if (!token.refreshToken) return
    if (!this.refreshCallbacks.has(provider)) {
      console.warn(`[TokenManager] No refresh callback registered for ${provider}`)
      return
    }

    // Cancel existing timer
    this.cancelRefresh(provider)

    // If no expiresAt, skip auto-refresh (e.g., basic auth tokens)
    const expiresAt = token.expiresAt
    if (!expiresAt) {
      return
    }

    // Calculate time until refresh needed
    const refreshTime = expiresAt - this.settings.refreshBufferMs
    const delay = refreshTime - Date.now()

    if (delay <= 0) {
      // Already needs refresh, do it now
      this.refreshToken(provider)
      return
    }

    // Set timer
    const timer = setTimeout(() => {
      this.refreshToken(provider)
    }, delay)

    this.refreshTimers.set(provider, timer)
  }

  /**
   * Cancel auto-refresh for a provider
   */
  cancelRefresh(provider: ProviderId): void {
    const timer = this.refreshTimers.get(provider)
    if (timer) {
      clearTimeout(timer)
      this.refreshTimers.delete(provider)
    }
  }

  /**
   * Manually trigger token refresh
   */
  async refreshToken(provider: ProviderId): Promise<ProviderToken | null> {
    const token = this.getToken(provider)
    if (!token) {
      console.warn(`[TokenManager] No token to refresh for ${provider}`)
      return null
    }

    const callback = this.refreshCallbacks.get(provider)
    if (!callback) {
      console.warn(`[TokenManager] No refresh callback for ${provider}`)
      return null
    }

    try {
      const newToken = await callback(token)
      this.saveToken(provider, newToken)
      this.startAutoRefresh(provider, newToken)
      return newToken
    } catch (error) {
      console.error(`[TokenManager] Failed to refresh token for ${provider}:`, error)
      return null
    }
  }

  /**
   * Refresh all tokens that need it
   */
  async refreshAllTokens(): Promise<void> {
    const tokens = this.getAllTokens()

    for (const [provider, providerTokens] of Array.from(tokens.entries())) {
      for (const token of providerTokens) {
        if (token.disabled) continue
        if (this.needsRefresh(token)) {
          await this.refreshToken(provider)
        }
      }
    }
  }

  // ===========================================================================
  // Settings
  // ===========================================================================

  /**
   * Load settings from localStorage
   */
  private loadSettings(): TokenManagerSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS
    try {
      const data = localStorage.getItem(SETTINGS_KEY)
      if (data) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) }
      }
    } catch (e) {
      console.error('[TokenManager] Failed to load settings:', e)
    }
    return DEFAULT_SETTINGS
  }

  /**
   * Save settings to localStorage
   */
  saveSettings(settings: Partial<TokenManagerSettings>): void {
    if (typeof window === 'undefined') return
    this.settings = { ...this.settings, ...settings }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings))
  }

  /**
   * Get current settings
   */
  getSettings(): TokenManagerSettings {
    return { ...this.settings }
  }

  /**
   * Enable/disable auto-refresh
   */
  setAutoRefresh(enabled: boolean): void {
    this.saveSettings({ autoRefresh: enabled })
    if (!enabled) {
      // Cancel all refresh timers
      for (const [provider] of Array.from(this.refreshTimers)) {
        this.cancelRefresh(provider)
      }
    }
  }

  /**
   * Set refresh buffer time
   */
  setRefreshBuffer(ms: number): void {
    this.saveSettings({ refreshBufferMs: ms })
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Get localStorage key for a provider
   */
  private getStorageKey(provider: ProviderId): string {
    return `${TOKEN_PREFIX}${provider}`
  }

  private getMultiStorageKey(provider: ProviderId): string {
    return `${TOKEN_MULTI_PREFIX}${provider}`
  }

  private migrateLegacyToken(provider: ProviderId): void {
    if (typeof window === 'undefined') return
    const legacyKey = this.getStorageKey(provider)
    const legacyData = localStorage.getItem(legacyKey)
    if (!legacyData) return
    try {
      const token = JSON.parse(legacyData) as ProviderToken
      if (token && token.accessToken) {
        this.saveToken(provider, token)
      }
      localStorage.removeItem(legacyKey)
    } catch (e) {
      console.error(`[TokenManager] Failed migrating legacy token for ${provider}:`, e)
    }
  }

  private buildAccountKey(token: ProviderToken): string {
    return token.accountId || token.accountEmail || token.displayName || `acct-${Date.now()}`
  }

  private countAllTokens(): number {
    if (typeof window === 'undefined') return 0
    let count = 0
    const prefix = TOKEN_MULTI_PREFIX
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        try {
          const tokens = JSON.parse(localStorage.getItem(key) || '[]') as StoredToken[]
          count += tokens.length
        } catch {}
      }
    }
    return count
  }

  /**
   * Clear all tokens (logout from all providers)
   */
  clearAllTokens(): void {
    for (const [provider] of Array.from(this.getAllTokens())) {
      this.removeToken(provider)
    }
  }

  /**
   * Get token info for display
   */
  getTokenInfo(provider: ProviderId): { email: string; expiresAt: Date | null; needsRefresh: boolean } | null {
    const token = this.getToken(provider)
    if (!token) return null

    return {
      email: token.accountEmail,
      expiresAt: token.expiresAt ? new Date(token.expiresAt) : null,
      needsRefresh: this.needsRefresh(token),
    }
  }
}

// Export singleton instance
export const tokenManager = new TokenManager()

// Export class for testing
export { TokenManager }

