/**
 * Application-Wide Rate Limiting Engine
 * Multi-action rate limiting for authentication, checkout, returns, and uploads
 */

export type RateLimitAction =
  | "login"
  | "signup"
  | "password_reset"
  | "checkout"
  | "returns"
  | "uploads";

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const RATE_LIMIT_CONFIGS: Record<RateLimitAction, RateLimitConfig> = {
  login: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 5 attempts per 15 minutes
  },
  signup: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 3 attempts per hour
  },
  password_reset: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 3 attempts per hour
  },
  checkout: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 10 checkouts per hour
  },
  returns: {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000, // 5 returns per hour
  },
  uploads: {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000, // 20 uploads per hour
  },
};

interface RateLimitRecord {
  timestamps: number[];
}

// In-memory sliding window cache keyed by `${action}:${identifier}`
const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Check and consume a rate limit token for a specific action and identifier (IP / User ID / Email)
 */
export function checkRateLimit(
  action: RateLimitAction,
  identifier: string
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
} {
  const config = RATE_LIMIT_CONFIGS[action];
  const now = Date.now();
  const key = `${action}:${identifier.trim().toLowerCase()}`;

  let record = rateLimitStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Filter timestamps outside the sliding window
  const windowStart = now - config.windowMs;
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= config.maxRequests) {
    const oldestTimestamp = record.timestamps[0] ?? now;
    const resetAt = oldestTimestamp + config.windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfterSeconds,
    };
  }

  // Consume a slot
  record.timestamps.push(now);
  const remaining = config.maxRequests - record.timestamps.length;
  const resetAt = now + config.windowMs;

  return {
    allowed: true,
    remaining,
    resetAt,
  };
}

/**
 * Enforce rate limit or throw fail-closed error
 */
export function assertRateLimit(action: RateLimitAction, identifier: string): void {
  const result = checkRateLimit(action, identifier);
  if (!result.allowed) {
    const error = new Error(
      `Too many requests for ${action}. Please retry after ${result.retryAfterSeconds} seconds.`
    );
    (error as any).status = 429;
    (error as any).retryAfterSeconds = result.retryAfterSeconds;
    throw error;
  }
}

/**
 * Clear rate limit store (useful for testing and admin resets)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}
