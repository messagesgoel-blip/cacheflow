import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const DB_INDEX: Record<RedisNamespace, number> = {
  cache: 0,
  sse: 1,
  transfer: 2,
  rate_limit: 3,
  workers: 4,
};

export type RedisNamespace = 'cache' | 'sse' | 'transfer' | 'rate_limit' | 'workers';

interface RedisClientMap {
  cache: Redis;
  sse: Redis;
  transfer: Redis;
  rate_limit: Redis;
  workers: Redis;
}

const clients: Partial<RedisClientMap> = {};

function createClient(namespace: RedisNamespace): Redis {
  const db = DB_INDEX[namespace];
  const client = new Redis(REDIS_URL, {
    db,
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      if (times > 3) return null;
      return Math.min(times * 200, 2000);
    },
  });

  client.on('error', (err: Error) => {
    console.error(`[redis:${namespace}] connection error`, { error: err.message });
  });

  return client;
}

export function getRedisClient(namespace: RedisNamespace): Redis {
  if (!(namespace in DB_INDEX)) {
    throw new Error(`Invalid Redis namespace: ${namespace}`);
  }

  if (!clients[namespace]) {
    clients[namespace] = createClient(namespace);
  }

  return clients[namespace] as Redis;
}

export function getRedisNamespace(dbIndex: number): RedisNamespace | null {
  for (const [ns, db] of Object.entries(DB_INDEX)) {
    if (db === dbIndex) return ns as RedisNamespace;
  }
  return null;
}

export { Redis };

