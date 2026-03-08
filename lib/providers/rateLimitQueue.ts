/**
 * Rate Limit Queue — per-provider request queue with back-pressure and retry.
 *
 * Provides a concurrency-controlled, rate-limit-aware request dispatcher for
 * provider API calls.  Each provider gets its own queue governed by:
 *
 *   - `maxConcurrent`   — max in-flight requests at any moment
 *   - `minIntervalMs`   — minimum wall-clock gap between consecutive dispatches
 *   - `retryAfterMs`    — override delay when a 429 response sets `Retry-After`
 *
 * Usage:
 * ```ts
 * const result = await providerQueue.enqueue('google', () => fetch(...));
 * ```
 *
 * Gate: TRANSFER-1
 * Task: 3.15@TRANSFER-1
 */

import { ErrorCode } from '../errors/ErrorCode'
import { AppError } from '../errors/AppError'
import { ProviderId } from './types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-provider concurrency / rate-limit configuration. */
export interface ProviderQueueConfig {
  /** Max simultaneous in-flight requests to this provider. */
  maxConcurrent: number
  /** Minimum ms between consecutive request dispatches (token-bucket floor). */
  minIntervalMs: number
  /**
   * Max ms to wait for a slot before giving up with RATE_LIMITED.
   * Defaults to 30_000.
   */
  queueTimeoutMs?: number
}

/** Shape of a queued work item. */
interface QueueEntry<T> {
  fn: () => Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
  enqueuedAt: number
  timeoutHandle?: ReturnType<typeof setTimeout>
}

/** Live state tracked per provider queue. */
interface ProviderQueueState<T = unknown> {
  config: Required<ProviderQueueConfig>
  pending: QueueEntry<T>[]
  inflight: number
  /** Timestamp of the last dispatched request (epoch ms). */
  lastDispatchAt: number
  /**
   * When non-null, the queue is paused until this epoch ms.
   * Set by a 429 Retry-After header.
   */
  pausedUntil: number | null
  /** Timer handle for the rate-limit pause wakeup. */
  pauseTimer: ReturnType<typeof setTimeout> | null
}

/** Outcome from a rate-limited provider call. */
export interface RateLimitedCallResult<T> {
  data: T
  /** True when the request was delayed due to an active back-off pause. */
  wasDelayed: boolean
  /** Wall-clock wait before dispatch started (ms). */
  waitMs: number
}

// ---------------------------------------------------------------------------
// Per-provider defaults
// ---------------------------------------------------------------------------

/**
 * Baseline rate-limit configs derived from published or empirically observed
 * provider limits.  Callers may override via `configure()`.
 *
 * Sources:
 *   Google Drive  — 1 000 req/100 s per user  (≈10/s → 100 ms floor)
 *   OneDrive      — 10 000 req/10 min per app  (≈16/s → 60 ms floor), 4 concurrent
 *   Dropbox       — 200/user/s burst; team share → conservative 10 concurrent
 *   Box           — 1 000 req/min per user  (≈16/s → 60 ms floor)
 *   pCloud        — undocumented; conservative
 *   Filen         — undocumented; conservative
 *   Yandex        — undocumented; conservative
 *   WebDAV / VPS  — no provider limit; locally generous
 *   local         — no limit
 */
const PROVIDER_DEFAULTS: Record<ProviderId, ProviderQueueConfig> = {
  google: { maxConcurrent: 6, minIntervalMs: 110 },
  onedrive: { maxConcurrent: 4, minIntervalMs: 65 },
  dropbox: { maxConcurrent: 10, minIntervalMs: 50 },
  box: { maxConcurrent: 4, minIntervalMs: 65 },
  pcloud: { maxConcurrent: 3, minIntervalMs: 200 },
  filen: { maxConcurrent: 3, minIntervalMs: 200 },
  yandex: { maxConcurrent: 3, minIntervalMs: 200 },
  webdav: { maxConcurrent: 8, minIntervalMs: 0 },
  vps: { maxConcurrent: 8, minIntervalMs: 0 },
  local: { maxConcurrent: 16, minIntervalMs: 0 },
}

const DEFAULT_QUEUE_TIMEOUT_MS = 30_000

// ---------------------------------------------------------------------------
// RateLimitQueue class
// ---------------------------------------------------------------------------

