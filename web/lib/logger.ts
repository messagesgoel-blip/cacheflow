// Structured client logger for observability

type LogEvent = 'action_start' | 'action_success' | 'action_fail' | 'modal_open' | 'modal_close'

interface LogPayload {
  event: LogEvent
  actionName?: string
  providerId?: string
  fileId?: string
  currentPath?: string
  correlationId?: string
  error?: string
  [key: string]: any
}

export const actionLogger = {
  log: (payload: LogPayload) => {
    // In dev/QA, we just log to console. In prod, this would go to Datadog/Sentry.
    const timestamp = new Date().toISOString()
    const logEntry = { timestamp, ...payload }

    if (typeof window !== 'undefined') {
      const runtimeWindow = window as Window & {
        __cfActionLogs?: Array<Record<string, unknown>>
      }
      runtimeWindow.__cfActionLogs ||= []
      runtimeWindow.__cfActionLogs.push(logEntry)
    }
    
    if (payload.event === 'action_fail') {
      console.error('[ActionLogger]', JSON.stringify(logEntry))
    } else {
      console.log('[ActionLogger]', JSON.stringify(logEntry))
    }
  },
  
  generateCorrelationId: () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }
}
