import { getPublicApiUrl } from '../config'

describe('web config', () => {
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL

  afterEach(() => {
    if (originalApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalApiUrl
    }
  })

  test('falls back to localhost API url when env is unset', () => {
    delete process.env.NEXT_PUBLIC_API_URL
    expect(getPublicApiUrl()).toBe('http://localhost:8100')
  })

  test('normalizes trailing slash when env is set', () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://cacheflow-api:8100/'
    expect(getPublicApiUrl()).toBe('http://cacheflow-api:8100')
  })

  test('throws for invalid URL values', () => {
    process.env.NEXT_PUBLIC_API_URL = 'not-a-url'
    expect(() => getPublicApiUrl()).toThrow(/invalid next_public_api_url/i)
  })
})

