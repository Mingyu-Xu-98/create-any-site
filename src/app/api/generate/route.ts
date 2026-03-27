import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { generateFileMap } from "@/lib/generator";
import { queryDesignIntelligence } from "@/lib/design-intelligence";
import { isTemplateStyle, generateFromTemplate } from "@/lib/template-generator";
import type { WorkspaceData, UserSelections } from "@/lib/types";
import { logger } from "@/lib/logger";
import http from "http";

const SITES_DIR = path.join(process.cwd(), "sites-data");
const SHARED_MODULES = path.join(SITES_DIR, "_shared_node_modules");
const PREVIEW_PORT = 3002;
const REQUIRED_SHARED_PACKAGES = ["next", "react", "react-dom", "qrcode", "dijkstrajs", "pngjs"];

// Static file server for preview (serves ALL sites via /siteId/ prefix)
let staticServer: http.Server | null = null;

async function ensureSiteDir(siteId: string): Promise<string> {
  const siteDir = path.join(SITES_DIR, siteId);
  await fs.mkdir(siteDir, { recursive: true });
  return siteDir;
}

async function writeFilesToSiteDir(siteDir: string, files: Record<string, string>) {
  const srcDir = path.join(siteDir, "src");
  await fs.rm(srcDir, { recursive: true, force: true });
  let count = 0;
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(siteDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
    count++;
  }
  return count;
}

