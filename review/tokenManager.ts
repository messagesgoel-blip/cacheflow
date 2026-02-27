/**
 * Token Manager
 * Handles token storage, retrieval, and auto-refresh in the browser
 */

import { ProviderToken, ProviderId } from './providers/types'

const TOKEN_PREFIX = 'cacheflow_token_'
const SETTINGS_KEY = 'cacheflow_settings'

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

  // ===========================================================================
  // Storage Methods
  // ===========================================================================

  /**
   * Save token to localStorage
   */
  saveToken(provider: ProviderId, token: ProviderToken): void {
    if (typeof window === 'undefined') return
    const key = this.getStorageKey(provider)
    const tokenData = {
      ...token,
      provider, // Ensure provider ID is stored
    }
    localStorage.setItem(key, JSON.stringify(tokenData))
  }

  /**
   * Get token from localStorage
   */
  getToken(provider: ProviderId): ProviderToken | null {
    if (typeof window === 'undefined') return null
    const key = this.getStorageKey(provider)
    const data = localStorage.getItem(key)
    if (!data) return null

    try {
      const token = JSON.parse(data) as ProviderToken
      // Ensure provider ID is correct
      if (token.provider !== provider) {
        token.provider = provider
      }
      return token
    } catch (e) {
      console.error(`[TokenManager] Failed to parse token for ${provider}:`, e)
      return null
    }
  }

  /**
   * Remove token from localStorage
   */
  removeToken(provider: ProviderId): void {
    if (typeof window === 'undefined') return
    const key = this.getStorageKey(provider)
    localStorage.removeItem(key)
    this.cancelRefresh(provider)
  }

  /**
   * Get all stored tokens
   */
  getAllTokens(): Map<ProviderId, ProviderToken> {
    if (typeof window === 'undefined') return new Map()
    const tokens = new Map<ProviderId, ProviderToken>()
    const prefix = TOKEN_PREFIX

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) {
        const provider = key.replace(prefix, '') as ProviderId
        const token = this.getToken(provider)
        if (token) {
          tokens.set(provider, token)
        }
      }
    }

    return tokens
  }

  /**
   * Check if token exists
   */
  hasToken(provider: ProviderId): boolean {
    return this.getToken(provider) !== null
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

    for (const [provider, token] of Array.from(tokens.entries())) {
      if (this.needsRefresh(token)) {
        await this.refreshToken(provider)
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
