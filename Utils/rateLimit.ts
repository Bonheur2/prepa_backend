interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 20; // per user, per window

/**
 * In-memory sliding-window limiter, keyed per user. This is enough to stop
 * accidental hammering (e.g. a buggy retry loop) but has two real limits
 * you should know about before relying on it in production:
 *
 *  1. State resets on every server restart/deploy.
 *  2. It does NOT share state across multiple instances -- if you run
 *     more than one instance (or deploy serverless, where each invocation
 *     may be a fresh process), each gets its own counter.
 *
 * Swap this for a Redis-backed limiter (e.g. Upstash's ratelimit package)
 * before scaling past a single instance -- this matters especially here
 * because every request costs real money via the Groq API.
 */
export function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  if (bucket.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count += 1;
  return { allowed: true, remaining: MAX_REQUESTS - bucket.count };
}