async function ensureNodeModules(siteDir: string) {
  const nmPath = path.join(siteDir, "node_modules");
  try {
    const stat = await fs.lstat(nmPath);
    if (stat.isSymbolicLink() || stat.isDirectory()) return;
  } catch { /* Doesn't exist */ }

  async function installIntoSiteDir() {
    await new Promise<void>((resolve, reject) => {
      exec("npm install", { cwd: siteDir, timeout: 120_000 }, (err) => { if (err) reject(err); else resolve(); });
    });
  }

  try { await fs.access(SHARED_MODULES); } catch {
    logger.info("generate", "Installing shared node_modules (first time)...");
    await fs.mkdir(path.dirname(SHARED_MODULES), { recursive: true });
    await installIntoSiteDir();
    await fs.rename(path.join(siteDir, "node_modules"), SHARED_MODULES);
  }

  try {
    await fs.symlink(SHARED_MODULES, nmPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "EEXIST") throw err;
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

  logger.info("generate", "Symlinked node_modules");
}

// Static build: next build with static export
async function staticBuild(siteDir: string): Promise<void> {
  logger.info("generate", "Running next build (static export)...");

  const configContent = `const nextConfig = { output: "export", images: { unoptimized: true } };
export default nextConfig;`;

  // Clean up any old config files
  for (const old of ["next.config.js", "next.config.ts", "next.config.cjs"]) {
    try { await fs.unlink(path.join(siteDir, old)); } catch {}
  }
  await fs.writeFile(path.join(siteDir, "next.config.mjs"), configContent, "utf-8");

  // Use the site's own node_modules next binary to avoid version mismatch
  // (npx may resolve to a different global/parent version)
  const nextBin = path.join(siteDir, "node_modules", ".bin", "next");
  const buildEnv = { ...process.env, NODE_ENV: "production" } as NodeJS.ProcessEnv;
  delete buildEnv.TURBOPACK;
  delete buildEnv.NEXT_DISABLE_TURBOPACK;

  return new Promise((resolve, reject) => {
    exec(`"${nextBin}" build --webpack`, {
        cwd: siteDir,
        timeout: 180_000,
        env: buildEnv,
      }, (err, stdout, stderr) => {
        if (err) {
          logger.error("generate", `Static build failed: ${err.message}`, { stderr: stderr?.slice(0, 500) });
          reject(Object.assign(err, { stderr, stdout }));
        } else {
          logger.info("generate", "Static build complete");
          resolve();
        }
      });
  });
}

function summarizeBuildOutput(stdout: string, stderr: string): string[] {
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

function getPreviewBaseUrl(req: NextRequest): string {
  const configured = process.env.PREVIEW_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const hostHeader = forwardedHost || req.headers.get("host") || req.nextUrl.host;
  const protocol = forwardedProto || req.nextUrl.protocol.replace(":", "") || "http";
  const hostname = hostHeader.replace(/:\d+$/, "");
  return `${protocol}://${hostname}:${PREVIEW_PORT}`;
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

  return {
    ok: checks.every(check => check.ok),
    checks,
  };
}

async function assertPreviewArtifacts(siteDir: string, siteId: string): Promise<void> {
  const outDir = path.join(siteDir, "out");
  const indexFile = path.join(outDir, "index.html");

  try {
    await fs.access(outDir);
  } catch {
    throw new Error(`Preview output directory missing for site ${siteId}`);
  }

  try {
    const html = await fs.readFile(indexFile, "utf-8");
    if (!html.trim()) {
      throw new Error(`Preview index is empty for site ${siteId}`);
    }
  } catch (err) {
    if (err instanceof Error && /Preview index is empty/.test(err.message)) throw err;
    throw new Error(`Preview index.html missing for site ${siteId}`);
  }
}

async function probePreviewUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/__health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html", ".css": "text/css", ".js": "application/javascript",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2",
  ".woff": "font/woff", ".ttf": "font/ttf", ".txt": "text/plain",
};

// Start static server that serves ALL sites via /siteId/ path prefix
function ensureStaticServer(): Promise<void> {
  return new Promise((resolve) => {
    if (staticServer) { resolve(); return; }

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

        // URL format: /siteId/path... → serve from sites-data/siteId/out/path
        const parts = rawUrl.split("/").filter(Boolean);
        if (parts.length === 0) { res.writeHead(404); res.end("Not Found"); return; }

        const siteId = parts[0];
        let filePath = "/" + parts.slice(1).join("/");
        if (filePath === "/") filePath = "/index.html";
        if (!path.extname(filePath)) filePath += ".html";

        const outDir = path.join(SITES_DIR, siteId, "out");
        const fullPath = path.join(outDir, filePath);

        // Security: prevent path traversal
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
        // Try SPA fallback
        try {
          const parts = decodeURIComponent((req.url || "/").split("?")[0]).split("/").filter(Boolean);
          if (parts.length > 0) {
            const index = await fs.readFile(path.join(SITES_DIR, parts[0], "out", "index.html"));
            res.writeHead(200, { "Content-Type": "text/html", "Access-Control-Allow-Origin": "*" });
            res.end(index);
            return;
          }
        } catch {}
        res.writeHead(404); res.end("Not Found");
      }
    });

    server.listen(PREVIEW_PORT, () => {
      staticServer = server;
      logger.info("generate", `Static server started on port ${PREVIEW_PORT} (multi-site)`);
      resolve();
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        logger.info("generate", `Port ${PREVIEW_PORT} already in use, reusing`);
        resolve();
      }
    });
  });
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { data, selections, siteId: inputSiteId, spec } = body as {
      data: WorkspaceData; selections: UserSelections; siteId?: string; prd?: unknown; spec?: { sections?: Array<{ id?: string; type?: string; enabled?: boolean }> };
    };

    const siteId = inputSiteId || crypto.randomUUID();
    logger.info("generate", `[${requestId}] Generate for site ${siteId}`, {
      name: data.name, siteType: selections.siteType, theme: selections.theme,
    });

    // 1. Generate files
    let files: Record<string, string>;
    if (isTemplateStyle(selections.theme)) {
      files = await generateFromTemplate(data, selections);
    } else {
      const designIntel = await queryDesignIntelligence(
        selections.siteType || "portfolio", selections.theme || "minimalist",
        selections.customTheme || undefined,
      );
      files = generateFileMap(data, selections, designIntel, spec);
    }

    logger.info("generate", `[${requestId}] Generated ${Object.keys(files).length} files`);

    // 2. Patch tsconfig
    if (files["tsconfig.json"]) {
      try {
        const tsconfig = JSON.parse(files["tsconfig.json"]);
        tsconfig.compilerOptions = tsconfig.compilerOptions || {};
        tsconfig.compilerOptions.skipLibCheck = true;
        files["tsconfig.json"] = JSON.stringify(tsconfig, null, 2);
      } catch {}
    }

    // 3. Write files
    const siteDir = await ensureSiteDir(siteId);
    const count = await writeFilesToSiteDir(siteDir, files);
    logger.info("generate", `[${requestId}] Wrote ${count} files to ${siteDir}`);

    // 3.5. Copy .env.local
    try { await fs.copyFile(path.join(process.cwd(), ".env.local"), path.join(siteDir, ".env.local")); } catch {}

    // 4. Ensure node_modules
    await ensureNodeModules(siteDir);

    // 5. Static build (next build → out/)
    await staticBuild(siteDir);
    await assertPreviewArtifacts(siteDir, siteId);

    // 6. Ensure static server is running and return site-specific URL
    await ensureStaticServer();
    const previewBaseUrl = getPreviewBaseUrl(req);
    const url = `${previewBaseUrl}/${siteId}`;
    const verification = await runVerification(siteDir, files, spec);
    const previewReachable = await probePreviewUrl(url);
    if (!previewReachable) {
      logger.warn("generate", `[${requestId}] Preview probe failed after successful build`, { url, siteId });
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info("generate", `[${requestId}] Complete in ${elapsed}s (static export)`, { url, fileCount: Object.keys(files).length, previewReachable });

    return NextResponse.json({ url, port: PREVIEW_PORT, fileMap: files, siteId, verification, previewReachable });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Extract useful build error details
    const stdout = (err as { stdout?: string })?.stdout || "";
    const stderr = (err as { stderr?: string })?.stderr || "";
    const buildHint = stderr.includes("Module not found") ? "Missing module: " + (stderr.match(/Module not found.*'([^']+)'/)?.[1] || "unknown")
      : stderr.includes("Type error") ? "TypeScript error in generated code"
      : stderr.includes("SyntaxError") ? "Syntax error in generated code"
      : "";
    const logLines = summarizeBuildOutput(stdout, stderr);
    logger.error("generate", `[${requestId}] Failed: ${message}`, { buildHint, stderr: stderr.slice(0, 300) });
    return NextResponse.json({ error: buildHint || message, logs: logLines }, { status: 500 });
  }
}
