/**
 * SSH2 Connection Manager with LRU Session Reuse
 *
 * Manages a pool of SSH2 client connections keyed by host identity.
 * Uses an LRU eviction policy to cap memory usage while keeping
 * frequently-used sessions alive, avoiding the latency of reconnecting
 * on every provider operation.
 *
 * Security note (SEC-1): private keys and passwords are held only in
 * memory within the active LRU entry and are never written to disk by
 * this module. Entries are destroyed (connection closed) on eviction
 * or explicit release.
 *
 * Gate: SEC-1
 * Task: 4.4
 */

import { EventEmitter } from 'events';
import { AppError } from '../../errors/AppError';
import { ErrorCode } from '../../errors/ErrorCode';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Auth configuration for a VPS / SSH target. */
export interface SSHAuthConfig {
  /** Unique identifier for this credential set (e.g. remoteId from DB). */
  id: string;
  host: string;
  port: number;
  username: string;
  /** Mutually exclusive with privateKey. */
  password?: string;
  /** PEM-encoded private key. Mutually exclusive with password. */
  privateKey?: string;
  /** Optional passphrase for an encrypted private key. */
  passphrase?: string;
  /** Expected SHA256 fingerprint (e.g. 'SHA256:...'). If provided, connection fails on mismatch. */
  hostFingerprint?: string;
  /** Connection timeout in milliseconds (default: 10 000). */
  connectTimeoutMs?: number;
}

/** Thin wrapper around an ssh2 Client that tracks its liveness. */
export interface ManagedSSHSession {
  readonly id: string;
  /** True while the underlying TCP connection is open and ready. */
  readonly alive: boolean;
  /** Raw ssh2 Client — consumers must NOT call .end() themselves. */
  readonly client: import('ssh2').Client;
  /** ISO timestamp of when this session was established. */
  readonly connectedAt: string;
  /** Number of in-flight operations currently using this session. */
  refCount: number;
}

/** Options for SSHConnectionManager. */
export interface SSHConnectionManagerOptions {
  /**
   * Maximum number of concurrent SSH sessions kept in the LRU cache.
   * Default: 20.
   */
  maxSessions?: number;
  /**
   * Idle TTL in milliseconds. A session unused for longer than this will
   * be eligible for eviction even if the LRU cap has not been reached.
   * Default: 5 * 60 * 1 000 (5 minutes).
   */
  idleTtlMs?: number;
}

// ---------------------------------------------------------------------------
// Internal LRU node
// ---------------------------------------------------------------------------

interface LRUNode {
  key: string;
  session: ManagedSSHSession;
  /** Timestamp of the most-recent acquire() call for this entry. */
  lastUsedAt: number;
  prev: LRUNode | null;
  next: LRUNode | null;
}

// ---------------------------------------------------------------------------
// SSHConnectionManager
// ---------------------------------------------------------------------------

/**
 * Thread-safe (single-threaded Node.js event loop) LRU pool of SSH sessions.
 *
 * Usage:
 *   const session = await manager.acquire(authConfig);
 *   try {
 *     // use session.client
 *   } finally {
 *     manager.release(session.id);
 *   }
 */
export class SSHConnectionManager extends EventEmitter {
  private readonly maxSessions: number;
  private readonly idleTtlMs: number;

  /** Map from session id to LRU doubly-linked-list node. */
  private readonly map: Map<string, LRUNode> = new Map();

  /** Sentinel head/tail for O(1) LRU operations. Head = most-recent. */
  private readonly head: LRUNode;
  private readonly tail: LRUNode;

  /** Tracks in-flight connect() Promises to prevent duplicate connections. */
  private readonly pending: Map<string, Promise<ManagedSSHSession>> = new Map();

