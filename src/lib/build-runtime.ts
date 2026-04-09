import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import http from "http";
import type { WorkspaceData, UserSelections } from "@/lib/types";
import { logger } from "@/lib/logger";
import { getInstalledNextVersion } from "@/lib/next-version";
import { runCodeGuardrails, runAdvancedModeGuardrails } from "@/lib/code-guardrails";
import { copyUserImagesToSite } from "@/lib/asset-store";
import { routeKnowledge, buildRoutedChatbotContext } from "@/lib/knowledge-router";
import { knowledgeItems as knowledgeItemsTable } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { KnowledgeItem } from "@/lib/knowledge";
import { getSpecSections } from "@/lib/site-spec";
import { STYLE_CONFIG } from "@/lib/generator-config";

const SITES_DIR = path.join(process.cwd(), "sites-data");
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
  const siteDir = path.join(SITES_DIR, siteId);
  await fs.mkdir(siteDir, { recursive: true });
  return siteDir;
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
  await copyDirectory(path.join(siteDir, "out"), targetDir);
  const draftPathname = new URL(getDraftPreviewUrl(siteId)).pathname;
  await rewriteExportAssetPaths(targetDir, "", draftPathname);
}

export async function publishDraftPreview(siteId: string): Promise<string> {
  if (!PREVIEW_PUBLISH_DIR) {
    return getLocalPreviewUrl(siteId);
  }
  const draftDir = getDraftPublishDir(siteId);

  // If draft preview directory doesn't exist, try to re-sync from site build output
  try {
    await fs.access(draftDir);
  } catch {
    const siteOutDir = path.join(SITES_DIR, siteId, "out");
    try {
      await fs.access(siteOutDir);
      await syncDraftPreview(siteId, path.join(SITES_DIR, siteId));
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
  if (!PREVIEW_PUBLISH_DIR) return;
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
    exec("npm install --prefer-offline --package-lock=false", { cwd, timeout: 120_000 }, (err) => {
      if (err) reject(err);
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

async function ensureStaticServer(): Promise<void> {
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

        const healthMatch = rawUrl.match(/^\/([^/]+)\/__health$/);
        if (healthMatch) {
          const siteId = healthMatch[1];
          const indexFile = path.join(SITES_DIR, siteId, "out", "index.html");
          try {
            const html = await fs.readFile(indexFile, "utf-8");
            res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
            res.end(JSON.stringify({ ok: html.trim().length > 0, siteId }));
          } catch {
            res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
            res.end(JSON.stringify({ ok: false, siteId }));
          }
          return;
        }

        const parts = rawUrl.split("/").filter(Boolean);
        if (parts.length === 0) { res.writeHead(404); res.end("Not Found"); return; }

        const siteId = parts[0];
        let filePath = "/" + parts.slice(1).join("/");
        if (filePath === "/") filePath = "/index.html";
        if (!path.extname(filePath)) filePath += ".html";

        const outDir = path.join(SITES_DIR, siteId, "out");
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
            const index = await fs.readFile(path.join(SITES_DIR, parts[0], "out", "index.html"));
            res.writeHead(200, { "Content-Type": "text/html", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store, must-revalidate" });
            res.end(index);
            return;
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
  userId?: string;
  data: WorkspaceData;
  selections: UserSelections;
  spec?: import("./site-spec").SiteSpec | null;
  previewBaseUrl: string;
  knowledgeBaseId?: string;
  knowledgeBaseIds?: string[];
  requestId: string;
  onProgress?: (step: string) => Promise<void>;
}

export interface RunSiteBuildResult {
  url: string;
  fileMap: Record<string, string>;
  verification: { ok: boolean; checks: Array<{ label: string; ok: boolean }> };
  previewReachable: boolean;
}

// ---- KB → WorkspaceData enrichment (AI-powered) ----

/**
 * Use lightweight AI to extract structured data from KB content.
 * Falls back to regex if AI call fails.
 */
async function enrichWorkspaceDataFromKB(data: WorkspaceData, kbContent: string, userId?: string): Promise<Partial<WorkspaceData>> {
  const text = kbContent.slice(0, 40000);

  // Try AI extraction first
  try {
    const { chatCompletion } = await import("./llm");
    const result = await chatCompletion({
      requestId: "kb-extract",
      label: "kb-content-extract",
      userId,
      systemPrompt: `You extract structured personal/portfolio data from text. Output ONLY valid JSON, no markdown fences. The JSON must match this exact schema:
{
  "name": "person's full name (original language)",
  "nameEn": "person's name in English (transliterate if Chinese)",
  "title": "job title (original language)",
  "titleEn": "job title in English",
  "email": "email address or empty string",
  "bio": "1-3 sentence personal introduction (original language)",
  "bioEn": "same bio translated to English",
  "tags": ["3-5 skill/role tags in English"],
  "skills": [{"title": "category name", "skills": ["skill1", "skill2"]}],
  "projects": [{"title": "project name", "desc": "1-2 sentence description", "tags": ["tech tags"], "org": "company/org", "link": "", "role": "role in project", "period": "time period", "highlights": ["achievement 1", "achievement 2"], "detail": "full project description"}],
  "experience": [{"title": "job title", "org": "company", "period": "date range", "desc": "role description", "highlights": ["responsibility or achievement"], "current": false}],
  "education": [{"school": "school name", "degree": "degree", "period": "years", "highlights": []}],
  "awards": [{"title": "award name", "org": "awarding body", "year": "year", "description": "what for"}],
  "links": [{"label": "display text", "url": "full URL"}]
}
Include ONLY fields that exist in the source text. Keep arrays empty if no data found.
IMPORTANT: For "name", "title", "bio" — provide BOTH original language AND English versions (nameEn, titleEn, bioEn). If source is already English, both versions can be the same.`,
      userPrompt: text,
      temperature: 0.1,
      maxTokens: 4096,
    });

    const jsonStr = result.content.replace(/```json\s*\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    const enriched: Partial<WorkspaceData> = {};
    if (parsed.name && parsed.name !== data.name) { enriched.name = parsed.name; enriched.nameEn = parsed.nameEn || parsed.name; }
    if (parsed.title) { enriched.title = parsed.title; enriched.titleEn = parsed.titleEn || parsed.title; }
    if (parsed.email) enriched.email = parsed.email;
    if (parsed.bio) { enriched.bio = parsed.bio; enriched.bioEn = parsed.bioEn || parsed.bio; }
    if (Array.isArray(parsed.tags) && parsed.tags.length > 0) enriched.tags = parsed.tags;
    if (Array.isArray(parsed.skills) && parsed.skills.length > 0) {
      enriched.skills = parsed.skills.map((g: { title?: string; skills?: string[] }) => ({
        title: g.title || "Skills",
        skills: Array.isArray(g.skills) ? g.skills : [],
      }));
    }
    if (Array.isArray(parsed.projects) && parsed.projects.length > 0) {
      enriched.projects = parsed.projects.map((p: Record<string, unknown>) => ({
        title: String(p.title || ""),
        desc: String(p.desc || ""),
        tags: Array.isArray(p.tags) ? p.tags : [],
        org: String(p.org || ""),
        link: String(p.link || ""),
        image: "",
        badge: "",
      }));
      // Also create timeline entries from projects with role/period
      enriched.timeline = parsed.projects
        .filter((p: Record<string, unknown>) => p.role || p.period)
        .map((p: Record<string, unknown>) => ({
          title: String(p.role || p.title || ""),
          desc: String(p.desc || ""),
          date: String(p.period || ""),
          active: false,
        }));
    }
    if (Array.isArray(parsed.experience) && parsed.experience.length > 0) {
      enriched.timeline = parsed.experience.map((e: Record<string, unknown>) => ({
        title: String(e.title || ""),
        desc: String(e.desc || ""),
        date: String(e.period || ""),
        active: Boolean(e.current),
      }));
    }
    if (Array.isArray(parsed.education) && parsed.education.length > 0) {
      enriched.education = parsed.education.map((e: Record<string, unknown>) => ({
        school: String(e.school || ""),
        degree: String(e.degree || ""),
        highlights: Array.isArray(e.highlights) ? e.highlights : [],
      }));
    }
    if (Array.isArray(parsed.links) && parsed.links.length > 0) {
      enriched.links = parsed.links.map((l: Record<string, unknown>) => ({
        label: String(l.label || ""),
        url: String(l.url || ""),
        icon: "other",
      }));
    }

    return enriched;
  } catch (err) {
    logger.warn("generate", `AI KB extraction failed, using regex fallback: ${err instanceof Error ? err.message : "unknown"}`);
  }

  // Regex fallback
  return regexEnrichWorkspaceData(text);
}

/** Regex-based fallback for KB extraction when AI is unavailable */
function regexEnrichWorkspaceData(text: string): Partial<WorkspaceData> {
  const result: Partial<WorkspaceData> = {};

  const namePatterns = [
    /(?:姓名|名字|Name)[：:\s]*([^\n,，。.]{2,20})/i,
    /^#\s+(.{2,20})$/m,
    /(?:我是|I am|I'm)\s+([^\n,，。.]{2,20})/i,
  ];
  for (const p of namePatterns) {
    const m = text.match(p);
    if (m && m[1].trim().length >= 2) { result.name = m[1].trim(); result.nameEn = result.name; break; }
  }

  const titlePatterns = [/(?:职位|职业|Title|Role|Position)[：:\s]*([^\n,，]{2,40})/i];
  for (const p of titlePatterns) {
    const m = text.match(p);
    if (m) { result.title = m[1].trim(); result.titleEn = result.title; break; }
  }

  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
  if (emailMatch) result.email = emailMatch[0];

  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 50 && !p.trim().startsWith("#"));
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
  const t = {
    nav: { projects: "项目", experience: "经历", skills: "技能", education: "教育", contact: "联系", posts: "文章", awards: "荣誉", publications: "论文" },
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
    awards: [] as Array<{ title: string; org: string; year: string; description: string }>,
    publications: [] as Array<{ title: string; authors: string; venue: string; year: string; abstract: string; url: string }>,
    media: [] as Array<{ type: string; title: string; platform: string; url: string; date: string; description: string }>,
    demos: [] as Array<{ title: string; description: string; url: string; screenshot: string; techStack: string[] }>,
    contact: { email: p.email || "", links: (p.links || []).map(l => ({ type: "website", label: l.label, url: l.url, icon: l.icon || "other" })) },
    footer: `© ${new Date().getFullYear()} ${p.name}`,
    chatbot: { title: `${p.name} AI`, subtitle: "有什么想问的？", welcome: `你好！可以问我关于${p.name}的经历和技能。`, placeholder: "输入你的问题...", send: "发送", tooltip: "AI 对话", suggestions: p.projects.length > 0 ? [`介绍一下「${p.projects[0].title}」`, "你有哪些核心技能？", "你现在接受合作吗？"] : ["你是做什么的？", "介绍一下你的经历", "你有哪些技能？"] },
    share: { button: "分享", title: "分享", invite: `欢迎了解 ${p.name}`, desc: "个人网站", save: "保存", copy: "复制链接", copied: "已复制！" },
    availableSections: ["about", ...(p.projects.length > 0 ? ["projects"] : []), ...(p.timeline.length > 0 ? ["experience"] : []), ...(p.skills.length > 0 ? ["skills"] : []), ...(p.education.length > 0 ? ["education"] : []), "contact"],
    posts: [] as Array<{ title: string; slug: string; excerpt: string; content: string; category: string; tags: string[]; image: string; publishedAt: string; readingTime: string }>,
    links: (p.links || []).map(l => ({ label: l.label, url: l.url, icon: l.icon || "other" })),
  };
  const en = {
    ...JSON.parse(JSON.stringify(t)),
    nav: { projects: "Projects", experience: "Experience", skills: "Skills", education: "Education", contact: "Contact", posts: "Posts", awards: "Awards", publications: "Publications" },
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
  const progress = async (step: string) => { if (onProgress) await onProgress(step).catch(() => {}); };

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
            parts.push(`## KB: ${kbCtx.indexContent.split("\\n")[0] || bid}\n${kbCtx.indexContent}\n\n${formatFilesForPrompt(kbCtx.fileContents, Math.floor(60000 / allBaseIds.length))}`);
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
    repairCtx = { codeCtx, designPlan, assetCss };

    const codeResult = await runCodeAgent(codeCtx, designPlan, assetCss);

    // Enrich WorkspaceData from KB content when legacy items are empty
    if (kbContent && (!data.name || data.name === "Your Name" || data.name === "")) {
      const enriched = await enrichWorkspaceDataFromKB(data, kbContent, input.userId);
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
  files = runCodeGuardrails(files, siteId, previewBaseUrl, logger);

  // Advanced mode deep validation: type annotations, import resolution, translation keys
  await progress("🔍 验证生成代码...");
  const advancedFixes = runAdvancedModeGuardrails(files, ALLOWED_DEPENDENCIES, logger);
  if (advancedFixes.length > 0) {
    await progress(`✅ 代码验证：${advancedFixes.length} 项自动修复`);
  } else {
    await progress("✅ 代码验证通过");
  }

  const fileCount = Object.keys(files).length;
  await progress(`📄 写入 ${fileCount} 个文件`);
  const siteDir = await ensureSiteDir(siteId);
  await writeFilesToSiteDir(siteDir, files);

  // Copy user's uploaded images into the site's public/images/
  if (input.userId) {
    const imgCount = await copyUserImagesToSite(input.userId, siteDir);
    if (imgCount > 0) logger.info("generate", `[${requestId}] Copied ${imgCount} user images to site`);
  }

  await progress("📦 准备依赖...");
  await ensureNodeModules(siteDir);

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

      const canRetry = repairCtx && buildAttempt < MAX_BUILD_RETRIES;
      if (!canRetry) {
        // Preserve stdout/stderr on the error so build-queue can persist them.
        throw err;
      }

      buildAttempt++;
      await progress(`⚠️ 构建失败，重新生成代码 (${buildAttempt}/${MAX_BUILD_RETRIES})...`);

      const prevPage = files["src/app/page.tsx"] || "";
      const prevCss = files["src/app/globals.css"] || "";

      const { runCodeAgent: runCodeAgentRetry } = await import("./build-agents");
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
        );
      } catch (repairErr) {
        logger.error(
          "generate",
          `[${requestId}] Repair Code Agent call failed on attempt ${buildAttempt}: ${repairErr instanceof Error ? repairErr.message : String(repairErr)}`,
        );
        // Fall back to re-throwing the original build error — the repair
        // itself crashed, nothing useful to retry with.
        throw err;
      }

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
      files = runCodeGuardrails(files, siteId, previewBaseUrl, logger);
      runAdvancedModeGuardrails(files, ALLOWED_DEPENDENCIES, logger);
      await writeFilesToSiteDir(siteDir, files);
      // Loop continues; next iteration will re-attempt staticBuild.
    }
  }

  if (!PREVIEW_PUBLISH_DIR) {
    await rewriteExportAssetPaths(path.join(siteDir, "out"), "", `/${siteId}`);
  }

  await progress("📋 检查构建产物...");
  await assertPreviewArtifacts(siteDir, siteId);

  await progress("🚀 发布预览...");
  if (PREVIEW_PUBLISH_DIR) {
    await syncDraftPreview(siteId, siteDir);
  } else {
    await ensureStaticServer();
  }

  const url = PREVIEW_PUBLISH_DIR
    ? getDraftPreviewUrl(siteId, previewBaseUrl)
    : `${previewBaseUrl.replace(/\/+$/, "")}/${siteId}`;
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
