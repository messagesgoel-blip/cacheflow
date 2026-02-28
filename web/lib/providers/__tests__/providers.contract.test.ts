import { getAllProviderIds, getImplementedProviders, getProvider, isProviderImplemented } from '../index'
import { PROVIDERS, ProviderId } from '../types'

const requiredMethods: Array<keyof any> = [
  'connect',
  'disconnect',
  'refreshToken',
  'isTokenValid',
  'getQuota',
  'listFiles',
  'getFile',
  'uploadFile',
  'downloadFile',
  'deleteFile',
  'createFolder',
  'moveFile',
  'copyFile',
  'renameFile',
  'getShareLink',
  'revokeShareLink',
  'searchFiles',
]

const providerIds = PROVIDERS.map((p) => p.id)

describe('provider registry contract', () => {
  beforeEach(() => {
    // Ensure clean storage so constructors that read tokens do not see stale data
    localStorage.clear()
  })

  test('every configured provider is registered and instantiable', () => {
    const implemented = getImplementedProviders().map((p) => p.id)
    expect(new Set(implemented)).toEqual(new Set(providerIds))

    providerIds.forEach((id) => {
      expect(isProviderImplemented(id)).toBe(true)
      const provider = getProvider(id)
      expect(provider).toBeTruthy()
      expect(provider?.id).toBe(id)
    })
  })

  test.each(providerIds)('provider %s exposes required methods', (id: ProviderId) => {
    const provider = getProvider(id)
    expect(provider).toBeTruthy()

    requiredMethods.forEach((method) => {
      expect(typeof (provider as any)[method]).toBe('function')
    })
  })

  test('registry returns all provider ids', () => {
    expect(new Set(getAllProviderIds())).toEqual(new Set(providerIds))
  })
})
