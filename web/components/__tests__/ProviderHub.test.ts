import { detectFingerprintDrift } from '../ProviderHub'

describe('ProviderHub fingerprint drift detection', () => {
  test('returns true when the backend marks the fingerprint as changed', () => {
    expect(detectFingerprintDrift('SHA256:old', 'SHA256:new', true)).toBe(true)
  })

  test('returns true when fingerprints differ', () => {
    expect(detectFingerprintDrift('SHA256:old', 'SHA256:new')).toBe(true)
  })

  test('returns false when fingerprints match or are incomplete', () => {
    expect(detectFingerprintDrift('SHA256:same', 'SHA256:same')).toBe(false)
    expect(detectFingerprintDrift('', 'SHA256:new')).toBe(false)
    expect(detectFingerprintDrift('SHA256:old', '')).toBe(false)
  })
})
