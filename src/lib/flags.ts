/**
 * Feature flags — runtime-toggleable switches for gradual rollout,
 * kill-switches, and A/B experiments.
 *
 * Flags are stored in a `feature_flags` SQLite table and cached in
 * memory with a short TTL so reads are near-zero-cost. Writes go
 * through the admin API or direct DB update.
 *
 * Usage:
 *   import { flag } from "@/lib/flags";
 *
 *   if (await flag("immutable-builds")) {
 *     // new path
 *   }
 *
 *   // With per-user override:
 *   if (await flag("new-editor", { userId })) { ... }
 *
 * Design:
 *   - `enabled` is the global default (0 or 1).
 *   - `allow_list` is a JSON array of user IDs that always see
 *     the flag as ON, regardless of `enabled`.
 *   - The in-memory cache refreshes every CACHE_TTL_MS (default 30s).
 *     For 99.9% of reads this is a Map lookup — no DB hit.
 */

import { sqlite } from "@/lib/db";

// ---- Types ----

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  allowList: string[];       // user IDs that always get this flag
  createdAt: string;
  updatedAt: string;
}

// ---- In-memory cache ----

const CACHE_TTL_MS = Number(process.env.FLAG_CACHE_TTL_MS || 30_000);

interface CacheEntry {
  enabled: boolean;
  allowList: Set<string>;
}

let cache = new Map<string, CacheEntry>();
let cacheLoadedAt = 0;

function refreshCacheIfStale(): void {
  if (Date.now() - cacheLoadedAt < CACHE_TTL_MS) return;
  try {
    const rows = sqlite.prepare(
      "SELECT key, enabled, allow_list FROM feature_flags",
    ).all() as Array<{ key: string; enabled: number; allow_list: string | null }>;

    const next = new Map<string, CacheEntry>();
    for (const row of rows) {
      let allowList: string[] = [];
      if (row.allow_list) {
        try { allowList = JSON.parse(row.allow_list); } catch { /* ignore */ }
      }
      next.set(row.key, {
        enabled: row.enabled === 1,
        allowList: new Set(allowList),
      });
    }
    cache = next;
    cacheLoadedAt = Date.now();
  } catch {
    // Table might not exist yet on first import; will retry next call.
  }
}

// ---- Public API ----

/**
 * Check if a feature flag is enabled.
 *
 * @param key - The flag key (e.g. "immutable-builds")
 * @param opts - Optional context: userId for per-user allow-list
 * @returns true if the flag is on (globally or for this user)
 */
export function flag(key: string, opts?: { userId?: string }): boolean {
  refreshCacheIfStale();
  const entry = cache.get(key);
  if (!entry) return false; // unknown flag → off

  if (entry.enabled) return true;
  if (opts?.userId && entry.allowList.has(opts.userId)) return true;
  return false;
}

/**
 * Set or create a flag. Upserts into the DB and invalidates cache.
 */
export function setFlag(
  key: string,
  enabled: boolean,
  opts?: { description?: string; allowList?: string[] },
): void {
  const now = new Date().toISOString();
  const allowListJson = opts?.allowList ? JSON.stringify(opts.allowList) : null;
  const desc = opts?.description ?? "";

  sqlite.prepare(`
    INSERT INTO feature_flags (key, enabled, description, allow_list, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      enabled = excluded.enabled,
      description = COALESCE(NULLIF(excluded.description, ''), feature_flags.description),
      allow_list = COALESCE(excluded.allow_list, feature_flags.allow_list),
      updated_at = excluded.updated_at
  `).run(key, enabled ? 1 : 0, desc, allowListJson, now, now);

  // Invalidate cache so next read picks up the change immediately
  cacheLoadedAt = 0;
}

/**
 * List all flags. Used by admin UI / API.
 */
export function listFlags(): FeatureFlag[] {
  refreshCacheIfStale();
  try {
    const rows = sqlite.prepare(
      "SELECT key, enabled, description, allow_list, created_at, updated_at FROM feature_flags ORDER BY key",
    ).all() as Array<{
      key: string; enabled: number; description: string | null;
      allow_list: string | null; created_at: string; updated_at: string;
    }>;

    return rows.map((r) => ({
      key: r.key,
      enabled: r.enabled === 1,
      description: r.description || "",
      allowList: r.allow_list ? JSON.parse(r.allow_list) : [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Delete a flag.
 */
export function deleteFlag(key: string): void {
  sqlite.prepare("DELETE FROM feature_flags WHERE key = ?").run(key);
  cacheLoadedAt = 0;
}
