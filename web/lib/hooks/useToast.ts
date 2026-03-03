/**
 * Minimal toast hook fallback.
 * Keeps build/runtime stable when no UI toast provider is mounted.
 */

export interface ToastApi {
  success: (message: string, title?: string) => void
  error: (message: string, title?: string) => void
  info: (message: string, title?: string) => void
  warning: (message: string, title?: string) => void
}

function emitToast(kind: 'success' | 'error' | 'info' | 'warning', message: string, title?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cacheflow:toast', {
      detail: { kind, title, message },
    }))
    return
  }

  // Server-side no-op logging for diagnostics.
  const prefix = title ? `[${title}]` : '[Toast]'
  // eslint-disable-next-line no-console
  console.log(`${prefix} ${message}`)
}

export function useToast(): ToastApi {
  return {
    success: (message, title) => emitToast('success', message, title),
    error: (message, title) => emitToast('error', message, title),
    info: (message, title) => emitToast('info', message, title),
    warning: (message, title) => emitToast('warning', message, title),
  }
}

export default useToast
