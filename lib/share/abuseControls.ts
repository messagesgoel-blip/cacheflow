type Headers = {
  get: (name: string) => string | null;
};

type RedisClient = {
  pipeline: () => any;
  zremrangebyscore: (key: string, min: number, max: number) => Promise<any>;
  zadd: (key: string, score: number, member: string) => Promise<any>;
  expire: (key: string, seconds: number) => Promise<any>;
  zcard: (key: string) => Promise<number>;
  exec: () => Promise<any[]>;
  zrange: (key: string, start: number, stop: number, withscores?: string) => Promise<string[]>;
  lpush: (key: string, ...values: string[]) => Promise<number>;
  ltrim: (key: string, start: number, stop: number) => Promise<any>;
  llen: (key: string) => Promise<number>;
  lrange: (key: string, start: number, stop: number) => Promise<string[]>;
};

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

interface LinkAccessLogEntry {
  shareId: string;
  ip: string;
  userAgent: string;
  timestamp: Date;
  referer?: string;
}

export class RateLimiter {
  private redis: any;

  constructor(redisClient: any) {
    this.redis = redisClient;
  }

  async checkRateLimit(key: string, config: RateLimitConfig): Promise<{ isLimited: boolean; timeLeft: number }> {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    const pipeline = this.redis.pipeline();
    
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.expire(key, Math.ceil(config.windowMs / 1000));
    pipeline.zcard(key);
    
    const results = await pipeline.exec();
    const currentCount = results[3][1];
    
    if (currentCount > config.maxRequests) {
      const oldestRequest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
      const oldestTime = oldestRequest.length > 1 ? parseInt(oldestRequest[1]) : now;
      const timeLeft = Math.max(0, config.windowMs - (now - oldestTime));
      
      return { isLimited: true, timeLeft };
    }
    
    return { isLimited: false, timeLeft: 0 };
  }

  async getRateLimitInfo(key: string, config: RateLimitConfig): Promise<{ remaining: number; resetTime: number }> {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    await this.redis.zremrangebyscore(key, 0, windowStart);
    
    const count = await this.redis.zcard(key);
    const remaining = Math.max(0, config.maxRequests - count);
    
    const oldestRequest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
    const oldestTime = oldestRequest.length > 1 ? parseInt(oldestRequest[1]) : now;
    const resetTime = oldestTime + config.windowMs;
    
    return { remaining, resetTime };
  }
}

export class LinkAccessLogger {
  private redis: any;

  constructor(redisClient: any) {
    this.redis = redisClient;
  }

  async logAccess(entry: LinkAccessLogEntry): Promise<void> {
    const logKey = `share_access_log:${entry.shareId}`;
    const logEntry = JSON.stringify({
      ...entry,
      timestamp: entry.timestamp.toISOString()
    });
    
    const pipeline = this.redis.pipeline();
    pipeline.lpush(logKey, logEntry);
    pipeline.ltrim(logKey, 0, 999);
    pipeline.expire(logKey, 86400 * 7);
    
    await pipeline.exec();
  }

  async getRecentAccessLogs(shareId: string, limit: number = 100): Promise<LinkAccessLogEntry[]> {
    const logKey = `share_access_log:${shareId}`;
    const logEntries = await this.redis.lrange(logKey, 0, limit - 1);
    
    return logEntries.map((entry: string) => {
      const parsed = JSON.parse(entry);
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp)
      };
    });
  }

  async getAccessCount(shareId: string): Promise<number> {
    const logKey = `share_access_log:${shareId}`;
    return await this.redis.llen(logKey);
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return typeof forwarded === 'string' ? forwarded.split(',')[0] : 'unknown';
  }
  
  return request.headers.get('x-real-ip') || 'unknown';
}

export function getUserAgent(request: Request): string {
  return request.headers.get('user-agent') || 'unknown';
}

export function getReferer(request: Request): string | undefined {
  return request.headers.get('referer') || undefined;
}

// Default rate limit configurations
export const DEFAULT_SHARE_ACCESS_LIMIT: RateLimitConfig = {
  maxRequests: 100, // 100 requests
  windowMs: 15 * 60 * 1000 // per 15 minutes
};

export const DEFAULT_SHARE_CREATION_LIMIT: RateLimitConfig = {
  maxRequests: 10, // 10 requests
  windowMs: 60 * 60 * 1000 // per hour
};