  /** Timer handle for the periodic idle-eviction sweep. */
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: SSHConnectionManagerOptions = {}) {
    super();
    this.maxSessions = options.maxSessions ?? 20;
    this.idleTtlMs = options.idleTtlMs ?? 5 * 60 * 1_000;

    // Initialise dummy head / tail sentinels.
    this.head = { key: '', session: null as any, lastUsedAt: 0, prev: null, next: null };
    this.tail = { key: '', session: null as any, lastUsedAt: 0, prev: null, next: null };
    this.head.next = this.tail;
    this.tail.prev = this.head;

    this.startSweep();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Acquire a live SSH session for the given credentials.
   *
   * If a session for `config.id` already exists in the LRU cache and is
   * alive it is returned immediately (incrementing its refCount). Otherwise
   * a new SSH connection is established.
   *
   * Only one connection attempt per `config.id` runs concurrently — any
   * additional callers for the same id await the single in-flight Promise.
   */
  async acquire(config: SSHAuthConfig): Promise<ManagedSSHSession> {
    const key = config.id;

    // Fast path: cached & alive.
    const existing = this.map.get(key);
    if (existing && existing.session.alive) {
      this.promoteToHead(existing);
      existing.lastUsedAt = Date.now();
      existing.session.refCount++;
      return existing.session;
    }

    // If there is a dead entry, evict it before connecting.
    if (existing) {
      this.evictNode(existing);
    }

    // Deduplicate concurrent connect() calls for the same key.
    const inflight = this.pending.get(key);
    if (inflight) {
      return inflight;
    }

    const connectPromise = this.connect(config).then((session) => {
      this.pending.delete(key);
      this.insertToHead(key, session);
      this.enforceCapacity();
      return session;
    }).catch((err) => {
      this.pending.delete(key);
      throw err;
    });

    this.pending.set(key, connectPromise);
    return connectPromise;
  }

  /**
   * Decrement the refCount for a session.
   * Does NOT close the connection — the LRU eviction policy handles that.
   */
  release(sessionId: string): void {
    const node = this.map.get(sessionId);
    if (!node) return;
    if (node.session.refCount > 0) {
      node.session.refCount--;
    }
  }

  /**
   * Forcibly close and remove a session from the pool.
   * Use when a session has irrecoverably failed mid-operation.
   */
  destroy(sessionId: string): void {
    const node = this.map.get(sessionId);
    if (!node) return;
    this.evictNode(node);
  }

  /**
   * Return a snapshot of currently cached session metadata (no credentials).
   */
  stats(): Array<{ id: string; alive: boolean; refCount: number; connectedAt: string; lastUsedAt: number }> {
    return Array.from(this.map.values()).map((n) => ({
      id: n.session.id,
      alive: n.session.alive,
      refCount: n.session.refCount,
      connectedAt: n.session.connectedAt,
      lastUsedAt: n.lastUsedAt,
    }));
  }

  /**
   * Drain all sessions and stop the background sweep.
   * Call on process shutdown.
   */
  async shutdown(): Promise<void> {
    if (this.sweepTimer !== null) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    for (const node of Array.from(this.map.values())) {
      this.evictNode(node);
    }
  }

  // -------------------------------------------------------------------------
  // Internal — LRU operations
  // -------------------------------------------------------------------------

  private promoteToHead(node: LRUNode): void {
    this.detach(node);
    this.attachAfterHead(node);
  }

  private insertToHead(key: string, session: ManagedSSHSession): void {
    const node: LRUNode = {
      key,
      session,
      lastUsedAt: Date.now(),
      prev: null,
      next: null,
    };
    this.attachAfterHead(node);
    this.map.set(key, node);
  }

  private detach(node: LRUNode): void {
    const prev = node.prev!;
    const next = node.next!;
    prev.next = next;
    next.prev = prev;
  }

  private attachAfterHead(node: LRUNode): void {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  /** Evict the least-recently-used entry (the node just before tail). */
  private evictLRU(): void {
    const lru = this.tail.prev;
    if (lru === null || lru === this.head) return;
    this.evictNode(lru);
  }

  private evictNode(node: LRUNode): void {
    this.detach(node);
    this.map.delete(node.key);
    this.closeSession(node.session);
    this.emit('evict', { id: node.session.id });
  }

  private enforceCapacity(): void {
    while (this.map.size > this.maxSessions) {
      this.evictLRU();
    }
  }

  // -------------------------------------------------------------------------
  // Internal — SSH2 lifecycle
  // -------------------------------------------------------------------------

  /**
   * Open a new SSH connection, returning a ManagedSSHSession.
   * Throws AppError on failure.
   */
  private connect(config: SSHAuthConfig): Promise<ManagedSSHSession> {
    return new Promise<ManagedSSHSession>((resolve, reject) => {
      // Dynamic require so that downstream bundles that exclude ssh2 don't break.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      let Client: new () => import('ssh2').Client;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        Client = require('ssh2').Client;
      } catch {
        reject(new AppError({
          code: ErrorCode.PROVIDER_UNAVAILABLE,
          message: 'ssh2 package is not installed. Add it to your dependencies.',
          retryable: false,
        }));
        return;
      }

      const client = new Client();
      let settled = false;

      const connectTimeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        client.destroy();
        reject(new AppError({
          code: ErrorCode.PROVIDER_UNAVAILABLE,
          message: `SSH connect timed out after ${config.connectTimeoutMs ?? 10_000} ms (host: ${config.host})`,
          retryable: true,
          details: { host: config.host, port: config.port },
        }));
      }, config.connectTimeoutMs ?? 10_000);

      const session: ManagedSSHSession = {
        id: config.id,
        get alive() { return (client as any)._sock !== null && (client as any)._sock !== undefined && !(client as any)._sock.destroyed; },
        client,
        connectedAt: new Date().toISOString(),
        refCount: 1,
      };

      client.on('ready', () => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimeout);
        resolve(session);
      });

      client.on('error', (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimeout);

        // Distinguish auth failure from network failure.
        const isAuthError = /authentication/i.test(err.message) || /auth failed/i.test(err.message);
        reject(new AppError({
          code: isAuthError ? ErrorCode.UNAUTHORIZED : ErrorCode.PROVIDER_UNAVAILABLE,
          message: `SSH connection error: ${err.message}`,
          retryable: !isAuthError,
          cause: err,
          details: { host: config.host, port: config.port, username: config.username },
        }));
      });

      client.on('close', () => {
        // The 'alive' getter reflects the underlying socket state; no extra
        // action needed here. The next acquire() for this id will see alive=false
        // and evict the dead entry.
        this.emit('close', { id: config.id });
      });

      // Build ssh2 connect options. Never log credentials.
      const connectOpts: Record<string, unknown> = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: config.connectTimeoutMs ?? 10_000,
        hostHash: 'sha256',
        hostVerifier: (hashedKey: string) => {
          const actualFingerprint = `SHA256:${hashedKey}`;
          if (config.hostFingerprint && config.hostFingerprint !== actualFingerprint) {
            this.emit('fingerprint-mismatch', {
              id: config.id,
              expected: config.hostFingerprint,
              actual: actualFingerprint,
            });
            // We return true here but let the client throw on mismatch if we want to be strict,
            // or we can reject the promise. Actually, ssh2 expects true/false.
            // If we return false, it will close the connection and throw an error.
            return false;
          }
          return true;
        },
        // Harden: reject unknown host key algorithms that allow downgrade attacks.
        algorithms: {
          serverHostKey: [
            'ssh-ed25519',
            'ecdsa-sha2-nistp256',
            'ecdsa-sha2-nistp384',
            'ecdsa-sha2-nistp521',
            'rsa-sha2-512',
            'rsa-sha2-256',
          ],
        },
      };

      if (config.privateKey !== undefined) {
        connectOpts['privateKey'] = config.privateKey;
        if (config.passphrase !== undefined) {
          connectOpts['passphrase'] = config.passphrase;
        }
      } else if (config.password !== undefined) {
        connectOpts['password'] = config.password;
      } else {
        clearTimeout(connectTimeout);
        reject(new AppError({
          code: ErrorCode.UNAUTHORIZED,
          message: 'SSH auth config must provide either password or privateKey.',
          retryable: false,
        }));
        return;
      }

      client.connect(connectOpts as Parameters<import('ssh2').Client['connect']>[0]);
    });
  }

  private closeSession(session: ManagedSSHSession): void {
    try {
      session.client.end();
    } catch {
      // Ignore — session may already be closed.
    }
  }

  // -------------------------------------------------------------------------
  // Internal — idle sweep
  // -------------------------------------------------------------------------

  private startSweep(): void {
    // Sweep every 60 seconds for idle sessions.
    this.sweepTimer = setInterval(() => {
      this.sweepIdle();
    }, 60_000);

    // Do not prevent process exit.
    if (this.sweepTimer.unref) {
      this.sweepTimer.unref();
    }
  }

  private sweepIdle(): void {
    const now = Date.now();
    for (const node of Array.from(this.map.values())) {
      const idle = now - node.lastUsedAt;
      if (idle > this.idleTtlMs && node.session.refCount === 0) {
        this.evictNode(node);
        this.emit('idle-evict', { id: node.session.id, idleMs: idle });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton (process-wide pool, shared across all VPS adapters)
// ---------------------------------------------------------------------------

/** Process-wide singleton SSH connection pool. */
export const sshConnectionManager = new SSHConnectionManager({
  maxSessions: 20,
  idleTtlMs: 5 * 60 * 1_000,
});
