import { TokenManager } from '../tokenManager'

describe('TokenManager', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists only sanitized provider metadata while keeping live secrets in memory', () => {
    const manager = new TokenManager()

    manager.saveToken(
      'google',
      {
        provider: 'google',
        accessToken: 'access-secret',
        refreshToken: 'refresh-secret',
        expiresAt: Date.now() + 60_000,
        accountEmail: 'user@example.com',
        displayName: 'Primary Google',
        accountId: 'acct-1',
        accountKey: 'acct-1',
      },
      'remote-123',
    )

    const stored = JSON.parse(localStorage.getItem('cacheflow_tokens_google') || '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      provider: 'google',
      accessToken: '',
      accountKey: 'acct-1',
      remoteId: 'remote-123',
    })
    expect(stored[0].refreshToken).toBeUndefined()

    const hydrated = manager.getToken('google', 'acct-1')
    expect(hydrated?.accessToken).toBe('access-secret')
    expect(hydrated?.refreshToken).toBe('refresh-secret')
    expect(hydrated?.remoteId).toBe('remote-123')
  })

  it('sanitizes existing persisted token payloads on startup', () => {
    localStorage.setItem(
      'cacheflow_tokens_dropbox',
      JSON.stringify([
        {
          provider: 'dropbox',
          accessToken: 'persisted-secret',
          refreshToken: 'persisted-refresh',
          expiresAt: null,
          accountEmail: 'dropbox@example.com',
          displayName: 'Dropbox',
          accountKey: 'dbx-1',
        },
      ]),
    )

    const manager = new TokenManager()
    const stored = JSON.parse(localStorage.getItem('cacheflow_tokens_dropbox') || '[]')

    expect(stored[0].accessToken).toBe('')
    expect(stored[0].refreshToken).toBeUndefined()
    expect(manager.getToken('dropbox', 'dbx-1')?.accessToken).toBe('')
  })

  it('treats remote-backed metadata as a valid connected state without a browser token', () => {
    const manager = new TokenManager()

    manager.saveToken('box', {
      provider: 'box',
      accessToken: '',
      expiresAt: null,
      accountEmail: 'box@example.com',
      displayName: 'Box',
      accountKey: 'box-1',
    } as any, 'remote-box-1')

    expect(manager.isTokenValid(manager.getToken('box', 'box-1'))).toBe(true)
  })
})
