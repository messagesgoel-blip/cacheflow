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
  pemText?: string | null
  existingConnectionId?: string
}) {
  return JSON.stringify({
    host: input.host.trim(),
    port: String(Number.parseInt(input.port, 10) || 22),
    username: input.username.trim(),
    keyRef: input.pemFile
      ? `${input.pemFile.name}:${input.pemFile.size}:${input.pemFile.lastModified}`
      : input.pemText
        ? `generated:${input.pemText.length}`
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
  const [generating, setGenerating] = useState(false)
  const [label, setLabel] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('')
  const [pemFile, setPemFile] = useState<File | null>(null)
  const [pemText, setPemText] = useState<string | null>(null)
  const [generatedPublicKey, setGeneratedPublicKey] = useState<string | null>(null)
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
    setPemText(null)
    setGeneratedPublicKey(null)
    setInlineError(null)
    setTestStatus(null)
    setSubmitting(false)
    setTesting(false)
    setGenerating(false)

    const signature = isEditMode
      ? buildConnectionSignature({
          host: nextHost,
          port: nextPort,
          username: nextUsername,
          pemFile: null,
          pemText: null,
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
        pemText,
        existingConnectionId: editingConnection?.id,
      }),
    [editingConnection?.id, host, pemFile, pemText, port, username],
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
    if (!isEditMode && !pemFile && !pemText) {
      setInlineError('PEM key file or generated key is required.')
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
    if (pemFile) {
      formData.append('pemFile', pemFile)
    } else if (pemText) {
      formData.append('pemText', pemText)
    }
    return formData
  }

  const handleGenerateKey = async () => {
    setGenerating(true)
    setInlineError(null)
    try {
      const response = await fetch('/api/providers/vps/generate-key', {
        method: 'POST',
        credentials: 'include',
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to generate key pair')
      }
      setPemText(result.privateKey)
      setGeneratedPublicKey(result.publicKey)
      setPemFile(null)
      actions.notify({ kind: 'success', title: 'Key pair generated', message: 'Add the public key to your VPS.' })
    } catch (err: any) {
      setInlineError(err?.message || 'Failed to generate key pair')
    } finally {
      setGenerating(false)
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,8,12,0.72)] p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[28px] border border-[var(--cf-border)] bg-[var(--cf-shell-card-strong)] p-6 shadow-[0_36px_90px_rgba(0,0,0,0.42)]">
        <div className="mb-6">
          <div className="cf-kicker mb-2">VPS / SFTP</div>
          <h3 className="text-xl font-semibold text-[var(--cf-text-0)]">{isEditMode ? 'Edit VPS / SFTP' : 'Connect VPS / SFTP'}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--cf-text-1)]">
            {isEditMode
              ? 'Update the saved VPS details. Test the connection before saving transport changes.'
              : 'Test the connection first, then save the VPS using PEM key authentication.'}
          </p>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-[22px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-3">
            <div className="cf-kicker mb-1">Mode</div>
            <div className="text-sm font-semibold text-[var(--cf-text-0)]">{isEditMode ? 'Saved node update' : 'New saved node'}</div>
          </div>
          <div className="rounded-[22px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-3">
            <div className="cf-kicker mb-1">Transport</div>
            <div className="text-sm font-semibold text-[var(--cf-text-0)]">SSH key auth</div>
          </div>
          <div className="rounded-[22px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-3">
            <div className="cf-kicker mb-1">QA Scope</div>
            <div className="text-sm font-semibold text-[var(--cf-text-0)]">Use mock paths only</div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--cf-text-1)]">
                Label <span className="text-[var(--cf-red)]">*</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="OCI Node 1"
                required
                className="w-full rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-2.5 text-[var(--cf-text-0)] placeholder:text-[var(--cf-text-3)] focus:border-[var(--cf-blue)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--cf-text-1)]">
                Host <span className="text-[var(--cf-red)]">*</span>
              </label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="203.0.113.1"
                required
                className="w-full rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-2.5 text-[var(--cf-text-0)] placeholder:text-[var(--cf-text-3)] focus:border-[var(--cf-blue)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--cf-text-1)]">Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="22"
                className="w-full rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-2.5 text-[var(--cf-text-0)] placeholder:text-[var(--cf-text-3)] focus:border-[var(--cf-blue)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--cf-text-1)]">
                Username <span className="text-[var(--cf-red)]">*</span>
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                required
                className="w-full rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-2.5 text-[var(--cf-text-0)] placeholder:text-[var(--cf-text-3)] focus:border-[var(--cf-blue)] focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
            <div className="cf-kicker mb-2">Credential</div>
            <div className="mb-3 flex items-center justify-between">
              <label className="block text-sm font-medium text-[var(--cf-text-1)]">
                {isEditMode ? 'Replace PEM Key' : 'PEM Key'} {!isEditMode && <span className="text-[var(--cf-red)]">*</span>}
              </label>
              {!isEditMode && (
                <button
                  type="button"
                  onClick={handleGenerateKey}
                  disabled={generating}
                  className="text-xs font-semibold text-[var(--cf-blue)] hover:underline disabled:opacity-50"
                >
                  {generating ? 'Generating…' : 'Generate New Key Pair'}
                </button>
              )}
            </div>
            <input
              type="file"
              accept=".pem,.key"
              onChange={(e) => {
                setPemFile(e.target.files?.[0] || null)
                setPemText(null)
                setGeneratedPublicKey(null)
              }}
              className="w-full rounded-xl border border-[var(--cf-border)] bg-[var(--cf-shell-card)] px-3 py-2.5 text-sm text-[var(--cf-text-1)] file:mr-3 file:rounded-lg file:border-0 file:bg-[rgba(74,158,255,0.14)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--cf-blue)]"
            />
            {generatedPublicKey && (
              <div className="mt-4 rounded-2xl border border-[rgba(74,158,255,0.22)] bg-[rgba(74,158,255,0.06)] p-3">
                <div className="flex items-center justify-between">
                  <div className="cf-kicker text-[10px] text-[var(--cf-blue)] uppercase">Generated Public Key</div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedPublicKey)
                      actions.notify({ kind: 'success', title: 'Copied', message: 'Public key copied to clipboard' })
                    }}
                    className="text-[10px] font-bold text-[var(--cf-blue)] uppercase hover:underline"
                  >
                    Copy
                  </button>
                </div>
                <div className="mt-2 break-all font-mono text-[11px] leading-relaxed text-[var(--cf-text-0)]">
                  {generatedPublicKey}
                </div>
                <p className="mt-2 text-[10px] text-[var(--cf-text-2)]">
                  Add this to <code>~/.ssh/authorized_keys</code> on your server.
                </p>
              </div>
            )}
            <div className="mt-3 space-y-1.5 text-[12px] leading-5 text-[var(--cf-text-2)]">
              {isEditMode && !pemFile && !pemText ? <p>Leave empty to keep the currently saved private key.</p> : null}
              {pemText && !pemFile ? <p className="text-[var(--cf-blue)] font-medium">Using generated key pair.</p> : null}
              <p>Upload your private key or generate a new one. Your private key is encrypted before storage.</p>
              {pemFile ? <p className="text-[var(--cf-text-1)]">Selected: {pemFile.name}</p> : null}
            </div>
          </div>
        </div>

        {testStatus?.kind === 'success' && (
          <div className="mt-4 rounded-[22px] border border-[rgba(74,222,128,0.22)] bg-[rgba(74,222,128,0.08)] px-4 py-4 text-sm text-[var(--cf-green)]">
            <div className="font-medium">{testStatus.message}</div>
            {testStatus.hostFingerprint ? (
              <div className="mt-3 rounded-2xl border border-[rgba(74,222,128,0.22)] bg-[rgba(255,255,255,0.04)] px-3 py-3">
                <div className="cf-kicker mb-1 text-[9px] text-[var(--cf-green)]">Host Fingerprint</div>
                <div className="break-all font-mono text-xs text-[var(--cf-text-0)]">
                  {testStatus.hostFingerprint}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {inlineError && (
          <div className="mt-4 rounded-[22px] border border-[rgba(255,92,92,0.2)] bg-[rgba(255,92,92,0.08)] px-4 py-3 text-sm text-[var(--cf-red)]">
            {inlineError}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 rounded-xl border border-[var(--cf-border)] px-4 py-2.5 text-sm font-medium text-[var(--cf-text-1)] transition hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
          >
            Cancel
          </button>
          <button
            onClick={handleTestConnection}
            disabled={testing || submitting}
            className="flex-1 rounded-xl border border-[rgba(74,158,255,0.2)] px-4 py-2.5 text-sm font-medium text-[var(--cf-blue)] transition hover:bg-[rgba(74,158,255,0.08)] disabled:opacity-50"
          >
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <button
            onClick={handleSave}
            disabled={submitting || testing}
            className="flex-1 rounded-xl border border-[rgba(74,158,255,0.28)] bg-[rgba(74,158,255,0.14)] px-4 py-2.5 text-sm font-medium text-[var(--cf-blue)] transition hover:bg-[rgba(74,158,255,0.2)] disabled:opacity-50"
          >
            {submitting ? (isEditMode ? 'Saving…' : 'Connecting…') : isEditMode ? 'Save Changes' : 'Save VPS'}
          </button>
        </div>
      </div>
    </div>
  )
}
