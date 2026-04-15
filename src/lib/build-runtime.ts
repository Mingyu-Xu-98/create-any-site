import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import http from "http";
import type { WorkspaceData, UserSelections } from "@/lib/types";
import { logger } from "@/lib/logger";
import { getInstalledNextVersion } from "@/lib/next-version";
import { runCodeGuardrails, runAdvancedModeGuardrails } from "@/lib/code-guardrails";
import { recordBuildError, recordGuardrailFixes } from "@/lib/error-collector";
import { copyUserImagesToSite } from "@/lib/asset-store";
import { routeKnowledge, buildRoutedChatbotContext } from "@/lib/knowledge-router";
import { knowledgeItems as knowledgeItemsTable, sites as sitesTable, knowledgeFiles as knowledgeFilesTable } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import type { KnowledgeItem } from "@/lib/knowledge";
import { getSpecSections } from "@/lib/site-spec";
import { STYLE_CONFIG } from "@/lib/generator-config";
import {
  SITES_DIR,
  siteRoot,
  siteBuildDir,
  siteCurrentLink,
  siteBuildsRoot,
} from "@/lib/site-paths";
const RUNTIME_BASE_DIR = (process.env.RUNTIME_BASE_DIR?.trim() || path.join(SITES_DIR, "_runtime_base")).replace(/\/+$/, "");
const SHARED_MODULES = path.join(SITES_DIR, "_shared_node_modules");
const PREVIEW_PORT = 3002;
const REQUIRED_SHARED_PACKAGES = ["next", "react", "react-dom", "qrcode", "dijkstrajs", "pngjs"];
const PREVIEW_PUBLISH_DIR = process.env.PREVIEW_PUBLISH_DIR?.trim() || "";
const PREVIEW_BASE_URL = (process.env.PREVIEW_BASE_URL?.trim() || "http://localhost:3002").replace(/\/+$/, "");
const DRAFTS_SEGMENT = "drafts";
const USE_SHARED_NODE_MODULES = process.env.USE_SHARED_NODE_MODULES === "1";

let staticServer: http.Server | null = null;

async function ensureSiteDir(siteId: string): Promise<string> {
  const dir = siteRoot(siteId);
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(siteBuildsRoot(siteId), { recursive: true });
  return dir;
}

/**
 * Create an isolated build directory: `sites-data/{siteId}/builds/{buildId}/`.
 * node_modules is handled separately by ensureNodeModules — called on the
 * build dir directly so that `next build` can resolve deps without issues.
 */
async function prepareBuildDir(siteId: string, buildId: string): Promise<string> {
  const dir = siteBuildDir(siteId, buildId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Ensure node_modules exists in the build dir. Uses a symlink to the
 * site-root or shared node_modules so we don't duplicate 300+ MB.
 * Falls back to copying from runtime-base if nothing exists yet.
 *
 * Called AFTER writeFilesToSiteDir so package.json is already in place.
 */
async function ensureBuildNodeModules(siteId: string, buildDir: string): Promise<void> {
  const buildNm = path.join(buildDir, "node_modules");
  // Already exists (e.g. retry or re-run) — skip
  try {
    await fs.access(buildNm);
    return;
  } catch { /* proceed to set up */ }

  const rootNm = path.join(siteRoot(siteId), "node_modules");

  if (USE_SHARED_NODE_MODULES) {
    // Shared mode: root/node_modules is a symlink to _shared_node_modules.
    // Make build/node_modules an absolute symlink to the same target.
    try {
      const realTarget = await fs.realpath(rootNm);
      await fs.symlink(realTarget, buildNm);
      return;
    } catch { /* shared not set up yet — fall through */ }
  }

  // Non-shared mode: ensure site root has node_modules by copying from
  // runtime-base (package.json lives in the build dir, not site root,
  // so we must NOT run `npm install` in site root).
  try {
    await fs.access(rootNm);
  } catch {
    // Copy node_modules from runtime-base into site root
    await ensureRuntimeBase();
    await fs.cp(path.join(RUNTIME_BASE_DIR, "node_modules"), rootNm, { recursive: true, force: true });
  }
  // Symlink build dir node_modules to site root node_modules
  try {
    const realTarget = await fs.realpath(rootNm);
    await fs.symlink(realTarget, buildNm);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }
}

/**
 * Atomically swap the `current` symlink to point at a new build.
 * Uses symlink + rename for POSIX atomicity — the symlink never
 * points at a partial build.
 */
async function swapCurrentSymlink(siteId: string, buildId: string): Promise<void> {
  const link = siteCurrentLink(siteId);
  const tmpLink = `${link}_tmp_${Date.now()}`;
  // Relative target so the symlink stays valid if the repo moves
  const target = path.join("builds", buildId);
  await fs.symlink(target, tmpLink);
  await fs.rename(tmpLink, link);
}

/**
 * Migrate a site from the legacy flat layout to the versioned-builds layout.
 * Idempotent — safe to call on every build/modify.
 *
 * Legacy: sites-data/{siteId}/src/ + out/ + package.json ...
 * New:    sites-data/{siteId}/builds/{buildId}/... + current → builds/{buildId}
 */
export async function migrateSiteLayout(siteId: string, buildId?: string): Promise<void> {
  const root = siteRoot(siteId);
  const buildsDir = siteBuildsRoot(siteId);
  const link = siteCurrentLink(siteId);

  // Already migrated?
  try {
    await fs.lstat(link);
    return; // symlink exists → done
  } catch {
    // No symlink yet — check if migration is needed
  }

  // Check if legacy layout exists (has src/ directly in site root)
  const legacySrc = path.join(root, "src");
  try {
    await fs.access(legacySrc);
  } catch {
    // No src/ at root — either empty site or already partially migrated. Nothing to do.
    return;
  }

  const id = buildId || `migrated_${Date.now()}`;
  const targetDir = path.join(buildsDir, id);
  await fs.mkdir(targetDir, { recursive: true });

  // Move source files and build artifacts into the build dir
  const toMove = ["src", "out", "package.json", "tsconfig.json", "next.config.mjs", "next.config.js"];
  for (const name of toMove) {
    const src = path.join(root, name);
    const dest = path.join(targetDir, name);
    try {
      await fs.rename(src, dest);
    } catch {
      // File doesn't exist — skip
    }
  }

  // Create node_modules symlink inside the build dir (absolute path)
  const rootNm = path.join(root, "node_modules");
  const nmLink = path.join(targetDir, "node_modules");
  try {
    const realNm = await fs.realpath(rootNm);
    await fs.symlink(realNm, nmLink);
  } catch {
    // node_modules might not exist yet — will be set up on next build
  }

  // Create the current symlink
  await fs.symlink(path.join("builds", id), link);
  logger.info("generate", `Migrated site ${siteId} to versioned layout (build: ${id})`);
}

async function writeFilesToSiteDir(siteDir: string, files: Record<string, string>) {
  const srcDir = path.join(siteDir, "src");
  await fs.rm(srcDir, { recursive: true, force: true });
  for (const staleFile of ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]) {
    await fs.rm(path.join(siteDir, staleFile), { force: true }).catch(() => {});
  }
  let count = 0;
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(siteDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
    count++;
  }
  return count;
}

const MAX_RETAINED_BUILDS = Number(process.env.MAX_RETAINED_BUILDS || 5);

/**
 * Remove old build directories for a site, keeping the N most recent
 * and always protecting builds referenced by draftBuildId / publishedBuildId.
 * Fire-and-forget — errors are logged but never propagate.
 */
export async function cleanupOldBuilds(siteId: string): Promise<void> {
  try {
    const buildsDir = siteBuildsRoot(siteId);
    let entries: string[];
    try {
      entries = await fs.readdir(buildsDir);
    } catch {
      return; // no builds dir
    }
    if (entries.length <= MAX_RETAINED_BUILDS) return;

    // Find protected build IDs
    const site = await db
      .select({ draftBuildId: sitesTable.draftBuildId, publishedBuildId: sitesTable.publishedBuildId })
      .from(sitesTable)
      .where(eq(sitesTable.id, siteId))
      .get();
    const protectedIds = new Set<string>();
    if (site?.draftBuildId) protectedIds.add(site.draftBuildId);
    if (site?.publishedBuildId) protectedIds.add(site.publishedBuildId);

    // Sort by creation time (oldest first) using directory stat
    const withTimes = await Promise.all(
      entries.map(async (name) => {
        const dir = path.join(buildsDir, name);
        try {
          const stat = await fs.stat(dir);
          return { name, mtimeMs: stat.mtimeMs };
        } catch {
          return { name, mtimeMs: 0 };
        }
      }),
    );
    withTimes.sort((a, b) => b.mtimeMs - a.mtimeMs); // newest first

    // Skip the N most recent + protected ones; delete the rest
    let kept = 0;
    for (const entry of withTimes) {
      if (protectedIds.has(entry.name) || kept < MAX_RETAINED_BUILDS) {
        kept++;
        continue;
      }
      const dir = path.join(buildsDir, entry.name);
      await fs.rm(dir, { recursive: true, force: true });
      logger.info("generate", `Cleaned up old build: ${siteId}/builds/${entry.name}`);
    }
  } catch (err) {
    logger.warn("generate", `cleanupOldBuilds(${siteId}) failed: ${err instanceof Error ? err.message : "unknown"}`);
  }
}

async function copyDirectory(sourceDir: string, targetDir: string): Promise<void> {
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.cp(sourceDir, targetDir, { recursive: true, force: true });
}

export async function rewriteExportAssetPaths(dir: string, fromPrefix: string, toPrefix: string): Promise<void> {
  const normalizedFrom = fromPrefix.replace(/\/+$/, "");
  const normalizedTo = toPrefix.replace(/\/+$/, "");
  const exts = new Set([".html", ".js", ".txt"]);
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await rewriteExportAssetPaths(fullPath, normalizedFrom, normalizedTo);
      continue;
    }

    if (!exts.has(path.extname(entry.name))) continue;

    let content = await fs.readFile(fullPath, "utf-8");
    const replacements: Array<[string, string]> = normalizedFrom
      ? [
          [`${normalizedFrom}/_next/`, `${normalizedTo}/_next/`],
          [`${normalizedFrom}/images/`, `${normalizedTo}/images/`],
          [`${normalizedFrom}/favicon.ico`, `${normalizedTo}/favicon.ico`],
        ]
      : [
          ["/_next/", `${normalizedTo}/_next/`],
          ["/images/", `${normalizedTo}/images/`],
          ["/favicon.ico", `${normalizedTo}/favicon.ico`],
        ];

    for (const [from, to] of replacements) {
      content = content.split(from).join(to);
    }

    await fs.writeFile(fullPath, content, "utf-8");
  }
}

