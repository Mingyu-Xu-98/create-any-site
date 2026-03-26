import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { spawn, exec } from "child_process";
import { generateFileMap } from "@/lib/generator";
import { queryDesignIntelligence } from "@/lib/design-intelligence";
import { isTemplateStyle, generateFromTemplate } from "@/lib/template-generator";
import type { WorkspaceData, UserSelections } from "@/lib/types";
import { logger } from "@/lib/logger";

const SITES_DIR = path.join(process.cwd(), "sites-data");
const OUTPUT_DIR = path.join(process.cwd(), "output"); // Active preview symlink target
const PREVIEW_PORT = 3002;
const SHARED_MODULES = path.join(process.cwd(), "sites-data", "_shared_node_modules");

let devServerStarted = false;

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
    if (stat.isSymbolicLink() || stat.isDirectory()) return; // Already exists
  } catch { /* Doesn't exist */ }

  // Ensure shared node_modules exist
  const sharedNm = SHARED_MODULES;
  try {
    await fs.access(sharedNm);
  } catch {
    // First time: install to shared location
    logger.info("generate", "Installing shared node_modules (first time)...");
    await fs.mkdir(path.dirname(sharedNm), { recursive: true });
    // Install in site dir first, then move
    await new Promise<void>((resolve, reject) => {
      exec("npm install", { cwd: siteDir, timeout: 120_000 }, (err) => {
        if (err) reject(err); else resolve();
      });
    });
    await fs.rename(path.join(siteDir, "node_modules"), sharedNm);
  }

  // Symlink from site dir to shared
  await fs.symlink(sharedNm, nmPath);
  logger.info("generate", `Symlinked node_modules for site`);
}

async function activateSiteForPreview(siteDir: string) {
  // Make output/ point to the active site's directory
  try { await fs.rm(OUTPUT_DIR, { recursive: false }); } catch { /* might not exist or not a symlink */ }
  try { await fs.unlink(OUTPUT_DIR); } catch { /* not a symlink */ }

  // Copy approach (more reliable than symlink for Next.js)
  // Use symlink for the directory
  try {
    await fs.symlink(siteDir, OUTPUT_DIR);
    logger.info("generate", `Activated site for preview: ${siteDir}`);
  } catch {
    // Fallback: if symlink fails (e.g., output/ is a real directory), remove and retry
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
    await fs.symlink(siteDir, OUTPUT_DIR);
  }
}

async function startDevServer() {
  if (devServerStarted) {
    logger.info("generate", "Dev server already running (flag), skipping start");
    return;
  }

  try {
    const check = await fetch(`http://localhost:${PREVIEW_PORT}`, { signal: AbortSignal.timeout(1000) });
    if (check) {
      logger.info("generate", `Port ${PREVIEW_PORT} already responding, skipping start`);
      devServerStarted = true;
      return;
    }
  } catch { /* Port not in use */ }

  devServerStarted = true;
  logger.info("generate", `Starting dev server on port ${PREVIEW_PORT}`);
  const child = spawn("npx", ["next", "dev", "--port", String(PREVIEW_PORT)], {
    cwd: OUTPUT_DIR,
    stdio: "ignore",
    detached: true,
    env: { ...process.env, NODE_ENV: "development" },
  });
  child.unref();
  logger.info("generate", `Dev server process spawned (pid: ${child.pid})`);
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { data, selections, siteId: inputSiteId } = body as {
      data: WorkspaceData;
      selections: UserSelections;
      siteId?: string;
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
        selections.siteType || "portfolio",
        selections.theme || "minimalist",
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

    // 3. Write to site-specific directory
    const siteDir = await ensureSiteDir(siteId);
    const count = await writeFilesToSiteDir(siteDir, files);
    logger.info("generate", `[${requestId}] Wrote ${count} files to ${siteDir}`);

    // 3.5. Copy .env.local
    try {
      await fs.copyFile(path.join(process.cwd(), ".env.local"), path.join(siteDir, ".env.local"));
    } catch {}

    // 4. Ensure node_modules (shared symlink)
    await ensureNodeModules(siteDir);

    // 5. Activate this site for preview
    await activateSiteForPreview(siteDir);

    // 6. Start dev server
    await startDevServer();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const url = `http://localhost:${PREVIEW_PORT}`;
    logger.info("generate", `[${requestId}] Complete in ${elapsed}s`, { url, fileCount: Object.keys(files).length });

    return NextResponse.json({ url, port: PREVIEW_PORT, fileMap: files, siteId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("generate", `[${requestId}] Failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
