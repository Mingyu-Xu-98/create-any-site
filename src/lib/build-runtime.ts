import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import http from "http";
import { generateFileMap } from "@/lib/generator";
import { queryDesignIntelligence } from "@/lib/design-intelligence";
import { isTemplateStyle, generateFromTemplate } from "@/lib/template-generator";
import type { WorkspaceData, UserSelections } from "@/lib/types";
import { logger } from "@/lib/logger";
import { getInstalledNextVersion } from "@/lib/next-version";
import { runCodeGuardrails } from "@/lib/code-guardrails";
import { copyUserImagesToSite } from "@/lib/asset-store";

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

async function rewriteExportAssetPaths(dir: string, fromPrefix: string, toPrefix: string): Promise<void> {
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
  await fs.access(draftDir);
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
      for (const section of spec.sections.filter(item => item.enabled !== false)) {
        const sectionId = section.id || section.type;
        if (!sectionId) continue;
        const anchorId = sectionId === "timeline" ? "experience" : sectionId;
        checks.push({
          label: `Rendered section anchor: ${sectionId}`,
          ok: html.includes(`id="${anchorId}"`) || html.includes(`id='${anchorId}'`) || html.includes(`#${anchorId}`),
        });
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

  if (warnings.length > 0) {
    logger.warn("generate", `[${siteId}] Post-build warnings: ${warnings.join("; ")}`);
  }
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
          "Cache-Control": "no-cache",
        });
        res.end(content);
      } catch {
        try {
          const parts = decodeURIComponent((req.url || "/").split("?")[0]).split("/").filter(Boolean);
          if (parts.length > 0) {
            const index = await fs.readFile(path.join(SITES_DIR, parts[0], "out", "index.html"));
            res.writeHead(200, { "Content-Type": "text/html", "Access-Control-Allow-Origin": "*" });
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
  requestId: string;
}

export interface RunSiteBuildResult {
  url: string;
  fileMap: Record<string, string>;
  verification: { ok: boolean; checks: Array<{ label: string; ok: boolean }> };
  previewReachable: boolean;
}

export async function runSiteBuild(input: RunSiteBuildInput): Promise<RunSiteBuildResult> {
  const { siteId, data, selections, spec, previewBaseUrl, requestId } = input;

  logger.info("generate", `[${requestId}] Generate for site ${siteId}`, {
    name: data.name,
    siteType: selections.siteType,
    theme: selections.theme,
  });

  let files: Record<string, string>;
  if (isTemplateStyle(selections.theme)) {
    files = await generateFromTemplate(data, selections);
  } else {
    const designIntel = await queryDesignIntelligence(
      selections.siteType || "portfolio",
      selections.theme || "cyberpunk",
      selections.customTheme || undefined,
    );
    files = generateFileMap(data, selections, designIntel, spec || undefined);
  }

  if (files["tsconfig.json"]) {
    try {
      const tsconfig = JSON.parse(files["tsconfig.json"]);
      tsconfig.compilerOptions = tsconfig.compilerOptions || {};
      tsconfig.compilerOptions.skipLibCheck = true;
      files["tsconfig.json"] = JSON.stringify(tsconfig, null, 2);
    } catch {}
  }

  // Auto-fix common issues in generated code before writing to disk
  files = runCodeGuardrails(files, siteId, previewBaseUrl, logger);

  const siteDir = await ensureSiteDir(siteId);
  await writeFilesToSiteDir(siteDir, files);

  // Copy user's uploaded images into the site's public/images/
  if (input.userId) {
    const imgCount = await copyUserImagesToSite(input.userId, siteDir);
    if (imgCount > 0) logger.info("generate", `[${requestId}] Copied ${imgCount} user images to site`);
  }

  await ensureNodeModules(siteDir);
  await staticBuild(siteDir);
  if (!PREVIEW_PUBLISH_DIR) {
    await rewriteExportAssetPaths(path.join(siteDir, "out"), "", `/${siteId}`);
  }
  await assertPreviewArtifacts(siteDir, siteId);

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

  return { url, fileMap: files, verification, previewReachable };
}