function getDraftPublishDir(siteId: string): string {
  return path.join(PREVIEW_PUBLISH_DIR, DRAFTS_SEGMENT, siteId);
}

function getPublishedPublishDir(siteId: string): string {
  return path.join(PREVIEW_PUBLISH_DIR, siteId);
}

export function getDraftPreviewUrl(siteId: string, baseUrl = PREVIEW_BASE_URL): string {
  return `${baseUrl}/${DRAFTS_SEGMENT}/${siteId}`;
}

export function getPublishedPreviewUrl(siteId: string, baseUrl = PREVIEW_BASE_URL): string {
  return `${baseUrl}/${siteId}`;
}

export function getLocalPreviewUrl(siteId: string, baseUrl = PREVIEW_BASE_URL): string {
  return `${baseUrl}/${siteId}`;
}

export function hasPublishedPreviewDirectory(): boolean {
  return Boolean(PREVIEW_PUBLISH_DIR);
}

export async function syncDraftPreview(siteId: string, siteDir: string): Promise<void> {
  if (!PREVIEW_PUBLISH_DIR) return;
  const targetDir = getDraftPublishDir(siteId);
  const tmpDir = `${targetDir}_tmp_${Date.now()}`;

  try {
    // Copy + rewrite in a temp directory (invisible to Nginx)
    await fs.cp(path.join(siteDir, "out"), tmpDir, { recursive: true, force: true });
    const draftPathname = new URL(getDraftPreviewUrl(siteId)).pathname;
    await rewriteExportAssetPaths(tmpDir, "", draftPathname);

    // Atomic swap: remove old, rename temp → target
    // Both are in the same parent dir so fs.rename is atomic on the same filesystem
    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.rename(tmpDir, targetDir);
  } catch (err) {
    // Clean up temp dir on failure
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

export async function publishDraftPreview(siteId: string): Promise<string> {
  if (!PREVIEW_PUBLISH_DIR) {
    // Local mode: copy build output to published/ directory, rewrite paths
    const outDir = path.join(siteCurrentLink(siteId), "out");
    const publishedDir = path.join(siteRoot(siteId), "published");
    await copyDirectory(outDir, publishedDir);
    // Rewrite from /drafts/{siteId} prefix to /{siteId} prefix
    await rewriteExportAssetPaths(publishedDir, `/drafts/${siteId}`, `/${siteId}`);
    return getLocalPreviewUrl(siteId);
  }
  const draftDir = getDraftPublishDir(siteId);

  // If draft preview directory doesn't exist, try to re-sync from site build output
  try {
    await fs.access(draftDir);
  } catch {
    // Try current symlink first, fall back to legacy flat layout
    const currentOutDir = path.join(siteCurrentLink(siteId), "out");
    const legacyOutDir = path.join(SITES_DIR, siteId, "out");
    let fallbackSiteDir: string | null = null;
    try {
      await fs.access(currentOutDir);
      fallbackSiteDir = siteCurrentLink(siteId);
    } catch {
      try {
        await fs.access(legacyOutDir);
        fallbackSiteDir = path.join(SITES_DIR, siteId);
      } catch { /* neither exists */ }
    }
    try {
      if (!fallbackSiteDir) throw new Error("no build output");
      await syncDraftPreview(siteId, fallbackSiteDir);
    } catch {
      throw new Error(`Draft preview not found for site ${siteId}. Please rebuild first.`);
    }
  }

  const publishedDir = getPublishedPublishDir(siteId);
  await copyDirectory(draftDir, publishedDir);
  const draftPathname = new URL(getDraftPreviewUrl(siteId)).pathname;
  const publishedPathname = new URL(getPublishedPreviewUrl(siteId)).pathname;
  await rewriteExportAssetPaths(publishedDir, draftPathname, publishedPathname);
  return getPublishedPreviewUrl(siteId);
}

export async function unpublishPreview(siteId: string): Promise<void> {
  if (!PREVIEW_PUBLISH_DIR) {
    // Local mode: remove the published/ directory
    await fs.rm(path.join(siteRoot(siteId), "published"), { recursive: true, force: true });
    return;
  }
  await fs.rm(getPublishedPublishDir(siteId), { recursive: true, force: true });
}

function getRuntimeBasePackageJson(): string {
  return JSON.stringify({
    name: "site-runtime-base",
    version: "1.0.0",
    type: "module",
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: {
      "@tailwindcss/postcss": "^4.2.1",
      "@types/node": "^25.4.0",
      "@types/qrcode": "^1.5.5",
      "@types/react": "^19.2.14",
      dijkstrajs: "^1.0.3",
      next: getInstalledNextVersion(),
      pngjs: "^7.0.0",
      postcss: "^8.5.8",
      qrcode: "^1.5.4",
      react: "^19.2.4",
      "react-dom": "^19.2.4",
      tailwindcss: "^4.2.1",
      typescript: "^5.9.3",
    },
  }, null, 2);
}

async function installDependencies(cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    exec("npm install --prefer-offline --package-lock=false --registry=https://registry.npmmirror.com", { cwd, timeout: 180_000 }, (err, _stdout, stderr) => {
      if (err) reject(new Error(`npm install failed: ${stderr || err.message}`));
      else resolve();
    });
  });
}

function haveSameDependencies(sitePkgRaw: string, basePkgRaw: string): boolean {
  try {
    const sitePkg = JSON.parse(sitePkgRaw) as { dependencies?: Record<string, string> };
    const basePkg = JSON.parse(basePkgRaw) as { dependencies?: Record<string, string> };
    return JSON.stringify(sitePkg.dependencies || {}) === JSON.stringify(basePkg.dependencies || {});
  } catch {
    return false;
  }
}

async function ensureRuntimeBase(): Promise<string> {
  const basePackageJson = getRuntimeBasePackageJson();
  const packageJsonPath = path.join(RUNTIME_BASE_DIR, "package.json");
  const nodeModulesPath = path.join(RUNTIME_BASE_DIR, "node_modules");

  await fs.mkdir(RUNTIME_BASE_DIR, { recursive: true });

  let shouldRebuild = false;
  try {
    const existingPackageJson = await fs.readFile(packageJsonPath, "utf-8");
    if (existingPackageJson !== basePackageJson) shouldRebuild = true;
  } catch {
    shouldRebuild = true;
  }

  try {
    const raw = await fs.readFile(path.join(nodeModulesPath, "next", "package.json"), "utf-8");
    const nextVersion = JSON.parse(raw)?.version || "";
    if (nextVersion !== getInstalledNextVersion()) shouldRebuild = true;
  } catch {
    shouldRebuild = true;
  }

  for (const pkg of REQUIRED_SHARED_PACKAGES) {
    try {
      await fs.access(path.join(nodeModulesPath, pkg));
    } catch {
      shouldRebuild = true;
      break;
    }
  }

  if (!shouldRebuild) return basePackageJson;

  logger.info("generate", `Refreshing runtime-base at ${RUNTIME_BASE_DIR}`);
  await fs.writeFile(packageJsonPath, basePackageJson, "utf-8");
  await fs.rm(nodeModulesPath, { recursive: true, force: true });
  for (const staleFile of ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]) {
    await fs.rm(path.join(RUNTIME_BASE_DIR, staleFile), { force: true }).catch(() => {});
  }
  await installDependencies(RUNTIME_BASE_DIR);
  return basePackageJson;
}

