/**
 * Lightweight in-memory fixed-window rate limiter.
 *
 * Keyed by arbitrary string; tracks one counter per key. When the current
 * window expires, the next call resets the counter automatically. State
 * lives in-process and is LOST on restart — this is intentional. Use for
 * budget / DoS protection where the primary goal is "don't let one actor
 * blow through the LLM bill". Do NOT use for anti-abuse counters that
 * need continuity across deploys — for that, persist to SQLite/Redis.
 *
 * Classic fixed-window weakness: a caller can hit the limit twice across
 * the window boundary, briefly exceeding 2× limit. For cost-ceiling
 * protection this is fine — pick conservative limits and the worst-case
 * burst is still well within budget.
 *
 * Single-process assumption: this works as long as web traffic hits a
 * single Node process. If you scale to multiple web instances behind a
 * load balancer, replace the Map with a shared Redis or SQLite backend.
 */

interface Window {
  count: number;
  resetAt: number; // epoch ms when the current window expires
}

const buckets = new Map<string, Window>();

export interface RateLimitResult {
  ok: boolean;
  /** Hits remaining in the current window (0 when ok is false). */
  remaining: number;
  /** The limit that was checked. Useful for X-RateLimit-Limit headers. */
  limit: number;
  /** Seconds until the window resets. 0 when ok is true. */
  retryAfterSec: number;
}

/**
 * Check and atomically increment a counter for `key`. Returns ok=true
 * when the call is under the limit, ok=false when it would exceed.
 *
 * A rejected call still increments the counter for the current window.
 * This is intentional — an attacker hammering the endpoint does not get
 * a "free pass" after being rate-limited.
 *
 * @param key      any stable string (e.g. `site-chat:sid:${siteId}`)
 * @param limit    maximum allowed hits within the window
 * @param windowMs window size in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    // New window starts on this call.
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, limit, retryAfterSec: 0 };
  }

  existing.count++;
  if (existing.count > limit) {
    return {
      ok: false,
      remaining: 0,
      limit,
      // Minimum 1 second so clients never see "retry in 0 seconds".
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return {
    ok: true,
    remaining: limit - existing.count,
    limit,
    retryAfterSec: 0,
  };
}

/**
 * Reset a single key's counter. Primarily for tests — lets test code
 * start each case from a clean state without waiting for the window to
 * expire naturally.
 */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/**
 * Remove all rate-limit state. For tests only.
 */
export function clearAllRateLimits(): void {
  buckets.clear();
}

// Background sweeper: prunes entries whose window has already expired so
// the Map doesn't grow unbounded over a long-running process (one entry
// per unique IP over days would otherwise eat memory).
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

if (typeof setInterval === "function") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }, SWEEP_INTERVAL_MS);
  // unref so the sweeper doesn't keep the Node process alive during
  // short-lived invocations (e.g. test scripts). Node-only API — wrap
  // in a type cast for TS compatibility.
  (timer as unknown as { unref?: () => void }).unref?.();
}
