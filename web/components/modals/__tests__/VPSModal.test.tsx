import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import VPSModal from '../VPSModal'

const notify = jest.fn()
const closeModal = jest.fn()

let modalState: any = {
  isOpen: true,
  modalType: 'connect',
  providerId: 'vps',
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

describe('VPSModal', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    notify.mockReset()
    closeModal.mockReset()
    modalState = {
      isOpen: true,
      modalType: 'connect',
      providerId: 'vps',
      modalData: undefined,
    }
    global.fetch = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  test('tests a new VPS connection without saving it', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'Connection successful', hostFingerprint: 'SHA256:testfingerprint' }),
    })

    render(<VPSModal />)

    fireEvent.change(screen.getByPlaceholderText('OCI Node 1'), { target: { value: 'OCI Node 1' } })
    fireEvent.change(screen.getByPlaceholderText('203.0.113.1'), { target: { value: '40.233.74.160' } })
    fireEvent.change(screen.getByPlaceholderText('22'), { target: { value: '22' } })
    fireEvent.change(screen.getByPlaceholderText('username'), { target: { value: 'sanjay' } })

    const pemInput = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(pemInput, {
      target: {
        files: [new File(['pem'], 'node.pem', { type: 'application/x-pem-file' })],
      },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/providers/vps/test',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: expect.any(FormData),
        }),
      )
    })

    expect(await screen.findByText('Connection successful')).toBeInTheDocument()
    expect(await screen.findByText('Host Fingerprint')).toBeInTheDocument()
    expect(await screen.findByText('SHA256:testfingerprint')).toBeInTheDocument()
    expect(closeModal).not.toHaveBeenCalled()
  })

  test('allows label-only edit save without forcing a new connection test', async () => {
    modalState = {
      isOpen: true,
      modalType: 'connect',
      providerId: 'vps',
      modalData: {
        mode: 'edit',
        connection: {
          id: 'conn-1',
          accountLabel: 'OCI',
          host: '40.233.74.160',
          port: 22,
          username: 'sanjay',
        },
      },
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'conn-1' } }),
    })

    render(<VPSModal />)

    const labelInput = await screen.findByDisplayValue('OCI')
    fireEvent.change(labelInput, { target: { value: 'OCI Production' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/providers/vps/conn-1',
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include',
          body: expect.any(FormData),
        }),
      )
    })

    expect(closeModal).toHaveBeenCalled()
  })

  test('blocks saving edited connection changes until the connection is tested again', async () => {
    modalState = {
      isOpen: true,
      modalType: 'connect',
      providerId: 'vps',
      modalData: {
        mode: 'edit',
        connection: {
          id: 'conn-1',
          accountLabel: 'OCI',
          host: '40.233.74.160',
          port: 22,
          username: 'sanjay',
        },
      },
    }

    render(<VPSModal />)

    const hostInput = await screen.findByDisplayValue('40.233.74.160')
    fireEvent.change(hostInput, { target: { value: '40.233.74.161' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(global.fetch).not.toHaveBeenCalled()
    expect(
      await screen.findByText('Test connection before saving any host, port, username, or key changes.'),
    ).toBeInTheDocument()
  })
})