async function ensureNodeModules(siteDir: string) {
  const nmPath = path.join(siteDir, "node_modules");
  if (!USE_SHARED_NODE_MODULES) {
    const runtimeBasePackageJson = await ensureRuntimeBase();
    let needsInstall = false;
    let sitePackageJson = "";
    try {
      const stat = await fs.lstat(nmPath);
      if (stat.isSymbolicLink()) {
        await fs.rm(nmPath, { recursive: true, force: true });
        needsInstall = true;
      }
    } catch {
      needsInstall = true;
    }

    try {
      sitePackageJson = await fs.readFile(path.join(siteDir, "package.json"), "utf-8");
    } catch {
      needsInstall = true;
    }

    const localRequiredPackages = ["next", "react", "react-dom", "qrcode", "dijkstrajs", "pngjs"];
    if (!needsInstall) {
      for (const pkg of localRequiredPackages) {
        try {
          await fs.access(path.join(nmPath, pkg));
        } catch {
          needsInstall = true;
          break;
        }
      }
    }

    try {
      const raw = await fs.readFile(path.join(nmPath, "next", "package.json"), "utf-8");
      const localNextVersion = JSON.parse(raw)?.version || "";
      if (localNextVersion !== getInstalledNextVersion()) {
        needsInstall = true;
      }
    } catch {
      needsInstall = true;
    }

    if (needsInstall) {
      await fs.rm(nmPath, { recursive: true, force: true }).catch(() => {});
      logger.info("generate", "Hydrating site-local node_modules from runtime-base...");
      await fs.cp(path.join(RUNTIME_BASE_DIR, "node_modules"), nmPath, { recursive: true, force: true });
      if (!haveSameDependencies(sitePackageJson, runtimeBasePackageJson)) {
        logger.info("generate", "Site dependencies differ from runtime-base, running npm install...");
        await installDependencies(siteDir);
      }
    }
    return;
  }

  const installedNextVersion = getInstalledNextVersion();
  let hasNodeModulesLinkOrDir = false;
  try {
    const stat = await fs.lstat(nmPath);
    if (stat.isSymbolicLink() || stat.isDirectory()) {
      hasNodeModulesLinkOrDir = true;
    }
  } catch {}

  async function installIntoSiteDir() {
    await installDependencies(siteDir);
  }

  try {
    await fs.access(SHARED_MODULES);
  } catch {
    logger.info("generate", "Installing shared node_modules (first time)...");
    await fs.mkdir(path.dirname(SHARED_MODULES), { recursive: true });
    await installIntoSiteDir();
    await fs.rename(path.join(siteDir, "node_modules"), SHARED_MODULES);
  }

  let sharedNextVersion = "";
  try {
    const raw = await fs.readFile(path.join(SHARED_MODULES, "next", "package.json"), "utf-8");
    sharedNextVersion = JSON.parse(raw)?.version || "";
  } catch {}

  if (sharedNextVersion && sharedNextVersion !== installedNextVersion) {
    logger.info("generate", `Rebuilding shared node_modules for Next ${installedNextVersion} (was ${sharedNextVersion})`);
    try {
      await fs.rm(nmPath, { recursive: true, force: true });
    } catch {}
    await fs.rm(SHARED_MODULES, { recursive: true, force: true });
    await installIntoSiteDir();
    await fs.rename(path.join(siteDir, "node_modules"), SHARED_MODULES);
    hasNodeModulesLinkOrDir = false;
  }

  if (!hasNodeModulesLinkOrDir) {
    try {
      await fs.symlink(SHARED_MODULES, nmPath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw err;
    }
  }

  const missingPackages: string[] = [];
  for (const pkg of REQUIRED_SHARED_PACKAGES) {
    try {
      await fs.access(path.join(SHARED_MODULES, pkg));
    } catch {
      missingPackages.push(pkg);
    }
  }

  if (missingPackages.length > 0) {
    logger.info("generate", `Repairing shared node_modules, missing: ${missingPackages.join(", ")}`);
    await installIntoSiteDir();
  }
}

async function staticBuild(siteDir: string): Promise<void> {
  const configContent = `const nextConfig = {
  output: "export",
  images: { unoptimized: true },
};
export default nextConfig;`;

  for (const old of ["next.config.js", "next.config.ts", "next.config.cjs"]) {
    try {
      await fs.unlink(path.join(siteDir, old));
    } catch {}
  }
  await fs.writeFile(path.join(siteDir, "next.config.mjs"), configContent, "utf-8");

  const nextBin = path.join(siteDir, "node_modules", "next", "dist", "bin", "next");
  const buildEnv = { ...process.env, NODE_ENV: "production" } as NodeJS.ProcessEnv;
  delete buildEnv.TURBOPACK;
  delete buildEnv.NEXT_DISABLE_TURBOPACK;

  return new Promise((resolve, reject) => {
    exec(`"${nextBin}" build --webpack`, {
      cwd: siteDir,
      timeout: 180_000,
      env: buildEnv,
    }, (err, stdout, stderr) => {
      if (err) reject(Object.assign(err, { stdout, stderr }));
      else resolve();
    });
  });
}

export function summarizeBuildOutput(stdout: string, stderr: string): string[] {
  const merged = `${stderr || ""}\n${stdout || ""}`
    .split("\n")
    .map((line) => line.replace(/\u001b\[[0-9;]*m/g, "").trim())
    .filter(Boolean);

  const important = merged.filter((line) =>
    /error|failed|module not found|type error|syntaxerror|can't resolve|panic|operation not permitted/i.test(line),
  );

  const lines = (important.length > 0 ? important : merged).slice(-12);
  return Array.from(new Set(lines));
}

async function runVerification(siteDir: string, files: Record<string, string>, spec?: { sections?: Array<{ id?: string; type?: string; enabled?: boolean }> }) {
  const checks: Array<{ label: string; ok: boolean }> = [];

  checks.push({ label: "Generated package manifest", ok: Boolean(files["package.json"]) });
  checks.push({ label: "Generated homepage source", ok: Boolean(files["src/app/page.tsx"]) });
  checks.push({ label: "Generated global styles", ok: Boolean(files["src/app/globals.css"]) });

  const outIndex = path.join(siteDir, "out", "index.html");
  try {
    const html = await fs.readFile(outIndex, "utf-8");
    checks.push({ label: "Static export index.html exists", ok: html.length > 0 });
    if (Array.isArray(spec?.sections)) {
      const aliasMap: Record<string, string[]> = {
        timeline: ["experience", "timeline", "milestones"],
        projects: ["projects", "portfolio", "work", "showcase"],
        blog: ["blog", "posts", "articles", "writing"],
        contact: ["contact", "cta", "hire-me", "get-started"],
        skills: ["skills", "tech-stack", "expertise"],
        about: ["about", "intro", "bio"],
      };
      for (const section of spec.sections.filter(item => item.enabled !== false)) {
        const sectionId = section.id || section.type;
        if (!sectionId) continue;
        const candidates = aliasMap[sectionId] || [sectionId];
        const found = candidates.some(id =>
          html.includes(`id="${id}"`) || html.includes(`id='${id}'`) || html.includes(`#${id}`)
        );
        checks.push({ label: `Rendered section anchor: ${sectionId}`, ok: found });
      }
    }
  } catch {
    checks.push({ label: "Static export index.html exists", ok: false });
  }

  return { ok: checks.every(check => check.ok), checks };
}

async function assertPreviewArtifacts(siteDir: string, siteId: string): Promise<void> {
  const outDir = path.join(siteDir, "out");
  const indexFile = path.join(outDir, "index.html");
  try {
    await fs.access(outDir);
  } catch {
    throw new Error(`Preview output directory missing for site ${siteId}`);
  }

  let html: string;
  try {
    html = await fs.readFile(indexFile, "utf-8");
    if (!html.trim()) throw new Error(`Preview index is empty for site ${siteId}`);
  } catch (err) {
    if (err instanceof Error && /Preview index is empty/.test(err.message)) throw err;
    throw new Error(`Preview index.html missing for site ${siteId}`);
  }

  // Post-build quality checks (non-blocking — log warnings but don't fail the build)
  const warnings: string[] = [];

  // Check for broken script references
  const scriptRefs = html.match(/src="([^"]*\.js)"/g) || [];
  for (const ref of scriptRefs) {
    const src = ref.match(/src="([^"]+)"/)?.[1];
    if (src && src.startsWith("/") && !src.startsWith("http")) {
      const localPath = src.startsWith(`/${siteId}`) ? src.replace(`/${siteId}`, "") : src;
      try {
        await fs.access(path.join(outDir, localPath));
      } catch {
        warnings.push(`Broken script ref: ${src}`);
      }
    }
  }

  // Check for empty body
  if (html.includes("<body") && !html.includes("<div")) {
    warnings.push("HTML body appears empty (no div elements)");
  }

  // Check for hydration error markers (Next.js specific)
  if (html.includes("__next_error__") || html.includes("Application error")) {
    warnings.push("HTML contains error markers — possible build-time rendering issue");
  }

  // Check multi-page routes exist (if spec has pages[])
  // Look for additional route directories in out/
  try {
    const outEntries = await fs.readdir(outDir, { withFileTypes: true });
    const routeDirs = outEntries.filter(e => e.isDirectory() && !e.name.startsWith("_") && e.name !== "images");
    if (routeDirs.length > 0) {
      for (const dir of routeDirs) {
        const routeIndex = path.join(outDir, dir.name, "index.html");
        try {
          await fs.access(routeIndex);
        } catch {
          warnings.push(`Multi-page route missing index: /${dir.name}/`);
        }
      }
    }
  } catch {}

  if (warnings.length > 0) {
    logger.warn("generate", `[${siteId}] Post-build warnings: ${warnings.join("; ")}`);
  }
}

/** Dependency whitelist — only these npm packages are allowed in generated sites */
export const ALLOWED_DEPENDENCIES = new Set([
  "next", "react", "react-dom", "tailwindcss", "@tailwindcss/postcss", "postcss",
  "typescript", "@types/react", "@types/node",
  "qrcode", "@types/qrcode", "dijkstrajs", "pngjs",
  // Extensions (installed on demand)
  "three", "@react-three/fiber", "@react-three/drei",
  "@lottiefiles/react-lottie-player", "lottie-web",
  "framer-motion",
]);

/** Validate generated package.json dependencies against whitelist */
export function validateDependencies(files: Record<string, string>): string[] {
  const violations: string[] = [];
  try {
    const pkg = JSON.parse(files["package.json"] || "{}");
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const dep of Object.keys(deps)) {
      if (!ALLOWED_DEPENDENCIES.has(dep)) {
        violations.push(dep);
      }
    }
  } catch {}
  return violations;
}

async function probePreviewUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(
      PREVIEW_PUBLISH_DIR ? url.replace(/\/+$/, "") : `${url.replace(/\/+$/, "")}/__health`,
      { cache: "no-store" },
    );
    return res.ok;
  } catch {
    return false;
  }
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
};

/**
 * Resolve the directory to serve for published content.
 * Prefers `siteRoot/{siteId}/published/` if it exists;
 * falls back to `siteCurrentLink/{siteId}/out/` for backward compatibility.
 */
async function resolvePublishedDir(siteId: string): Promise<string> {
  const published = path.join(siteRoot(siteId), "published");
  try { await fs.access(published); return published; } catch {}
  // Backward compat: old sites without a published/ directory
  return path.join(siteCurrentLink(siteId), "out");
}

