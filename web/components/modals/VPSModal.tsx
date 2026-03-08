'use client'

import { useEffect, useMemo, useState } from 'react'
import { useActionCenter } from '@/components/ActionCenterProvider'
import { useIntegration } from '@/context/IntegrationContext'

type VpsModalConnection = {
  id: string
  accountLabel?: string
  accountName?: string
  host?: string
  port?: number
  username?: string
}

type VpsModalData = {
  mode?: 'create' | 'edit'
  connection?: VpsModalConnection
}

type TestStatus = {
  kind: 'success' | 'error'
  message: string
  hostFingerprint?: string | null
} | null

function buildConnectionSignature(input: {
  host: string
  port: string
  username: string
  pemFile: File | null
  existingConnectionId?: string
}) {
  return JSON.stringify({
    host: input.host.trim(),
    port: String(Number.parseInt(input.port, 10) || 22),
    username: input.username.trim(),
    keyRef: input.pemFile
      ? `${input.pemFile.name}:${input.pemFile.size}:${input.pemFile.lastModified}`
      : input.existingConnectionId || '',
  })
}

function getAuthHint(rawError: string) {
  return /All configured authentication methods failed/i.test(rawError)
    ? ' Make sure you uploaded the private key file, not the .pub file, and that the matching public key is already in ~/.ssh/authorized_keys on the server.'
    : ''
}

