import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ConnectProviderModal from '../ConnectProviderModal'

const notify = jest.fn()
const closeModal = jest.fn()
const connect = jest.fn()

let modalState: any = {
  isOpen: true,
  modalType: 'connect',
  providerId: 'google',
  modalData: undefined,
}

jest.mock('../../ActionCenterProvider', () => ({
  useActionCenter: () => ({
    notify,
  }),
}))

jest.mock('../../../context/IntegrationContext', () => ({
  useIntegration: () => ({
    modalState,
    closeModal,
  }),
}))

jest.mock('../../../lib/providers', () => ({
  getProvider: jest.fn(),
}))

jest.mock('../../../lib/tokenManager', () => ({
  tokenManager: {
    saveToken: jest.fn(),
    removeToken: jest.fn(),
  },
}))

jest.mock('../../../lib/apiClient', () => ({
  authFetch: jest.fn(),
}))

const { getProvider } = jest.requireMock('../../../lib/providers') as { getProvider: jest.Mock }
const { tokenManager } = jest.requireMock('../../../lib/tokenManager') as {
  tokenManager: { saveToken: jest.Mock; removeToken: jest.Mock }
}
const { authFetch } = jest.requireMock('../../../lib/apiClient') as { authFetch: jest.Mock }
const saveToken = tokenManager.saveToken
const removeToken = tokenManager.removeToken

describe('ConnectProviderModal', () => {
  const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent')

  beforeEach(() => {
    notify.mockReset()
    closeModal.mockReset()
    connect.mockReset()
    getProvider.mockReset()
    saveToken.mockReset()
    removeToken.mockReset()
    authFetch.mockReset()
    dispatchEventSpy.mockClear()
    getProvider.mockReturnValue({ connect })

    modalState = {
      isOpen: true,
      modalType: 'connect',
      providerId: 'google',
      modalData: undefined,
    }
  })

  test('persists a successful OAuth connect to server remotes without storing browser tokens', async () => {
    connect.mockResolvedValue({
      provider: 'google',
      accessToken: 'access-123',
      refreshToken: 'refresh-123',
      expiresAt: Date.now() + 60_000,
      accountEmail: 'user@example.com',
      displayName: 'User Example',
      accountId: 'google-account-1',
    })

    authFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          remote: {
            id: 'remote-g1',
          },
        },
      }),
    })

    render(<ConnectProviderModal />)
    fireEvent.click(screen.getByRole('button', { name: 'Authorize' }))

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalled()
    })

    const [, requestInit] = authFetch.mock.calls[0]
    expect(authFetch.mock.calls[0][0]).toBe('/api/remotes')
    expect(requestInit.method).toBe('POST')
    expect(requestInit.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(requestInit.body)).toMatchObject({
      provider: 'google',
      accountKey: 'google-account-1',
      accessToken: 'access-123',
      refreshToken: 'refresh-123',
      accountId: 'google-account-1',
      accountEmail: 'user@example.com',
      displayName: 'User Example',
    })

    expect(saveToken).toHaveBeenCalledWith(
      'google',
      expect.objectContaining({
        provider: 'google',
        accountKey: 'google-account-1',
        accessToken: '',
        refreshToken: undefined,
        expiresAt: null,
        accountEmail: 'user@example.com',
      }),
      'remote-g1',
    )
    expect(closeModal).toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith({
      kind: 'success',
      title: 'Connected',
      message: 'Google Drive connected successfully',
    })
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cacheflow:remote-connected',
      }),
    )
    expect(removeToken).not.toHaveBeenCalled()
  })

  test('shows an error when server persistence fails after OAuth', async () => {
    connect.mockResolvedValue({
      provider: 'google',
      accessToken: 'access-123',
      accountEmail: 'user@example.com',
      displayName: 'User Example',
      accountId: 'google-account-1',
    })

    authFetch.mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'Failed to save provider connection',
      }),
    })

    render(<ConnectProviderModal />)
    fireEvent.click(screen.getByRole('button', { name: 'Authorize' }))

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith({
        kind: 'error',
        title: 'Connection Failed',
        message: 'Failed to save provider connection',
      })
    })

    expect(removeToken).not.toHaveBeenCalled()
    expect(dispatchEventSpy).not.toHaveBeenCalled()
  })
})
