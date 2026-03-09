/**
 * Job Log Panel
 *
 * Terminal-like view for real-time BullMQ worker logs over SSE.
 * Displays job progress, status, and error messages in a streaming log format.
 *
 * Gate: SSE-1
 * Task: 6.2@LOGS-1
 *
 * Endpoints:
 * - /api/jobs/logs?jobId=xxx - Worker log events (primary, LOGS-1)
 * - /api/transfers/[id]/progress - Transfer progress (fallback)
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  data?: Record<string, unknown>;
}

export interface JobLogPanelProps {
  jobId: string;
  jobType?: 'transfer' | 'scheduled' | 'rate_limit';
  title?: string;
  onClose?: () => void;
}

/** Worker log entry from /api/jobs/logs endpoint */
interface WorkerLogEvent {
  jobId: string;
  jobType: 'transfer' | 'scheduled';
  userId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

/** Legacy progress event from /api/transfers/[id]/progress */
interface ProgressEvent {
  type: 'progress' | 'complete' | 'error' | 'heartbeat';
  jobId: string;
  progress?: number | Record<string, unknown>;
  status?: string;
  terminalPayload?: Record<string, unknown>;
  payload?: {
    progress: number | Record<string, unknown>;
    total?: number;
    message?: string;
    timestamp: string;
    data?: Record<string, unknown>;
  };
  error?: string;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function levelColor(level: LogEntry['level']): string {
  switch (level) {
    case 'error':
      return 'text-[var(--cf-red)]';
    case 'warn':
      return 'text-[var(--cf-yellow)]';
    case 'success':
      return 'text-[var(--cf-green)]';
    default:
      return 'text-[var(--cf-text-2)]';
  }
}

function levelPrefix(level: LogEntry['level']): string {
  switch (level) {
    case 'error':
      return '✗';
    case 'warn':
      return '⚠';
    case 'success':
      return '✓';
    default:
      return '›';
  }
}

function resolveNumericProgress(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export default function JobLogPanel({
  jobId,
  jobType = 'transfer',
  title = 'Job Logs',
  onClose,
}: JobLogPanelProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const logIdCounter = useRef(0);

  const addLog = useCallback((level: LogEntry['level'], message: string, data?: Record<string, unknown>) => {
    const newLog: LogEntry = {
      id: `log-${logIdCounter.current++}`,
      timestamp: new Date(),
      level,
      message,
      data,
    };
    setLogs((prev) => [...prev, newLog]);
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setLogs([]);
    setIsConnected(false);
    setIsComplete(false);
    setProgress(0);
    logIdCounter.current = 0;

    // Primary: Use the dedicated worker log endpoint (LOGS-1)
    const logsEndpoint = `/api/jobs/logs?jobId=${encodeURIComponent(jobId)}`;
    const es = new EventSource(logsEndpoint);
    eventSourceRef.current = es;

    addLog('info', `Connecting to job ${jobId}...`);

    // Handle connection established
    es.addEventListener('connected', (event) => {
      setIsConnected(true);
      try {
        const data = JSON.parse(event.data);
        addLog('info', `Connected to log stream`, { jobId: data.jobId });
      } catch {
        addLog('info', 'Connected to log stream');
      }
    });

    // Handle worker log events (LOGS-1) - primary event type
    es.addEventListener('log', (event) => {
      try {
        const data: WorkerLogEvent = JSON.parse(event.data);

        // Map worker log level to our log entry level
        const levelMap: Record<string, LogEntry['level']> = {
          info: 'info',
          warn: 'warn',
          error: 'error',
          debug: 'info',
        };

        const level = levelMap[data.level] || 'info';
        addLog(level, data.message, data.data);

        // Update progress if available in data
        const logProgress = resolveNumericProgress(data.data?.progress);
        if (logProgress !== undefined) {
          setProgress(logProgress);
        }
      } catch (err) {
        console.error('Failed to parse log event:', err);
      }
    });

    // Handle progress events (fallback from transfer endpoint)
    es.addEventListener('progress', (event) => {
      try {
        const data: ProgressEvent = JSON.parse(event.data);
        const progressVal = resolveNumericProgress(data.payload?.progress)
          ?? resolveNumericProgress(data.progress);

        if (progressVal !== undefined) {
          setProgress(progressVal);
        }

        const message = data.payload?.message
          ?? (progressVal !== undefined ? `Progress: ${Math.round(progressVal)}%` : 'Progress updated');
        addLog('info', message, {
          progress: progressVal,
          total: data.payload?.total,
          fileName: data.payload?.data?.fileName,
          operation: data.payload?.data?.operation,
        });
      } catch (err) {
        console.error('Failed to parse progress event:', err);
      }
    });

    // Handle completion
    es.addEventListener('done', (event) => {
      try {
        const data: ProgressEvent = JSON.parse(event.data);
        if (data.status === 'completed') {
          addLog('success', 'Job completed successfully', { jobId });
          setProgress(100);
          setIsComplete(true);
        } else if (data.status === 'failed') {
          const errorMessage = typeof data.error === 'string' && data.error.trim() !== ''
            ? data.error
            : 'Job failed';
          addLog('error', errorMessage, {
            jobId,
            error: data.error,
            terminalPayload: data.terminalPayload,
          });
          setIsComplete(true);
        }
      } catch {
        addLog('success', 'Job stream ended');
        setIsComplete(true);
      }
      setIsConnected(false);
      es.close();
    });

    es.onerror = (err) => {
      console.error('SSE error:', err);
      addLog('error', 'Connection lost, attempting to reconnect...');
      setIsConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [jobId, addLog]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return (
    <div className="flex h-full flex-col rounded-lg border border-[var(--cf-border)] bg-[var(--cf-shell-card-strong)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--cf-border)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'animate-pulse bg-[var(--cf-green)]' : 'bg-[var(--cf-text-3)]'
              }`}
            />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--cf-text-2)]">
              {jobType}
            </span>
          </div>
          <span className="font-mono text-xs text-[var(--cf-text-3)]" title={jobId}>
            {jobId.slice(0, 12)}...
          </span>
          {progress > 0 && (
            <span className="font-mono text-xs font-bold text-[var(--cf-blue)]">
              {Math.round(progress)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearLogs}
            data-testid="job-log-panel-clear"
            className="rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--cf-text-2)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
            title="Clear logs"
          >
            Clear
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              data-testid="job-log-panel-close"
              className="rounded p-1 text-[var(--cf-text-2)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
              title="Close panel"
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {progress > 0 && !isComplete && (
        <div className="h-1 w-full bg-[var(--cf-bg3)]">
          <div
            className="h-full bg-[var(--cf-blue)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Terminal output */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto bg-[var(--cf-bg-deep)] p-3 font-mono text-xs"
        role="log"
        aria-label="Job execution logs"
      >
        {logs.length === 0 ? (
          <div className="text-[var(--cf-text-3)]">Waiting for logs...</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="mb-1 flex gap-2">
              <span className="text-[var(--cf-text-3)]">[{formatTimestamp(log.timestamp)}]</span>
              <span className={levelColor(log.level)}>{levelPrefix(log.level)}</span>
              <span className="flex-1 break-all text-[var(--cf-text-1)]">{log.message}</span>
            </div>
          ))
        )}
        {isComplete && (
          <div className="mt-2 text-[var(--cf-text-2)]">
            — Stream closed —
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[var(--cf-border)] px-4 py-2">
        <span className="font-mono text-[10px] text-[var(--cf-text-3)]">
          {logs.length} entries
        </span>
        <span className={`font-mono text-[10px] ${isConnected ? 'text-[var(--cf-green)]' : 'text-[var(--cf-text-3)]'}`}>
          {isComplete ? 'Completed' : isConnected ? 'Live' : 'Disconnected'}
        </span>
      </div>
    </div>
  );
}