export async function ensureStaticServer(): Promise<void> {
  if (staticServer) return;

  await new Promise<void>((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        const rawUrl = decodeURIComponent((req.url || "/").split("?")[0]);
        if (rawUrl === "/health") {
          res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
          res.end(JSON.stringify({ ok: true, port: PREVIEW_PORT }));
          return;
        }

        // Health checks: /drafts/{siteId}/__health → check draft (out/)
        //                 /{siteId}/__health        → check published (published/ or out/)
        const healthMatch = rawUrl.match(/^\/(?:(drafts)\/)?([^/]+)\/__health$/);
        if (healthMatch) {
          const isDraftHealth = healthMatch[1] === "drafts";
          const siteId = healthMatch[2];
          const healthDir = isDraftHealth
            ? path.join(siteCurrentLink(siteId), "out")
            : await resolvePublishedDir(siteId);
          const indexFile = path.join(healthDir, "index.html");
          try {
            const html = await fs.readFile(indexFile, "utf-8");
            res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
            res.end(JSON.stringify({ ok: html.trim().length > 0, siteId, draft: isDraftHealth }));
          } catch {
            res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
            res.end(JSON.stringify({ ok: false, siteId, draft: isDraftHealth }));
          }
          return;
        }

        const parts = rawUrl.split("/").filter(Boolean);
        if (parts.length === 0) { res.writeHead(404); res.end("Not Found"); return; }

        // Route: /drafts/{siteId}/... → draft preview (from build output)
        // Route: /{siteId}/...        → published site (from published/ dir)
        let isDraft = false;
        let siteId: string;
        let filePath: string;

        if (parts[0] === "drafts" && parts.length >= 2) {
          isDraft = true;
          siteId = parts[1];
          filePath = "/" + parts.slice(2).join("/");
        } else {
          siteId = parts[0];
          filePath = "/" + parts.slice(1).join("/");
        }
        if (filePath === "/") filePath = "/index.html";
        if (!path.extname(filePath)) filePath += ".html";

        // Draft: serve from build output; Published: serve from published/ (fallback to out/ for compat)
        const outDir = isDraft
          ? path.join(siteCurrentLink(siteId), "out")
          : await resolvePublishedDir(siteId);
        const fullPath = path.join(outDir, filePath);
        if (!fullPath.startsWith(outDir)) { res.writeHead(403); res.end("Forbidden"); return; }

        const content = await fs.readFile(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        res.writeHead(200, {
          "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store, must-revalidate",
        });
        res.end(content);
      } catch {
        try {
          const parts = decodeURIComponent((req.url || "/").split("?")[0]).split("/").filter(Boolean);
          if (parts.length > 0) {
            // Fallback: serve index.html (for SPA routes)
            const isDraft = parts[0] === "drafts";
            const siteId = isDraft ? parts[1] : parts[0];
            if (siteId) {
              const dir = isDraft
                ? path.join(siteCurrentLink(siteId), "out")
                : await resolvePublishedDir(siteId);
              const index = await fs.readFile(path.join(dir, "index.html"));
              res.writeHead(200, { "Content-Type": "text/html", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store, must-revalidate" });
              res.end(index);
              return;
            }
          }
        } catch {}
        res.writeHead(404);
        res.end("Not Found");
      }
    });

    server.listen(PREVIEW_PORT, () => {
      staticServer = server;
      resolve();
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") resolve();
    });
  });
}

export interface RunSiteBuildInput {
  siteId: string;
  buildId?: string;          // When set, uses immutable build dir; otherwise legacy flat layout
  userId?: string;
  data: WorkspaceData;
  selections: UserSelections;
  spec?: import("./site-spec").SiteSpec | null;
  previewBaseUrl: string;
  knowledgeBaseId?: string;
  knowledgeBaseIds?: string[];
  requestId: string;
  onProgress?: (step: string, options?: { replaceLast?: boolean }) => Promise<void>;
}

export interface RunSiteBuildResult {
  url: string;
  fileMap: Record<string, string>;
  verification: { ok: boolean; checks: Array<{ label: string; ok: boolean }> };
  previewReachable: boolean;
}

// ---- KB → WorkspaceData enrichment (AI-powered) ----

/** Strip HTML tags and decode common entities. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ---- Enrichment: cache-first, AI extract, JSON repair, regex fallback ----

const EXTRACT_SYSTEM_PROMPT = `You are a personal portfolio data extractor. Read the knowledge base content and extract structured data for building a personal website.

The input may contain a FILE INDEX (summaries) and FILE CONTENTS (raw text from resumes, reports, project docs). Text may be messy from PDF parsing.

Output ONLY valid JSON — no markdown fences, no explanatory text before or after. The JSON schema:
{
  "name": "person's full name ONLY (e.g. '徐铭钰')",
  "nameEn": "English/pinyin name (e.g. 'Xu Mingyu')",
  "title": "current job title",
  "titleEn": "job title in English",
  "email": "email address",
  "bio": "2-3 sentence professional summary (third person, original language)",
  "bioEn": "same bio in English",
  "tags": ["3-6 professional tags in English"],
  "skills": [{"title": "category", "skills": ["skill1", "skill2"]}],
  "projects": [{"title": "real project name", "desc": "1-2 sentences", "tags": ["tech"], "org": "company", "role": "role", "period": "time", "highlights": ["achievement"]}],
  "experience": [{"title": "job title", "org": "company", "period": "dates", "desc": "description", "highlights": ["responsibility"], "current": false}],
  "education": [{"school": "name", "degree": "degree+major", "period": "years", "highlights": ["awards"]}],
  "awards": [{"title": "award", "org": "body", "year": "year", "description": "reason"}],
  "links": [{"label": "text", "url": "URL"}]
}

RULES:
1. "name" = ONLY the name. Never include gender, birthdate, or surrounding text.
2. "bio" = synthesized summary, not raw document text.
3. Extract ALL projects — look for 项目名称, numbered lists, work descriptions.
4. Extract ALL experience — company names, job titles, date ranges.
5. Group skills by category.
6. Output must be valid JSON. Do NOT truncate arrays.`;

/** Try to fix common JSON issues from LLM output */
function repairJson(raw: string): unknown | null {
  // Strip markdown fences
  let s = raw.replace(/```json\s*\n?|\n?```/g, "").trim();
  // Strip any leading non-JSON text (e.g. "I'll analyze...")
  const firstBrace = s.indexOf("{");
  if (firstBrace > 0) s = s.slice(firstBrace);
  // Try direct parse
  try { return JSON.parse(s); } catch { /* continue */ }
  // Truncated JSON: find the last valid closing bracket
  for (let i = s.length - 1; i > 0; i--) {
    if (s[i] === "}" || s[i] === "]") {
      try { return JSON.parse(s.slice(0, i + 1)); } catch { /* continue */ }
    }
  }
  // Try adding closing braces
  let balanced = s;
  const opens = (balanced.match(/\{/g) || []).length;
  const closes = (balanced.match(/\}/g) || []).length;
  for (let i = 0; i < opens - closes; i++) balanced += "}";
  try { return JSON.parse(balanced); } catch { /* continue */ }
  return null;
}

/** Map parsed AI JSON to WorkspaceData fields */
function mapParsedToWorkspaceData(parsed: Record<string, unknown>): Partial<WorkspaceData> {
  const clean = (s: unknown) => typeof s === "string" ? stripHtml(s) : s;
  const enriched: Partial<WorkspaceData> = {};

  if (parsed.name) { enriched.name = clean(parsed.name) as string; enriched.nameEn = clean(parsed.nameEn || parsed.name) as string; }
  if (parsed.title) { enriched.title = clean(parsed.title) as string; enriched.titleEn = clean(parsed.titleEn || parsed.title) as string; }
  if (parsed.email) enriched.email = clean(parsed.email) as string;
  if (parsed.bio) { enriched.bio = clean(parsed.bio) as string; enriched.bioEn = clean(parsed.bioEn || parsed.bio) as string; }
  if (Array.isArray(parsed.tags) && parsed.tags.length > 0) enriched.tags = parsed.tags;
  if (Array.isArray(parsed.skills) && parsed.skills.length > 0) {
    enriched.skills = parsed.skills.map((g: Record<string, unknown>) => ({
      title: String(g.title || "Skills"),
      skills: Array.isArray(g.skills) ? g.skills : [],
    }));
  }
  if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
    enriched.projects = parsed.projects.map((p: Record<string, unknown>) => ({
      title: String(p.title || ""), desc: String(p.desc || ""),
      tags: Array.isArray(p.tags) ? p.tags : [], org: String(p.org || ""),
      link: String(p.link || ""), image: "", badge: "",
      role: String(p.role || ""), period: String(p.period || ""),
      highlights: Array.isArray(p.highlights) ? p.highlights : [],
      detail: String(p.detail || p.desc || ""),
    }));
  }
  if (Array.isArray(parsed.experience) && parsed.experience.length > 0) {
    enriched.timeline = parsed.experience.map((e: Record<string, unknown>) => ({
      title: String(e.title || ""), desc: String(e.desc || ""),
      date: String(e.period || ""), active: Boolean(e.current),
      org: String(e.org || ""), highlights: Array.isArray(e.highlights) ? e.highlights : [],
    }));
  }
  if (Array.isArray(parsed.education) && parsed.education.length > 0) {
    enriched.education = parsed.education.map((e: Record<string, unknown>) => ({
      school: String(e.school || ""), degree: String(e.degree || ""),
      highlights: Array.isArray(e.highlights) ? e.highlights : [],
    }));
  }
  if (Array.isArray(parsed.awards) && parsed.awards.length > 0) {
    (enriched as Record<string, unknown>).awards = parsed.awards.map((a: Record<string, unknown>) => ({
      title: String(a.title || ""), org: String(a.org || ""), year: String(a.year || ""), description: String(a.description || ""),
    }));
  }
  if (Array.isArray(parsed.links) && parsed.links.length > 0) {
    enriched.links = parsed.links.map((l: Record<string, unknown>) => ({
      label: String(l.label || ""), labelEn: String(l.labelEn || l.label || ""), url: String(l.url || ""), icon: "other",
    }));
  }
  return enriched;
}

