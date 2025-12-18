import { NextResponse } from 'next/server';

type RateEntry = {
  count: number;
  resetTime: number;
};

type RateConfig = {
  windowMs: number;
  maxRequests: number;
  message?: string;
};

const rateLimits = new Map<string, RateEntry>();
const CLEANUP_INTERVAL_MS = 60 * 1000;
let lastCleanup = 0;

const DEFAULT_LIMIT: RateConfig = {
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: 'Too many requests, please try again later.',
};

const GLOBAL_LIMIT: RateConfig = {
  windowMs: 60 * 1000,
  maxRequests: 300,
  message: 'Too many requests from your IP. Please slow down.',
};

const POLICY_CONFIGS: Array<{ prefix: string; config: RateConfig }> = [
  {
    prefix: '/api/auth/callback',
    config: {
      windowMs: 60 * 1000,
      maxRequests: 120,
      message: 'Too many authentication callbacks. Please wait a moment before retrying.',
    },
  },
  {
    prefix: '/api/auth',
    config: {
      windowMs: 60 * 1000,
      maxRequests: 30,
      message: 'Too many authentication attempts. Please wait before retrying.',
    },
  },
  {
    prefix: '/api/users',
    config: {
      windowMs: 60 * 1000,
      maxRequests: 40,
    },
  },
  {
    prefix: '/api/reports',
    config: {
      windowMs: 60 * 1000,
      maxRequests: 30,
    },
  }
];

const RATE_LIMIT_SCOPE_PREFIXES = ['/api'];

const FALLBACK_MESSAGE = 'Too many requests. Please try again later.';

const extractClientIp = (request: Request): string => {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map(part => part.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts[0];
    }
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp;

  return 'unknown';
};

const cleanupBuckets = (now: number) => {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }
  rateLimits.forEach((entry, key) => {
    if (entry.resetTime <= now) {
      rateLimits.delete(key);
    }
  });
  lastCleanup = now;
};

const getPolicyForPath = (path: string) => {
  const matched = POLICY_CONFIGS.find(policy => path.startsWith(policy.prefix));
  if (matched) {
    return { identifier: matched.prefix, config: matched.config };
  }
  return { identifier: 'default', config: DEFAULT_LIMIT };
};

const incrementBucket = (key: string, config: RateConfig, now: number): RateEntry => {
  const existing = rateLimits.get(key);
  if (!existing || existing.resetTime <= now) {
    const entry: RateEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimits.set(key, entry);
    return entry;
  }

  const entry: RateEntry = {
    count: existing.count + 1,
    resetTime: existing.resetTime,
  };
  rateLimits.set(key, entry);
  return entry;
};

const buildResponse = (limited: boolean, message: string | undefined, headers: Record<string, string>) => {
  const response = limited
    ? new NextResponse(message ?? FALLBACK_MESSAGE, { status: 429 })
    : NextResponse.next();

  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
};

export async function rateLimitMiddleware(request: Request) {
  const path = new URL(request.url).pathname;

  const host = request.headers.get('host') ?? '';
  const isLocalHost = host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('::1');
  if (process.env.NODE_ENV !== 'production' || isLocalHost) {
    return NextResponse.next();
  }

  if (!RATE_LIMIT_SCOPE_PREFIXES.some(prefix => path.startsWith(prefix))) {
    return NextResponse.next();
  }

  try {
    const now = Date.now();
    cleanupBuckets(now);

    const ip = extractClientIp(request);
    const { identifier, config } = getPolicyForPath(path);

    const scopedKey = `${ip}:${identifier}`;
    const globalKey = `${ip}:__global__`;

    const scopedEntry = incrementBucket(scopedKey, config, now);
    if (scopedEntry.count > config.maxRequests) {
      const retryAfterSeconds = Math.ceil((scopedEntry.resetTime - now) / 1000);
      return buildResponse(true, config.message, {
        'Retry-After': retryAfterSeconds.toString(),
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': scopedEntry.resetTime.toString(),
        'X-RateLimit-Policy': `${identifier}:${config.maxRequests}/${config.windowMs}ms`,
      });
    }

    const globalEntry = incrementBucket(globalKey, GLOBAL_LIMIT, now);
    if (globalEntry.count > GLOBAL_LIMIT.maxRequests) {
      const retryAfterSeconds = Math.ceil((globalEntry.resetTime - now) / 1000);
      return buildResponse(true, GLOBAL_LIMIT.message, {
        'Retry-After': retryAfterSeconds.toString(),
        'X-RateLimit-Limit': GLOBAL_LIMIT.maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': globalEntry.resetTime.toString(),
        'X-RateLimit-Policy': `global:${GLOBAL_LIMIT.maxRequests}/${GLOBAL_LIMIT.windowMs}ms`,
      });
    }

    const pathRemaining = Math.max(0, config.maxRequests - scopedEntry.count);
    const globalRemaining = Math.max(0, GLOBAL_LIMIT.maxRequests - globalEntry.count);
    const combinedRemaining = Math.min(pathRemaining, globalRemaining);
    const resetTime = Math.min(scopedEntry.resetTime, globalEntry.resetTime);

    return buildResponse(false, undefined, {
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': combinedRemaining.toString(),
      'X-RateLimit-Reset': resetTime.toString(),
      'X-RateLimit-Policy': `${identifier}:${config.maxRequests}/${config.windowMs}ms;global:${GLOBAL_LIMIT.maxRequests}/${GLOBAL_LIMIT.windowMs}ms`,
    });
  } catch (error) {
    console.error('Rate limiter error:', error);
    return NextResponse.next();
  }
}
