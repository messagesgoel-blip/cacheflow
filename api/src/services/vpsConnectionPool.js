const { Client } = require('ssh2');

const MAX_SESSIONS_PER_PROVIDER = 3;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const pools = new Map();

function getPool(providerId) {
  let pool = pools.get(providerId);
  if (!pool) {
    pool = {
      sessions: [],
      waiters: [],
      idleTimer: null,
    };
    pools.set(providerId, pool);
  }
  return pool;
}

function scheduleIdleCleanup(providerId, pool) {
  if (pool.idleTimer) {
    clearTimeout(pool.idleTimer);
    pool.idleTimer = null;
  }
  if (pool.sessions.some((session) => session.busy)) return;
  pool.idleTimer = setTimeout(() => {
    drain(providerId).catch((err) => {
      console.error('[vps-pool] idle cleanup failed:', err.message);
    });
  }, IDLE_TIMEOUT_MS);
}

function wakeWaiter(pool) {
  const waiter = pool.waiters.shift();
  if (waiter) waiter();
}

function removeSession(providerId, pool, entry) {
  const index = pool.sessions.indexOf(entry);
  if (index >= 0) pool.sessions.splice(index, 1);
  if (entry.client) {
    try {
      entry.client.end();
      entry.client.destroy();
    } catch {}
  }
  wakeWaiter(pool);
  if (pool.sessions.length === 0 && pool.waiters.length === 0) {
    if (pool.idleTimer) {
      clearTimeout(pool.idleTimer);
      pool.idleTimer = null;
    }
    pools.delete(providerId);
    return;
  }
  scheduleIdleCleanup(providerId, pool);
}

function createSession(providerId, connectConfig, pool) {
  return new Promise((resolve, reject) => {
    const client = new Client();
    const entry = {
      client,
      busy: true,
      closed: false,
      lastUsedAt: Date.now(),
    };

    const onError = (err) => {
      if (!entry.closed) {
        entry.closed = true;
      }
      reject(err);
    };

    client.once('ready', () => {
      client.removeListener('error', onError);
      pool.sessions.push(entry);
      client.on('close', () => {
        entry.closed = true;
        removeSession(providerId, pool, entry);
      });
      client.on('error', () => {
        entry.closed = true;
      });
      resolve(entry);
    });

    client.once('error', onError);
    client.connect({
      host: connectConfig.host,
      port: connectConfig.port,
      username: connectConfig.username,
      privateKey: connectConfig.privateKey,
      readyTimeout: connectConfig.readyTimeout ?? 15000,
    });
  });
}

async function acquire(providerId, connectConfig) {
  const pool = getPool(providerId);
  if (pool.idleTimer) {
    clearTimeout(pool.idleTimer);
    pool.idleTimer = null;
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const reusable = pool.sessions.find((session) => !session.busy && !session.closed);
    if (reusable) {
      reusable.busy = true;
      reusable.lastUsedAt = Date.now();
      return reusable;
    }

    if (pool.sessions.length < MAX_SESSIONS_PER_PROVIDER) {
      return createSession(providerId, connectConfig, pool);
    }

    await new Promise((resolve) => pool.waiters.push(resolve));
  }
}

function release(providerId, entry, broken = false) {
  const pool = pools.get(providerId);
  if (!pool) return;
  if (broken || entry.closed) {
    removeSession(providerId, pool, entry);
    return;
  }
  entry.busy = false;
  entry.lastUsedAt = Date.now();
  wakeWaiter(pool);
  scheduleIdleCleanup(providerId, pool);
}

async function drain(providerId) {
  const pool = pools.get(providerId);
  if (!pool) return;
  if (pool.idleTimer) {
    clearTimeout(pool.idleTimer);
    pool.idleTimer = null;
  }
  for (const entry of [...pool.sessions]) {
    removeSession(providerId, pool, entry);
  }
  pools.delete(providerId);
}

module.exports = {
  acquire,
  release,
  drain,
  MAX_SESSIONS_PER_PROVIDER,
  IDLE_TIMEOUT_MS,
};