/** Check if enrichment result has meaningful data (not just name/email) */
function isEnrichmentUseful(enriched: Partial<WorkspaceData>): boolean {
  return (enriched.projects?.length || 0) > 0
    || (enriched.timeline?.length || 0) > 0
    || (enriched.skills?.length || 0) > 0
    || (enriched.education?.length || 0) > 0;
}

/**
 * Extract structured data from KB content.
 * Strategy: DB cache → AI (with retry + JSON repair) → regex fallback.
 */
async function enrichWorkspaceDataFromKB(
  data: WorkspaceData,
  kbContent: string,
  userId?: string,
  knowledgeBaseIds?: string[],
): Promise<Partial<WorkspaceData>> {
  // 1. Check DB cache — if any KB has a cached profile, use it
  if (knowledgeBaseIds?.length) {
    try {
      const { knowledgeBases } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");
      for (const bid of knowledgeBaseIds) {
        const kb = await db.select({ profileJson: knowledgeBases.profileJson })
          .from(knowledgeBases).where(eq(knowledgeBases.id, bid)).get();
        if (kb?.profileJson) {
          const cached = JSON.parse(kb.profileJson) as Record<string, unknown>;
          if (cached.name) {
            logger.info("generate", `Using cached profile from KB ${bid}`);
            return mapParsedToWorkspaceData(cached);
          }
        }
      }
    } catch { /* no cache, continue */ }
  }

  // 2. Prepare clean text
  const cleaned = stripHtml(kbContent)
    .replace(/构建网站时：[\s\S]*?用于网站展示/g, "")
    .replace(/## 使用说明[\s\S]*?用于网站展示/g, "");
  const text = cleaned.slice(0, 40000);

  // 3. AI extraction with retry
  const { chatCompletion } = await import("./llm");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await chatCompletion({
        requestId: `kb-extract-${attempt}`,
        label: "kb-content-extract",
        userId,
        systemPrompt: EXTRACT_SYSTEM_PROMPT,
        userPrompt: attempt === 0 ? text : text.slice(0, 25000), // Retry with shorter input
        temperature: 0.1,
        maxTokens: 8192,
      });

      const parsed = repairJson(result.content);
      if (!parsed || typeof parsed !== "object") {
        logger.warn("generate", `AI extraction attempt ${attempt + 1}: JSON repair failed`);
        continue;
      }

      const enriched = mapParsedToWorkspaceData(parsed as Record<string, unknown>);

      // Cache successful extraction to DB
      if (isEnrichmentUseful(enriched) && knowledgeBaseIds?.length) {
        try {
          const { knowledgeBases } = await import("@/lib/db/schema");
          const { eq } = await import("drizzle-orm");
          await db.update(knowledgeBases).set({
            profileJson: JSON.stringify(parsed),
            updatedAt: new Date().toISOString(),
          }).where(eq(knowledgeBases.id, knowledgeBaseIds[0]));
          logger.info("generate", `Cached enrichment to KB ${knowledgeBaseIds[0]}`);
        } catch { /* non-critical */ }
      }

      return enriched;
    } catch (err) {
      logger.warn("generate", `AI extraction attempt ${attempt + 1} failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  // 4. Regex fallback
  logger.warn("generate", "All AI extraction attempts failed, using regex fallback");
  return regexEnrichWorkspaceData(text);
}

/** Regex-based fallback for KB extraction when AI is unavailable */
function regexEnrichWorkspaceData(text: string): Partial<WorkspaceData> {
  const result: Partial<WorkspaceData> = {};

  // Name: stop at common boundary words (性别, 出生, 电话, 邮箱, etc.)
  const namePatterns = [
    /(?:姓名|名字|Name)[：:\s]*([^\n,，。.]{2,6})(?:\s|$|性别|出生|电话|邮箱|身份)/i,
    /(?:姓名|名字|Name)[：:\s]*([\u4e00-\u9fff]{2,4})/i,
    /^#\s+([\u4e00-\u9fff]{2,6})$/m,
    /(?:我是|I am|I'm)\s+([^\n,，。.]{2,20})/i,
  ];
  for (const p of namePatterns) {
    const m = text.match(p);
    if (m && m[1].trim().length >= 2) { result.name = m[1].trim(); result.nameEn = result.name; break; }
  }

  // Title
  const titlePatterns = [
    /(?:职位|职业|岗位|Title|Role|Position)[：:\s]*([^\n,，。]{2,30})/i,
    /(?:担任|任职)\s*([^\n,，。]{2,20})/i,
  ];
  for (const p of titlePatterns) {
    const m = text.match(p);
    if (m) { result.title = m[1].trim(); result.titleEn = result.title; break; }
  }

  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
  if (emailMatch) result.email = emailMatch[0];

  // Bio: prefer paragraphs that look like self-introductions
  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 50 && !p.trim().startsWith("#") && !p.trim().startsWith("构建网站"));
  if (paragraphs.length > 0) { result.bio = paragraphs[0].trim().slice(0, 500); result.bioEn = result.bio; }

  return result;
}

// ---- Advanced mode helpers ----

function generateMinimalThemeCSS(theme: string): string {
  const config = STYLE_CONFIG[theme as keyof typeof STYLE_CONFIG] || STYLE_CONFIG.minimalist;
  const colorVars = Object.entries(config.colors).map(([k, v]) => `  --color-${k}: ${v};`).join("\n");
  return `@import "tailwindcss";

@theme {
${colorVars}
  --font-sans: ${config.fontSans};
  --font-heading: ${config.fontHeading};
}

body { background-color: var(--color-bg); color: var(--color-text); font-family: var(--font-sans); line-height: 1.6; -webkit-font-smoothing: antialiased; }
::selection { background-color: var(--color-accent); color: white; }
html { scroll-behavior: smooth; }
`;
}

function generateAdvancedLayout(theme: string): string {
  const config = STYLE_CONFIG[theme as keyof typeof STYLE_CONFIG] || STYLE_CONFIG.minimalist;
  const fontFamilies = new Set<string>();
  for (const f of [config.fontSans, config.fontHeading]) {
    const match = f.match(/"([^"]+)"/);
    if (match) fontFamilies.add(match[1]);
  }
  const googleFonts = [...fontFamilies].map(f => f.replace(/ /g, "+")).join("&family=");
  const fontLink = googleFonts ? `<link href="https://fonts.googleapis.com/css2?family=${googleFonts}:wght@300;400;500;600;700&display=swap" rel="stylesheet" />` : "";

  return `import type { Metadata } from "next";
import "./globals.css";
import LanguageProvider from "@/components/LanguageProvider";

export const metadata: Metadata = { title: "My Site", description: "Generated with CreateAnySite" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <head>${fontLink ? `\n        ${fontLink}` : ""}</head>
      <body><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
`;
}

function generateAdvancedTranslations(data: WorkspaceData): string {
  const p = data;
  // Build nav dynamically — only include sections that actually have content
  const allNavZh: Record<string, string> = { about: "关于", projects: "项目", experience: "经历", skills: "技能", education: "教育", contact: "联系", posts: "文章", awards: "荣誉", publications: "论文" };
  const allNavEn: Record<string, string> = { about: "About", projects: "Projects", experience: "Experience", skills: "Skills", education: "Education", contact: "Contact", posts: "Posts", awards: "Awards", publications: "Publications" };
  const actualSections = ["about", ...(p.projects.length > 0 ? ["projects"] : []), ...(p.timeline.length > 0 ? ["experience"] : []), ...(p.skills.length > 0 ? ["skills"] : []), ...(p.education.length > 0 ? ["education"] : []), "contact"];
  const navZh: Record<string, string> = {};
  const navEn: Record<string, string> = {};
  for (const s of actualSections) {
    if (allNavZh[s]) navZh[s] = allNavZh[s];
    if (allNavEn[s]) navEn[s] = allNavEn[s];
  }

  const t = {
    nav: navZh,
    hero: { name: p.name, title: p.title, subtitle: "", tags: p.tags || [] },
    about: { text: p.bio || "", tags: p.bioTags || [] },
    projects: (p.projects || []).map(pr => {
      const extra = pr as unknown as Record<string, unknown>;
      return { title: pr.title, org: pr.org || "", desc: pr.desc, tags: pr.tags || [], image: pr.image || "", link: pr.link || "", badge: pr.badge || "", detail: String(extra.detail || extra.desc || ""), highlights: Array.isArray(extra.highlights) ? extra.highlights : [], role: String(extra.role || ""), period: String(extra.period || "") };
    }),
    experience: (p.timeline || []).map(e => {
      const extra = e as unknown as Record<string, unknown>;
      return { title: e.title, org: String(extra.org || ""), period: e.date || "", desc: e.desc, highlights: Array.isArray(extra.highlights) ? extra.highlights : [], current: e.active || false };
    }),
    skills: (p.skills || []).map(g => ({ title: g.title, skills: g.skills })),
    education: (p.education || []).map(e => ({ school: e.school, degree: e.degree, period: "", highlights: e.highlights || [] })),
    testimonials: [] as Array<{ quote: string; author: string; role: string; company: string }>,
    awards: ((p as unknown as Record<string, unknown>).awards as Array<{ title: string; org: string; year: string; description: string }>) || [],
    publications: [] as Array<{ title: string; authors: string; venue: string; year: string; abstract: string; url: string }>,
    media: [] as Array<{ type: string; title: string; platform: string; url: string; date: string; description: string }>,
    demos: [] as Array<{ title: string; description: string; url: string; screenshot: string; techStack: string[] }>,
    contact: { email: p.email || "", links: (p.links || []).map(l => ({ type: "website", label: l.label, url: l.url, icon: l.icon || "other" })) },
    footer: `© ${new Date().getFullYear()} ${p.name}`,
    chatbot: { title: `${p.name} AI`, subtitle: "有什么想问的？", welcome: `你好！可以问我关于${p.name}的经历和技能。`, placeholder: "输入你的问题...", send: "发送", tooltip: "AI 对话", suggestions: p.projects.length > 0 ? [`介绍一下「${p.projects[0].title}」`, "你有哪些核心技能？", "你现在接受合作吗？"] : ["你是做什么的？", "介绍一下你的经历", "你有哪些技能？"] },
    share: { button: "分享", title: "分享", invite: `欢迎了解 ${p.name}`, desc: "个人网站", save: "保存", copy: "复制链接", copied: "已复制！" },
    availableSections: actualSections,
    posts: [] as Array<{ title: string; slug: string; excerpt: string; content: string; category: string; tags: string[]; image: string; publishedAt: string; readingTime: string }>,
    links: (p.links || []).map(l => ({ label: l.label, url: l.url, icon: l.icon || "other" })),
  };
  const en = {
    ...JSON.parse(JSON.stringify(t)),
    nav: navEn,
    hero: { name: p.nameEn || p.name, title: p.titleEn || p.title, subtitle: "", tags: t.hero.tags },
    about: { text: p.bioEn || p.bio || "", tags: t.about.tags },
    footer: `© ${new Date().getFullYear()} ${p.nameEn || p.name}`,
    chatbot: { title: `${p.nameEn || p.name} AI`, subtitle: "Ask me anything", welcome: `Hi! Ask me about ${p.nameEn || p.name}'s experience and skills.`, placeholder: "Type your question...", send: "Send", tooltip: "AI Chat", suggestions: p.projects.length > 0 ? [`Tell me about "${p.projects[0].title}"`, "What are your core skills?", "Are you open to collaboration?"] : ["What do you do?", "Tell me about your experience", "What are your skills?"] },
    share: { button: "Share", title: "Share", invite: `Learn about ${p.nameEn || p.name}`, desc: "Personal website", save: "Save", copy: "Copy Link", copied: "Copied!" },
  };

  // Use the same typed TranslationData from template-renderer approach
  return `/* eslint-disable @typescript-eslint/no-explicit-any */
interface TData { [key: string]: any; }
export const translations: { zh: TData; en: TData } = {
  zh: ${JSON.stringify(t, null, 2)} as TData,
  en: ${JSON.stringify(en, null, 2)} as TData,
};
export type Lang = keyof typeof translations;
export type Translations = TData;
`;
}

export async function runSiteBuild(input: RunSiteBuildInput): Promise<RunSiteBuildResult> {
  const { siteId, data, selections, spec, previewBaseUrl, requestId, onProgress } = input;
  const progress = async (step: string, opts?: { replaceLast?: boolean }) => { if (onProgress) await onProgress(step, opts).catch(() => {}); };

  logger.info("generate", `[${requestId}] Generate for site ${siteId}`, {
    name: data.name,
    siteType: selections.siteType,
    theme: selections.theme,
  });

  let files: Record<string, string>;

  // Context stashed for build-failure retry: lets us re-invoke the Code Agent
  // with a repair hint without re-running the (expensive) design agent, KB
  // loading, recipe resolution, etc. Only populated in advanced mode.
  let repairCtx: {
    codeCtx: import("./build-agents").BuildConversationContext;
    designPlan: Record<string, unknown>;
    componentReferences?: string;
    assetCss: string;
  } | null = null;

  // Advanced mode — Code Agent writes ALL code from scratch
  if (selections.compositionPlan) {
    const { generateBaseFiles } = await import("./shared-components");
    const { runCodeAgent } = await import("./build-agents");
    const { getVisualAssetCSS } = await import("./components");

    // Generate infrastructure files (package.json, tsconfig, shared components)
    files = generateBaseFiles({ siteName: data.name, chatbotContext: data.chatbotContext, theme: selections.theme || undefined });

    // Resolve recipe if Design Agent provided one (recipe + layers + overrides)
    let resolvedRecipe = null;
    const recipeId = (selections as any).recipe;
    if (recipeId) {
      try {
        const { resolveDesignPlan } = await import("./recipes/loader");
        resolvedRecipe = resolveDesignPlan({
          recipe: recipeId,
          layers: (selections as any).recipeLayers || [],
          overrides: (selections as any).recipeOverrides || undefined,
        });
        if (resolvedRecipe) {
          // Apply recipe extra CSS tokens to globals.css
          const { recipeExtraCSS, recipeToResolvedStyle } = await import("./generator-config");
          const recipeCSS = recipeExtraCSS(resolvedRecipe);
          const resolvedStyle = recipeToResolvedStyle(resolvedRecipe);
          // Inject recipe CSS variables into globals.css
          if (files["src/app/globals.css"]) {
            files["src/app/globals.css"] = files["src/app/globals.css"].replace(
              "}",
              `\n${recipeCSS}\n}`,
            );
          }
          // Use recipe card CSS if available
          if (resolvedRecipe.cardCSS) {
            files["src/app/globals.css"] += "\n\n/* === Recipe Card Style === */\n" + resolvedRecipe.cardCSS;
          }
          logger.info("generate", `[${requestId}] Resolved recipe: ${recipeId} + ${(selections as any).recipeLayers?.length || 0} layers`);
        }
      } catch (err) {
        logger.warn("generate", `[${requestId}] Recipe resolution failed: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    // Resolve asset CSS
    const assetCss = getVisualAssetCSS(selections.compositionPlan);

    const designPlan = {
      compositionPlan: selections.compositionPlan,
      theme: selections.theme,
      customTheme: selections.customTheme,
      siteType: selections.siteType,
    };

    // Load knowledge base content (raw files, not just summaries) — supports multiple KBs
    let kbContent = data.chatbotContext || "";
    const allBaseIds = input.knowledgeBaseIds?.length ? input.knowledgeBaseIds : (input.knowledgeBaseId ? [input.knowledgeBaseId] : []);
    if (input.userId && allBaseIds.length > 0) {
      try {
        const { loadFullKBContext, formatFilesForPrompt } = await import("./kb-loader");
        const parts: string[] = [];
        let totalFiles = 0;
        for (const bid of allBaseIds) {
          const kbCtx = await loadFullKBContext(input.userId, bid);
          if (kbCtx.fileCount > 0) {
            // Code Agent only needs structure/metadata (images, section hints), not full text.
          // Actual content extraction is done separately in enrichWorkspaceDataFromKB.
          // Keeping this compact (~15K total) significantly reduces LLM processing time.
          parts.push(`## KB: ${kbCtx.indexContent.split("\\n")[0] || bid}\n${kbCtx.indexContent}\n\n${formatFilesForPrompt(kbCtx.fileContents, Math.floor(20000 / allBaseIds.length))}`);
            totalFiles += kbCtx.fileCount;
          }
        }
        if (parts.length > 0) {
          kbContent = parts.join("\n\n---\n\n");
          logger.info("generate", `[${requestId}] Loaded ${totalFiles} KB files from ${allBaseIds.length} bases for Code Agent`);
        }
      } catch (err) {
        logger.warn("generate", `[${requestId}] KB load failed: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    // Extract component variant source code as references for Code Agent
    let componentReferences = "";
    try {
      const { extractComponentReferences, formatReferencesForPrompt } = await import("./components/reference-extractor");
      const refs = await extractComponentReferences(selections.compositionPlan);
      if (refs.length > 0) {
        const sectionRationale = (selections as any).sectionRationale as Record<string, string> | undefined;
        const designReasoning = (selections as any).designReasoning as string | undefined;
        componentReferences = formatReferencesForPrompt(refs, designReasoning, sectionRationale);
        logger.info("generate", `[${requestId}] Extracted ${refs.length} component references for Code Agent`);
      }
    } catch (err) {
      logger.warn("generate", `[${requestId}] Component reference extraction failed: ${err instanceof Error ? err.message : "unknown"}`);
    }

    logger.info("generate", `[${requestId}] Advanced mode: running Code Agent (${kbContent.length} chars knowledge)...`);
    const codeCtx: import("./build-agents").BuildConversationContext = {
      requestId,
      messages: [],
      knowledgeContext: kbContent,
      knowledgeSummary: "",
      knowledgeGroupIndex: "",
      skillCatalog: "",
      activatedContext: "",
      codeContext: "",
      hasSiteCode: false,
      currentPrd: "",
      currentSelections: selections,
      userId: input.userId,
      siteId: input.siteId,
    };
    // Stash for potential build-failure retries later.
    repairCtx = { codeCtx, designPlan, assetCss, componentReferences };

    // --- Code Agent with live progress (timer overwrites the same line) ---
    await progress("🧠 AI 正在生成页面代码...（预计 2-5 分钟）");
    const codeAgentStart = Date.now();
    const progressTimer = setInterval(async () => {
      const elapsed = Math.round((Date.now() - codeAgentStart) / 1000);
      const min = Math.floor(elapsed / 60);
      const sec = elapsed % 60;
      const timeStr = min > 0 ? `${min}分${sec}秒` : `${sec}秒`;
      await progress(`🧠 AI 正在生成页面代码... 已等待 ${timeStr}`, { replaceLast: true });
    }, 15_000);
    let codeResult;
    try {
      codeResult = await runCodeAgent(codeCtx, designPlan, assetCss, undefined, componentReferences);
    } finally {
      clearInterval(progressTimer);
    }
    const codeAgentSec = ((Date.now() - codeAgentStart) / 1000).toFixed(1);
    await progress(`✅ 代码生成完成（用时 ${codeAgentSec}s）`, { replaceLast: true });

    // Enrich WorkspaceData from KB content when legacy items are empty.
    // Strategy: use the KB index (structured summaries) as a guide + prioritized
    // file content (resume first) for actual data extraction.
    if (kbContent && (!data.name || data.name === "Your Name" || data.name === "")) {
      let enrichInput = kbContent;
      if (input.userId && allBaseIds.length > 0) {
        try {
          const { loadFullKBContext, formatFilesForPrompt } = await import("./kb-loader");
          const indexParts: string[] = [];
          const allFiles = new Map<string, { name: string; content: string; type: string }>();
          for (const bid of allBaseIds) {
            const kbCtx = await loadFullKBContext(input.userId, bid);
            // Keep index summaries (strip usage instructions)
            const cleanIndex = (kbCtx.indexContent || "")
              .replace(/## 使用说明[\s\S]*?用于网站展示\s*/g, "")
              .replace(/构建网站时：[\s\S]*?用于网站展示\s*/g, "");
            if (cleanIndex.trim()) indexParts.push(cleanIndex);
            for (const [id, f] of kbCtx.fileContents) allFiles.set(id, f);
          }
          // Sort: resume/personal/述职 files first, large PDFs with low info-density last
          const highPriority = /简历|resume|cv|述职|profile|经历|介绍|自我/i;
          const lowPriority = /竞品|调研|会议|规则|仿真|财报|售前|讲义/i;
          const sorted = new Map<string, { name: string; content: string; type: string }>(
            [...allFiles.entries()].sort(([, a], [, b]) => {
              const aP = highPriority.test(a.name) ? 0 : lowPriority.test(a.name) ? 2 : 1;
              const bP = highPriority.test(b.name) ? 0 : lowPriority.test(b.name) ? 2 : 1;
              return aP - bP;
            }),
          );
          // Build: index summaries (as guide) + file contents (for data)
          const indexSection = indexParts.length > 0
            ? `## FILE INDEX (summaries of available files)\n${indexParts.join("\n\n")}\n\n## FILE CONTENTS (actual data to extract from)\n`
            : "";
          enrichInput = indexSection + formatFilesForPrompt(sorted, 50000);
        } catch {
          // Fall back to full kbContent
        }
      }
      const enriched = await enrichWorkspaceDataFromKB(data, enrichInput, input.userId, allBaseIds);
      Object.assign(data, enriched);
      logger.info("generate", `[${requestId}] Enriched WorkspaceData from KB: name="${data.name}", bio=${data.bio?.length || 0} chars, projects=${data.projects?.length || 0}`);
    }

    // Always generate these regardless of Code Agent result
    files["src/i18n/translations.ts"] = generateAdvancedTranslations(data);
    files["src/app/layout.tsx"] = generateAdvancedLayout(selections.theme || "minimalist");
    files["src/app/globals.css"] = generateMinimalThemeCSS(selections.theme || "minimalist") + (assetCss ? "\n\n/* === Visual Assets === */\n" + assetCss : "");

    if (codeResult.valid && codeResult.pageTsx) {
      let pageSrc = codeResult.pageTsx;

      // Enforce chatMode: if "cartoon" (or unset), ensure CartoonAssistant is used instead of ChatBot
      const chatMode = selections.compositionPlan?.chatMode || "cartoon";
      if (chatMode === "cartoon" && pageSrc.includes("ChatBot") && !pageSrc.includes("CartoonAssistant")) {
        pageSrc = pageSrc
          .replace(/import\s+ChatBot\s+from\s+["'][^"']+["']/g, 'import CartoonAssistant from "@/components/CartoonAssistant"')
          .replace(/<ChatBot\s*\/>/g, "<CartoonAssistant />");
        logger.info("generate", `[${requestId}] chatMode=cartoon: auto-replaced ChatBot → CartoonAssistant`);
      }

      files["src/app/page.tsx"] = pageSrc;
      if (codeResult.globalsCssExtra) {
        files["src/app/globals.css"] += "\n\n/* === Code Agent Custom Styles === */\n" + codeResult.globalsCssExtra;
      }
      logger.info("generate", `[${requestId}] Code Agent succeeded — custom code (${pageSrc.length} chars)`);
    } else {
      // No fallback — report the error
      const errMsg = codeResult.errors.join(", ") || "Code Agent produced empty output";
      logger.error("generate", `[${requestId}] Code Agent failed: ${errMsg}`);
      throw new Error(`Advanced mode Code Agent failed: ${errMsg}. Please try again.`);
    }
  }
  // Fallback — no compositionPlan available, generate basic files
  else {
    const { generateBaseFiles } = await import("./shared-components");
    files = generateBaseFiles({ siteName: data.name, chatbotContext: data.chatbotContext, theme: selections.theme || undefined });
    logger.warn("generate", `[${requestId}] No compositionPlan found — generated base files only`);
  }

  if (files["tsconfig.json"]) {
    try {
      const tsconfig = JSON.parse(files["tsconfig.json"]);
      tsconfig.compilerOptions = tsconfig.compilerOptions || {};
      tsconfig.compilerOptions.skipLibCheck = true;
      tsconfig.compilerOptions.noImplicitAny = false; // Code Agent rarely adds type annotations
      files["tsconfig.json"] = JSON.stringify(tsconfig, null, 2);
    } catch {}
  }

  // Knowledge routing: route knowledge items to sections for richer chatbot context
  if (input.userId && spec) {
    try {
      const userItems = await db
        .select()
        .from(knowledgeItemsTable)
        .where(eq(knowledgeItemsTable.userId, input.userId));

      const items: KnowledgeItem[] = userItems
        .filter(i => i.selected === 1)
        .map(i => ({
          id: i.id,
          category: i.category as KnowledgeItem["category"],
          title: i.title,
          content: i.content,
          sourceId: i.sourceId || "",
          sourceName: i.sourceName || undefined,
          sourceType: i.sourceType || undefined,
          selected: true,
          tags: i.tags ? JSON.parse(i.tags) : [],
          useCase: i.useCase || undefined,
        }));

      if (items.length > 0) {
        const specSections = getSpecSections(spec);
        const routing = routeKnowledge(items, specSections);
        logger.info("generate", `[${requestId}] Knowledge routing: ${routing.summary}`);

        // Enrich knowledge.json with section-aware context
        const routedContext = buildRoutedChatbotContext(routing);
        if (routedContext && files["src/data/knowledge.json"]) {
          try {
            const existing = JSON.parse(files["src/data/knowledge.json"]);
            // Append routed sections as additional chunks
            for (const [sectionId, sectionItems] of Object.entries(routing.sections)) {
              if (sectionItems.length === 0) continue;
              existing.chunks.push({
                topic: sectionId,
                content: sectionItems.map(i => `${i.title}: ${i.content}`).join("\n"),
              });
            }
            // Append unrouted items as general knowledge (not silently dropped)
            if (routing.unrouted.length > 0) {
              existing.chunks.push({
                topic: "general",
                content: routing.unrouted.map(i => `${i.title}: ${i.content}`).join("\n"),
              });
            }
            files["src/data/knowledge.json"] = JSON.stringify(existing, null, 2);
          } catch {}
        }
      }
    } catch (err) {
      logger.warn("generate", `[${requestId}] Knowledge routing failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  // Enrich knowledge.json with KB file contents for chatbot (uses new knowledge_bases system)
  const chatbotBaseIds = input.knowledgeBaseIds?.length ? input.knowledgeBaseIds : (input.knowledgeBaseId ? [input.knowledgeBaseId] : []);
  if (chatbotBaseIds.length > 0 && files["src/data/knowledge.json"]) {
    try {
      const { loadFullKBContext: loadKB, formatFilesForPrompt: fmtFiles } = await import("./kb-loader");
      // Merge all selected KBs for chatbot
      const mergedFileContents = new Map<string, { name: string; content: string; type: string }>();
      let mergedIndex = "";
      for (const bid of chatbotBaseIds) {
        const kbCtx = await loadKB(input.userId || "", bid);
        if (kbCtx.fileCount > 0) {
          mergedIndex += (mergedIndex ? "\n\n" : "") + kbCtx.indexContent;
          for (const [k, v] of kbCtx.fileContents) mergedFileContents.set(`${bid}:${k}`, v);
        }
      }
      const kbCtx = { fileCount: mergedFileContents.size, indexContent: mergedIndex, fileContents: mergedFileContents };
      if (kbCtx.fileCount > 0) {
        const existing = JSON.parse(files["src/data/knowledge.json"]);
        for (const [, file] of kbCtx.fileContents) {
          if (file.type === "image" || !file.content || file.content.length < 10) continue;
          existing.chunks.push({
            topic: file.name.replace(/\.[^.]+$/, ""),
            content: file.content.slice(0, 5000),
          });
        }
        files["src/data/knowledge.json"] = JSON.stringify(existing, null, 2);
        logger.info("generate", `[${requestId}] Injected ${kbCtx.fileCount} KB files into knowledge.json for chatbot`);
      }
    } catch (err) {
      logger.warn("generate", `[${requestId}] KB chatbot enrichment failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  // Validate dependencies against whitelist
  const depViolations = validateDependencies(files);
  if (depViolations.length > 0) {
    logger.warn("generate", `[${requestId}] Removing non-whitelisted dependencies: ${depViolations.join(", ")}`);
    try {
      const pkg = JSON.parse(files["package.json"]);
      for (const dep of depViolations) {
        delete pkg.dependencies?.[dep];
        delete pkg.devDependencies?.[dep];
      }
      files["package.json"] = JSON.stringify(pkg, null, 2);
    } catch {}
  }

  // Auto-fix common issues in generated code before writing to disk
  const guardrailResult = runCodeGuardrails(files, siteId, previewBaseUrl, logger);
  files = guardrailResult.files;

  // Advanced mode deep validation: type annotations, import resolution, translation keys
  await progress("🔍 验证生成代码...");
  const advancedFixes = runAdvancedModeGuardrails(files, ALLOWED_DEPENDENCIES, logger);
  if (advancedFixes.length > 0) {
    await progress(`✅ 代码验证：${advancedFixes.length} 项自动修复`);
  } else {
    await progress("✅ 代码验证通过");
  }

  // Record all guardrail fixes into cross-build error memory
  const allGuardrailFixes = [...guardrailResult.fixes, ...advancedFixes];
  if (allGuardrailFixes.length > 0) {
    recordGuardrailFixes(allGuardrailFixes, {
      siteId,
      buildId: input.buildId,
      theme: selections.theme,
      siteType: selections.siteType,
    });
  }

  const fileCount = Object.keys(files).length;
  await progress(`📄 写入 ${fileCount} 个文件`);

  // Set up site directory — immutable build dir when buildId is provided
  const rootDir = await ensureSiteDir(siteId);
  const buildDir = input.buildId
    ? await prepareBuildDir(siteId, input.buildId)
    : rootDir;
  await writeFilesToSiteDir(buildDir, files);

  // Copy user's uploaded images into the site's public/images/
  // Build tagMap from KB so images with usage tags get standard filename aliases (e.g., avatar.png)
  if (input.userId) {
    let tagMap: Map<string, string> | undefined;
    try {
      const imageRecords = await db.select({
        assetPath: knowledgeFilesTable.assetPath,
        usageTag: knowledgeFilesTable.usageTag,
      }).from(knowledgeFilesTable)
        .where(and(
          eq(knowledgeFilesTable.userId, input.userId),
          eq(knowledgeFilesTable.type, "image"),
        ));
      const tagged = imageRecords.filter(r => r.assetPath && r.usageTag);
      if (tagged.length > 0) {
        tagMap = new Map(tagged.map(r => [r.assetPath!, r.usageTag!]));
      }
    } catch { /* non-fatal */ }
    const imgCount = await copyUserImagesToSite(input.userId, buildDir, tagMap);
    if (imgCount > 0) logger.info("generate", `[${requestId}] Copied ${imgCount} user images to site${tagMap ? ` (${tagMap.size} tagged)` : ""}`);
  }

  await progress("📦 准备依赖...");
  if (input.buildId) {
    // Immutable build: set up node_modules in the build dir via absolute symlink
    await ensureBuildNodeModules(siteId, buildDir);
  } else {
    // Legacy path: deps live directly in site dir
    await ensureNodeModules(buildDir);
  }
  const siteDir = buildDir; // alias for backward compat in the rest of the function

  // Build with up to MAX_BUILD_RETRIES retries. On each failure, feed the
  // build error back to the Code Agent as a repair hint so it can produce
  // a corrected page.tsx. Only runs in advanced mode (where repairCtx is
  // populated); the basic fallback path fails on first error as before.
  const MAX_BUILD_RETRIES = 2;
  let buildAttempt = 0;
  while (true) {
    await progress(
      buildAttempt === 0
        ? "🔨 编译项目..."
        : `🔨 编译项目 (重试 ${buildAttempt}/${MAX_BUILD_RETRIES})...`,
    );
    try {
      await staticBuild(siteDir);
      break; // success
    } catch (err) {
      const errObj = err as { stdout?: string; stderr?: string; message?: string };
      const stderrText = errObj.stderr || "";
      const stdoutText = errObj.stdout || "";
      const errSummary = summarizeBuildOutput(stdoutText, stderrText).join("\n");
      logger.warn(
        "generate",
        `[${requestId}] staticBuild failed (attempt ${buildAttempt + 1}/${MAX_BUILD_RETRIES + 1}): ${errObj.message || "unknown"}\n${errSummary.slice(0, 800)}`,
      );

      // Record error into cross-build error memory
      recordBuildError(errSummary || errObj.message || "unknown build error", {
        siteId,
        buildId: input.buildId,
        theme: selections.theme,
        siteType: selections.siteType,
      });

      const canRetry = repairCtx && buildAttempt < MAX_BUILD_RETRIES;
      if (!canRetry) {
        // Preserve stdout/stderr on the error so build-queue can persist them.
        throw err;
      }

      buildAttempt++;
      await progress(`⚠️ 构建失败，AI 正在修复代码 (${buildAttempt}/${MAX_BUILD_RETRIES})...预计 2-5 分钟`);

      const prevPage = files["src/app/page.tsx"] || "";
      const prevCss = files["src/app/globals.css"] || "";

      const { runCodeAgent: runCodeAgentRetry } = await import("./build-agents");
      const repairStart = Date.now();
      const repairTimer = setInterval(async () => {
        const elapsed = Math.round((Date.now() - repairStart) / 1000);
        const min = Math.floor(elapsed / 60);
        const sec = elapsed % 60;
        const timeStr = min > 0 ? `${min}分${sec}秒` : `${sec}秒`;
        await progress(`🔧 AI 修复代码中... 已等待 ${timeStr} (${buildAttempt}/${MAX_BUILD_RETRIES})`, { replaceLast: true });
      }, 15_000);
      let repairResult;
      try {
        repairResult = await runCodeAgentRetry(
          repairCtx!.codeCtx,
          repairCtx!.designPlan,
          repairCtx!.assetCss,
          {
            previousPageTsx: prevPage,
            previousGlobalsCss: prevCss,
            buildError: errSummary || errObj.message || "(no error output captured)",
            attempt: buildAttempt,
          },
          repairCtx!.componentReferences,
        );
      } catch (repairErr) {
        clearInterval(repairTimer);
        logger.error(
          "generate",
          `[${requestId}] Repair Code Agent call failed on attempt ${buildAttempt}: ${repairErr instanceof Error ? repairErr.message : String(repairErr)}`,
        );
        // Fall back to re-throwing the original build error — the repair
        // itself crashed, nothing useful to retry with.
        throw err;
      }

      clearInterval(repairTimer);
      const repairSec = ((Date.now() - repairStart) / 1000).toFixed(1);
      await progress(`✅ 代码修复完成（用时 ${repairSec}s），重新编译...`, { replaceLast: true });

      if (!repairResult.valid || !repairResult.pageTsx) {
        logger.warn(
          "generate",
          `[${requestId}] Repair attempt ${buildAttempt} produced invalid output: ${repairResult.errors.join(", ") || "empty"}`,
        );
        // Continue loop — the NEXT retry will try again with the still-
        // failing code. If buildAttempt has hit MAX_BUILD_RETRIES the next
        // iteration will throw via canRetry===false.
        continue;
      }

      // Apply chatMode enforcement same as the first-pass path
      let fixedPage = repairResult.pageTsx;
      const chatMode = selections.compositionPlan?.chatMode || "cartoon";
      if (chatMode === "cartoon" && fixedPage.includes("ChatBot") && !fixedPage.includes("CartoonAssistant")) {
        fixedPage = fixedPage
          .replace(/import\s+ChatBot\s+from\s+["'][^"']+["']/g, 'import CartoonAssistant from "@/components/CartoonAssistant"')
          .replace(/<ChatBot\s*\/>/g, "<CartoonAssistant />");
      }
      files["src/app/page.tsx"] = fixedPage;

      // Replace (not append) the Code Agent custom styles section so retries
      // don't pile up duplicate blocks on top of each other.
      if (repairResult.globalsCssExtra) {
        const marker = "\n\n/* === Code Agent Custom Styles === */";
        const baseCss = files["src/app/globals.css"] || "";
        const markerIdx = baseCss.indexOf(marker);
        const trimmed = markerIdx >= 0 ? baseCss.slice(0, markerIdx) : baseCss;
        files["src/app/globals.css"] = trimmed + marker + "\n" + repairResult.globalsCssExtra;
      }

      // Re-run guardrails on the patched file set and write back to disk.
      // writeFilesToSiteDir only wipes src/, so public/images/ and
      // node_modules/ are preserved across retries — no need to recopy
      // user images or reinstall deps.
      const retryGuardrailResult = runCodeGuardrails(files, siteId, previewBaseUrl, logger);
      files = retryGuardrailResult.files;
      runAdvancedModeGuardrails(files, ALLOWED_DEPENDENCIES, logger);
      await writeFilesToSiteDir(siteDir, files);
      // Loop continues; next iteration will re-attempt staticBuild.
    }
  }

  if (!PREVIEW_PUBLISH_DIR) {
    // Draft: rewrite asset paths for /drafts/{siteId} prefix
    await rewriteExportAssetPaths(path.join(siteDir, "out"), "", `/drafts/${siteId}`);
    // Auto-publish: first build is automatically published
    const publishedDir = path.join(siteRoot(siteId), "published");
    await copyDirectory(path.join(siteDir, "out"), publishedDir);
    // Published copy uses /{siteId} prefix (rewrite from /drafts/{siteId} to /{siteId})
    await rewriteExportAssetPaths(publishedDir, `/drafts/${siteId}`, `/${siteId}`);
  }

  await progress("📋 检查构建产物...");
  await assertPreviewArtifacts(siteDir, siteId);

  await progress("🚀 发布预览...");
  if (PREVIEW_PUBLISH_DIR) {
    await syncDraftPreview(siteId, siteDir);
  } else {
    await ensureStaticServer();
  }

  // Swap the `current` symlink to this build (atomic — readers never see partial state)
  if (input.buildId) {
    await swapCurrentSymlink(siteId, input.buildId);
    logger.info("generate", `[${requestId}] Symlink current → builds/${input.buildId}`);
  }

  const url = PREVIEW_PUBLISH_DIR
    ? getDraftPreviewUrl(siteId, previewBaseUrl)
    : `${previewBaseUrl.replace(/\/+$/, "")}/drafts/${siteId}`;
  const verification = await runVerification(siteDir, files, spec || undefined);
  const previewReachable = await probePreviewUrl(url);

  // Record build event
  if (input.userId) {
    import("./usage").then(({ recordUsage }) => {
      recordUsage(input.userId!, {
        action: "build",
        label: "site-generate",
        siteId: input.siteId || siteId,
      }).catch(() => {});
    });
  }

  return { url, fileMap: files, verification, previewReachable };
}
