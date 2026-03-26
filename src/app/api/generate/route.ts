import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { exec, spawn } from "child_process";
import { generateFileMap } from "@/lib/generator";
import { queryDesignIntelligence } from "@/lib/design-intelligence";
import { isTemplateStyle, generateFromTemplate } from "@/lib/template-generator";
import type { WorkspaceData, UserSelections } from "@/lib/types";
import { logger } from "@/lib/logger";
import http from "http";

const SITES_DIR = path.join(process.cwd(), "sites-data");
const SHARED_MODULES = path.join(SITES_DIR, "_shared_node_modules");
const PREVIEW_PORT = 3002;

// Static file server for preview
let staticServer: http.Server | null = null;
let currentServingDir = "";

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

  try { await fs.access(SHARED_MODULES); } catch {
    logger.info("generate", "Installing shared node_modules (first time)...");
    await fs.mkdir(path.dirname(SHARED_MODULES), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      exec("npm install", { cwd: siteDir, timeout: 120_000 }, (err) => { if (err) reject(err); else resolve(); });
    });
    await fs.rename(path.join(siteDir, "node_modules"), SHARED_MODULES);
  }

  await fs.symlink(SHARED_MODULES, nmPath);
  logger.info("generate", "Symlinked node_modules");
}

// Static build: next build with static export
function staticBuild(siteDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info("generate", "Running next build (static export)...");

    // Patch next.config to enable static export
    const configPath = path.join(siteDir, "next.config.ts");
    const configContent = `import type { NextConfig } from "next";
const nextConfig: NextConfig = { output: "export", images: { unoptimized: true } };
export default nextConfig;`;

    fs.writeFile(configPath, configContent, "utf-8").then(() => {
      exec("npx next build --no-turbopack", {
        cwd: siteDir,
        timeout: 180_000,
        env: { ...process.env, NODE_ENV: "production" },
      }, (err, stdout, stderr) => {
        if (err) {
          logger.error("generate", `Static build failed: ${err.message}`, { stderr: stderr?.slice(0, 500) });
          reject(err);
        } else {
          logger.info("generate", "Static build complete");
          resolve();
        }
      });
    });
  });
}

// Start/restart lightweight static file server
function startStaticServer(outDir: string): Promise<string> {
  return new Promise((resolve) => {
    if (currentServingDir === outDir && staticServer) {
      logger.info("generate", "Static server already serving this dir");
      resolve(`http://localhost:${PREVIEW_PORT}`);
      return;
    }

    // Close existing server
    if (staticServer) {
      staticServer.close();
      staticServer = null;
    }

    currentServingDir = outDir;

    const server = http.createServer(async (req, res) => {
      try {
        let urlPath = decodeURIComponent(req.url || "/");
        if (urlPath === "/") urlPath = "/index.html";
        if (!path.extname(urlPath)) urlPath += ".html";

        const filePath = path.join(currentServingDir, urlPath);

        // Security: prevent path traversal
        if (!filePath.startsWith(currentServingDir)) {
          res.writeHead(403); res.end("Forbidden"); return;
        }

        const content = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          ".html": "text/html", ".css": "text/css", ".js": "application/javascript",
          ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
          ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2",
          ".woff": "font/woff", ".ttf": "font/ttf", ".txt": "text/plain",
        };
        res.writeHead(200, {
          "Content-Type": mimeTypes[ext] || "application/octet-stream",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(content);
      } catch {
        // Try fallback to index.html (SPA)
        try {
          const index = await fs.readFile(path.join(currentServingDir, "index.html"));
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(index);
        } catch {
          res.writeHead(404);
          res.end("Not Found");
        }
      }
    });

    server.listen(PREVIEW_PORT, () => {
      staticServer = server;
      logger.info("generate", `Static server started on port ${PREVIEW_PORT}`);
      resolve(`http://localhost:${PREVIEW_PORT}`);
    });

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        logger.info("generate", `Port ${PREVIEW_PORT} in use, reusing`);
        resolve(`http://localhost:${PREVIEW_PORT}`);
      }
    });
  });
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { data, selections, siteId: inputSiteId } = body as {
      data: WorkspaceData; selections: UserSelections; siteId?: string;
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
      files = generateFileMap(data, selections, designIntel);
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

    // 6. Serve static files
    const outDir = path.join(siteDir, "out");
    const url = await startStaticServer(outDir);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info("generate", `[${requestId}] Complete in ${elapsed}s (static export)`, { url, fileCount: Object.keys(files).length });

    return NextResponse.json({ url, port: PREVIEW_PORT, fileMap: files, siteId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("generate", `[${requestId}] Failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
