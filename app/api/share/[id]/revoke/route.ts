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

class RateLimiter {
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

class LinkAccessLogger {
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

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return typeof forwarded === 'string' ? forwarded.split(',')[0] : 'unknown';
  }
  
  return request.headers.get('x-real-ip') || 'unknown';
}

function getUserAgent(request: Request): string {
  return request.headers.get('user-agent') || 'unknown';
}

function getReferer(request: Request): string | undefined {
  return request.headers.get('referer') || undefined;
}

const DEFAULT_SHARE_ACCESS_LIMIT: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 15 * 60 * 1000
};

const redis = {
  get: async (key: string) => {
    return null;
  },
  setex: async (key: string, seconds: number, value: string) => {
    return Promise.resolve();
  },
  del: async (key: string) => {
    return Promise.resolve();
  }
};

const rateLimiter = new RateLimiter(redis);
const accessLogger = new LinkAccessLogger(redis);

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const shareId = params.id;
    
    const ip = getClientIp(request);
    const userAgent = getUserAgent(request);
    const referer = getReferer(request);
    
    const rateLimitKey = `share_revoke_${ip}`;
    const rateLimitResult = await rateLimiter.checkRateLimit(rateLimitKey, DEFAULT_SHARE_ACCESS_LIMIT);
    
    if (rateLimitResult.isLimited) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded', 
          message: `Too many requests. Please try again in ${Math.ceil(rateLimitResult.timeLeft / 1000)} seconds.` 
        }),
        { 
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    await accessLogger.logAccess({
      shareId,
      ip,
      userAgent,
      timestamp: new Date(),
      referer
    });
    
    const shareExists = await verifyShareOwnership(shareId);
    
    if (!shareExists) {
      return new Response(
        JSON.stringify({ 
          error: 'Not Found', 
          message: 'Share not found or you do not have permission to revoke it.' 
        }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    const revoked = await revokeShare(shareId);
    
    if (!revoked) {
      return new Response(
        JSON.stringify({ 
          error: 'Internal Server Error', 
          message: 'Could not revoke share. Please try again.' 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Share successfully revoked',
        shareId
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('Error revoking share:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal Server Error', 
        message: 'An unexpected error occurred while revoking the share.' 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function verifyShareOwnership(shareId: string): Promise<boolean> {
  try {
    const shareData = await redis.get(`share:${shareId}`);
    if (!shareData) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error verifying share ownership:', error);
    return false;
  }
}

async function revokeShare(shareId: string): Promise<boolean> {
  try {
    await redis.setex(`share_revoked:${shareId}`, 86400 * 30, 'true');
    await redis.del(`share:${shareId}`);
    
    return true;
  } catch (error) {
    console.error('Error revoking share:', error);
    return false;
  }
}