/**
 * Per-provider request queue.
 *
 * Singleton via `getRateLimitQueue()`.  Do not instantiate directly in
 * application code.
 */
export class RateLimitQueue {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly queues = new Map<string, ProviderQueueState<any>>()

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  /**
   * Override queue config for a provider.  Safe to call at any time; changes
   * take effect on the next dispatch.
   */
  configure(providerId: ProviderId, overrides: Partial<ProviderQueueConfig>): void {
    const existing = this.getOrCreate(providerId)
    existing.config = {
      ...existing.config,
      ...overrides,
      queueTimeoutMs: overrides.queueTimeoutMs ?? existing.config.queueTimeoutMs,
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Enqueue a provider API call.
   *
   * The returned promise resolves/rejects when `fn` resolves/rejects or when
   * the queue-wait timeout fires.
   *
   * If the provider is currently paused due to a 429 back-off, the call waits
   * until the pause expires before being dispatched.
   *
   * @param providerId  Target provider key.
   * @param fn          Async factory that performs the actual HTTP call.
   * @returns           Resolved value of `fn` wrapped in `RateLimitedCallResult`.
   */
  enqueue<T>(
    providerId: ProviderId,
    fn: () => Promise<T>,
  ): Promise<RateLimitedCallResult<T>> {
    const state = this.getOrCreate(providerId)
    const enqueuedAt = Date.now()

    return new Promise<RateLimitedCallResult<T>>((resolve, reject) => {
      // Wrap the caller's fn so we can capture timing metadata.
      const wrappedFn = async (): Promise<RateLimitedCallResult<T>> => {
        const waitMs = Date.now() - enqueuedAt
        const wasDelayed = waitMs > 5 // >5 ms means we actually waited
        const data = await fn()
        return { data, wasDelayed, waitMs }
      }

      const entry: QueueEntry<RateLimitedCallResult<T>> = {
        fn: wrappedFn,
        resolve,
        reject,
        enqueuedAt,
      }

      // Set queue-wait timeout.
      const timeoutMs = state.config.queueTimeoutMs
      entry.timeoutHandle = setTimeout(() => {
        // Remove from pending if still there.
        const idx = (state.pending as QueueEntry<unknown>[]).indexOf(
          entry as QueueEntry<unknown>,
        )
        if (idx !== -1) {
          state.pending.splice(idx, 1)
        }
        reject(
          new AppError({
            code: ErrorCode.RATE_LIMITED,
            message: `Provider "${providerId}" queue wait exceeded ${timeoutMs} ms`,
            retryable: true,
            details: { providerId, queueTimeoutMs: timeoutMs },
          }),
        )
      }, timeoutMs)

      ;(state.pending as QueueEntry<unknown>[]).push(entry as QueueEntry<unknown>)
      this.scheduleDispatch(providerId)
    })
  }

  /**
   * Signal that a 429 was received from a provider.
   *
   * Pauses the queue for `retryAfterMs` milliseconds.  In-flight requests are
   * not cancelled (they have already been dispatched); future requests are
   * held until the pause expires.
   *
   * @param providerId    Provider that returned 429.
   * @param retryAfterMs  Delay before resuming dispatch (default: 60 000 ms).
   */
  applyRateLimitBackoff(providerId: ProviderId, retryAfterMs = 60_000): void {
    const state = this.getOrCreate(providerId)
    const resumeAt = Date.now() + retryAfterMs

    if (state.pausedUntil !== null && resumeAt <= state.pausedUntil) {
      // Already paused for at least as long — do not shorten the pause.
      return
    }

    if (state.pauseTimer !== null) {
      clearTimeout(state.pauseTimer)
    }

    state.pausedUntil = resumeAt

    console.warn(
      `[RateLimitQueue] Provider "${providerId}" rate-limited. ` +
        `Pausing dispatch for ${retryAfterMs} ms.`,
    )

    state.pauseTimer = setTimeout(() => {
      state.pausedUntil = null
      state.pauseTimer = null
      console.info(
        `[RateLimitQueue] Provider "${providerId}" rate-limit pause lifted. ` +
          `Resuming dispatch (${state.pending.length} items pending).`,
      )
      this.scheduleDispatch(providerId)
    }, retryAfterMs)
  }

  /**
   * Snapshot of current queue state for a provider.
   *
   * Useful for observability / admin endpoints.
   */
  getStats(providerId: ProviderId): {
    inflight: number
    pending: number
    pausedUntil: number | null
    config: Required<ProviderQueueConfig>
  } {
    const state = this.getOrCreate(providerId)
    return {
      inflight: state.inflight,
      pending: state.pending.length,
      pausedUntil: state.pausedUntil,
      config: { ...state.config },
    }
  }

  /**
   * Snapshot of all tracked provider queues.
   */
  getAllStats(): Record<string, ReturnType<RateLimitQueue['getStats']>> {
    const result: Record<string, ReturnType<RateLimitQueue['getStats']>> = {}
    for (const [key] of this.queues) {
      result[key] = this.getStats(key as ProviderId)
    }
    return result
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private getOrCreate(providerId: ProviderId): ProviderQueueState {
    if (!this.queues.has(providerId)) {
      const defaults = PROVIDER_DEFAULTS[providerId] ?? {
        maxConcurrent: 4,
        minIntervalMs: 200,
      }
      this.queues.set(providerId, {
        config: {
          ...defaults,
          queueTimeoutMs: defaults.queueTimeoutMs ?? DEFAULT_QUEUE_TIMEOUT_MS,
        },
        pending: [],
        inflight: 0,
        lastDispatchAt: 0,
        pausedUntil: null,
        pauseTimer: null,
      })
    }
    return this.queues.get(providerId)!
  }

  private scheduleDispatch(providerId: ProviderId): void {
    const state = this.getOrCreate(providerId)

    // Paused — do not dispatch.
    if (state.pausedUntil !== null) {
      return
    }

    if (state.pending.length === 0) {
      return
    }

    if (state.inflight >= state.config.maxConcurrent) {
      // A slot will open when an in-flight request completes.
      return
    }

    const now = Date.now()
    const sinceLastDispatch = now - state.lastDispatchAt
    const remaining = state.config.minIntervalMs - sinceLastDispatch

    if (remaining > 0) {
      // Schedule dispatch once the interval has elapsed.
      setTimeout(() => this.dispatch(providerId), remaining)
      return
    }

    this.dispatch(providerId)
  }

  private dispatch(providerId: ProviderId): void {
    const state = this.getOrCreate(providerId)

    // Re-check pause — the pause may have been applied between schedule and dispatch.
    if (state.pausedUntil !== null && Date.now() < state.pausedUntil) {
      return
    }

    if (state.pending.length === 0 || state.inflight >= state.config.maxConcurrent) {
      return
    }

    const entry = state.pending.shift()!

    // Clear the queue-wait timeout for this entry.
    if (entry.timeoutHandle !== undefined) {
      clearTimeout(entry.timeoutHandle)
    }

    state.inflight++
    state.lastDispatchAt = Date.now()

    entry.fn().then(
      (result) => {
        state.inflight--
        entry.resolve(result)
        // Dispatch the next item if any.
        this.scheduleDispatch(providerId)
      },
      (err: unknown) => {
        state.inflight--
        entry.reject(err)
        this.scheduleDispatch(providerId)
      },
    )
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: RateLimitQueue | null = null

/**
 * Return the process-wide singleton `RateLimitQueue`.
 *
 * Calling this multiple times is safe and always returns the same instance.
 */
export function getRateLimitQueue(): RateLimitQueue {
  if (_instance === null) {
    _instance = new RateLimitQueue()
  }
  return _instance
}

/**
 * Parse the `Retry-After` response header into milliseconds.
 *
 * Handles both delta-seconds (`120`) and HTTP-date formats.
 * Returns `null` when the header is absent or unparseable.
 */
export function parseRetryAfterMs(
  headers: Headers | Record<string, string | null | undefined>,
): number | null {
  const raw =
    headers instanceof Headers
      ? headers.get('retry-after')
      : (headers['retry-after'] ?? headers['Retry-After'] ?? null)

  if (!raw) return null

  // Delta-seconds: "120"
  const seconds = Number(raw)
  if (!isNaN(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1_000)
  }

  // HTTP-date: "Wed, 21 Oct 2015 07:28:00 GMT"
  const date = new Date(raw)
  if (!isNaN(date.getTime())) {
    const delta = date.getTime() - Date.now()
    return delta > 0 ? delta : 0
  }

  return null
}

