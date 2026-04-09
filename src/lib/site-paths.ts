/**
 * Site path helpers — single source of truth for all on-disk paths.
 *
 * Every file that used to compute `path.join(SITES_DIR, siteId, ...)`
 * should import from here instead. This makes the directory layout
 * configurable from one place and enables the immutable-build layout
 * where a `current` symlink points to the active build directory.
 *
 * Layout (versioned):
 *   sites-data/{siteId}/
 *     builds/{buildId}/     ← immutable after symlink swap
 *       src/ out/ package.json ...
 *       node_modules → ../../node_modules
 *     current → builds/{buildId}   ← atomic symlink
 *     node_modules/                ← site-level deps
 *
 * Layout (legacy, pre-migration):
 *   sites-data/{siteId}/
 *     src/ out/ package.json node_modules/ ...
 *
 * `resolveSiteDir(siteId)` handles both layouts transparently:
 *   - If `current` symlink exists → returns its resolved path
 *   - Otherwise → returns the site root (legacy layout)
 */

import fs from "fs/promises";
import path from "path";

export const SITES_DIR = path.join(process.cwd(), "sites-data");

// ── Basic path builders (no I/O) ───────────────────────────────────────

/** Top-level directory for a site: `sites-data/{siteId}` */
export function siteRoot(siteId: string): string {
  return path.join(SITES_DIR, siteId);
}

/** Directory for a specific build: `sites-data/{siteId}/builds/{buildId}` */
export function siteBuildDir(siteId: string, buildId: string): string {
  return path.join(SITES_DIR, siteId, "builds", buildId);
}

/** Path to the `current` symlink (not resolved): `sites-data/{siteId}/current` */
export function siteCurrentLink(siteId: string): string {
  return path.join(SITES_DIR, siteId, "current");
}

/** Site-level node_modules: `sites-data/{siteId}/node_modules` */
export function siteNodeModules(siteId: string): string {
  return path.join(SITES_DIR, siteId, "node_modules");
}

/** Builds directory: `sites-data/{siteId}/builds` */
export function siteBuildsRoot(siteId: string): string {
  return path.join(SITES_DIR, siteId, "builds");
}

// ── Resolvers (with I/O, handle legacy fallback) ───────────────────────

/**
 * Resolve the "active" site directory — the one that contains src/ and out/.
 *
 * - If `sites-data/{siteId}/current` exists (symlink), returns the path
 *   through the symlink so Node's fs resolves it transparently.
 * - Otherwise returns `sites-data/{siteId}` (legacy layout).
 *
 * Callers that just need to READ from the current build should use this.
 */
export async function resolveSiteDir(siteId: string): Promise<string> {
  const link = siteCurrentLink(siteId);
  try {
    await fs.lstat(link);
    // Symlink exists — return the symlink path (not realpath) so
    // relative paths inside the build dir still work.
    return link;
  } catch {
    // No symlink — legacy layout, return site root.
    return siteRoot(siteId);
  }
}

/**
 * Convenience: resolve `current/src/data/knowledge.json` with legacy fallback.
 */
export async function resolveCurrentSrcPath(siteId: string, ...segments: string[]): Promise<string> {
  const dir = await resolveSiteDir(siteId);
  return path.join(dir, "src", ...segments);
}