export default function VPSModal() {
  const { modalState, closeModal } = useIntegration()
  const actions = useActionCenter()
  const [submitting, setSubmitting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [label, setLabel] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('')
  const [pemFile, setPemFile] = useState<File | null>(null)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<TestStatus>(null)
  const [lastSuccessfulTestSignature, setLastSuccessfulTestSignature] = useState<string | null>(null)
  const [initialConnectionSignature, setInitialConnectionSignature] = useState<string | null>(null)
  const isVisible = modalState.isOpen && modalState.modalType === 'connect' && modalState.providerId === 'vps'

  const modalData = (modalState.modalData || {}) as VpsModalData
  const editingConnection = modalData.mode === 'edit' ? modalData.connection : undefined
  const isEditMode = Boolean(editingConnection?.id)

  useEffect(() => {
    const nextLabel = editingConnection?.accountLabel || editingConnection?.accountName || ''
    const nextHost = editingConnection?.host || ''
    const nextPort = String(editingConnection?.port || 22)
    const nextUsername = editingConnection?.username || ''

    setLabel(nextLabel)
    setHost(nextHost)
    setPort(nextPort)
    setUsername(nextUsername)
    setPemFile(null)
    setInlineError(null)
    setTestStatus(null)
    setSubmitting(false)
    setTesting(false)

    const signature = isEditMode
      ? buildConnectionSignature({
          host: nextHost,
          port: nextPort,
          username: nextUsername,
          pemFile: null,
          existingConnectionId: editingConnection?.id,
        })
      : null

    setInitialConnectionSignature(signature)
    setLastSuccessfulTestSignature(signature)
  }, [editingConnection?.accountLabel, editingConnection?.accountName, editingConnection?.host, editingConnection?.id, editingConnection?.port, editingConnection?.username, isEditMode, modalState.isOpen])

  const currentConnectionSignature = useMemo(
    () =>
      buildConnectionSignature({
        host,
        port,
        username,
        pemFile,
        existingConnectionId: editingConnection?.id,
      }),
    [editingConnection?.id, host, pemFile, port, username],
  )

  const hasValidatedConnection =
    lastSuccessfulTestSignature === currentConnectionSignature ||
    (isEditMode && initialConnectionSignature === currentConnectionSignature)

  const validateInput = (mode: 'test' | 'save') => {
    setInlineError(null)
    setTestStatus(null)

    if (!label.trim() && mode === 'save') {
      setInlineError('Label is required.')
      return false
    }
    if (!host.trim() || !username.trim()) {
      setInlineError('Host and username are required.')
      return false
    }
    if (!isEditMode && !pemFile) {
      setInlineError('PEM key file is required.')
      return false
    }
    if (pemFile) {
      const ext = pemFile.name.toLowerCase()
      if (!ext.endsWith('.pem') && !ext.endsWith('.key')) {
        setInlineError('PEM key must use .pem or .key extension.')
        return false
      }
    }

    return true
  }

  const buildFormData = () => {
    const formData = new FormData()
    if (label.trim()) formData.append('label', label.trim())
    formData.append('host', host.trim())
    formData.append('port', String(Number.parseInt(port, 10) || 22))
    formData.append('username', username.trim())
    if (pemFile) formData.append('pemFile', pemFile)
    return formData
  }

  const handleTestConnection = async () => {
    if (!validateInput('test')) return

    setTesting(true)
    try {
      const endpoint = isEditMode
        ? `/api/providers/vps/${editingConnection!.id}/test`
        : '/api/providers/vps/test'

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        body: buildFormData(),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        const rawError = result?.detail || result?.error || 'Connection test failed'
        const message = `${rawError}${getAuthHint(rawError)}`
        setInlineError(message)
        setLastSuccessfulTestSignature(null)
        return
      }

      setLastSuccessfulTestSignature(currentConnectionSignature)
      setTestStatus({
        kind: 'success',
        message: result?.message || 'Connection successful',
        hostFingerprint: result?.hostFingerprint || null,
      })
      actions.notify({
        kind: 'success',
        title: 'Connection tested',
        message: isEditMode ? `${label.trim() || 'VPS'} is reachable` : 'Connection successful',
      })
      if (isEditMode) {
        window.dispatchEvent(new CustomEvent('cacheflow:vps-tested', { detail: { id: editingConnection!.id } }))
      }
    } catch (err: any) {
      setInlineError(err?.message || 'Connection test failed')
      setLastSuccessfulTestSignature(null)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!validateInput('save')) return
    if (!hasValidatedConnection) {
      setInlineError('Test connection before saving any host, port, username, or key changes.')
      return
    }

    setSubmitting(true)
    try {
      const endpoint = isEditMode ? `/api/providers/vps/${editingConnection!.id}` : '/api/providers/vps'
      const method = isEditMode ? 'PATCH' : 'POST'

      const response = await fetch(endpoint, {
        method,
        credentials: 'include',
        body: buildFormData(),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        const rawError = result?.detail || result?.error || 'Failed to save VPS connection'
        setInlineError(`${rawError}${getAuthHint(rawError)}`)
        return
      }

      actions.notify({
        kind: 'success',
        title: isEditMode ? 'VPS updated' : 'Connected',
        message: isEditMode
          ? `${label.trim()} updated successfully`
          : `${label.trim()} connected successfully`,
      })

      const eventName = isEditMode ? 'cacheflow:vps-updated' : 'cacheflow:vps-connected'
      const eventId = isEditMode ? editingConnection!.id : result?.id || result?.data?.id
      window.dispatchEvent(new CustomEvent(eventName, { detail: { id: eventId } }))
      closeModal()
    } catch (err: any) {
      setInlineError(err?.message || 'Failed to save VPS connection')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    closeModal()
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
        <h3 className="mb-2 text-lg font-semibold">{isEditMode ? 'Edit VPS / SFTP' : 'Connect VPS / SFTP'}</h3>
        <p className="mb-6 text-sm text-gray-500">
          {isEditMode
            ? 'Update the saved VPS details. Test the connection before saving transport changes.'
            : 'Test the connection first, then save the VPS using PEM key authentication.'}
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="OCI Node 1"
              required
              className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Host <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="203.0.113.1"
              required
              className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Port</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="22"
              className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              required
              className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              {isEditMode ? 'Replace PEM Key' : 'PEM Key'} {!isEditMode && <span className="text-red-500">*</span>}
            </label>
            <input
              type="file"
              accept=".pem,.key"
              onChange={(e) => setPemFile(e.target.files?.[0] || null)}
              className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
            {isEditMode && !pemFile && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Leave empty to keep the currently saved private key.
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Upload the private key file only. Do not upload the matching <code>.pub</code> file.
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Your private key is encrypted before storage and never returned after saving.
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              For manual QA, use <code>/srv/storage/local/mock run</code> instead of operating in <code>/</code>.
            </p>
            {pemFile && (
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">Selected: {pemFile.name}</p>
            )}
          </div>
        </div>

        {testStatus?.kind === 'success' && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
            <div className="font-medium">{testStatus.message}</div>
            {testStatus.hostFingerprint ? (
              <div className="mt-2 rounded-md border border-emerald-200/80 bg-white/60 px-3 py-2 dark:border-emerald-800/40 dark:bg-black/10">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700/80 dark:text-emerald-300/80">
                  Host Fingerprint
                </div>
                <div className="mt-1 break-all font-mono text-xs text-emerald-800 dark:text-emerald-200">
                  {testStatus.hostFingerprint}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {inlineError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            {inlineError}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 rounded-lg border px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleTestConnection}
            disabled={testing || submitting}
            className="flex-1 rounded-lg border border-blue-200 px-4 py-2 text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/20"
          >
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <button
            onClick={handleSave}
            disabled={submitting || testing}
            className="flex-1 rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {submitting ? (isEditMode ? 'Saving…' : 'Connecting…') : isEditMode ? 'Save Changes' : 'Save VPS'}
          </button>
        </div>
      </div>
    </div>
  )
}
