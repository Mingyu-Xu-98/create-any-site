import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { spawn, exec } from "child_process";
import { generateFileMap } from "@/lib/generator";
import { queryDesignIntelligence } from "@/lib/design-intelligence";
import { isTemplateStyle, generateFromTemplate } from "@/lib/template-generator";
import type { WorkspaceData, UserSelections } from "@/lib/types";
import { logger } from "@/lib/logger";

const OUTPUT_DIR = path.join(process.cwd(), "output");
const PREVIEW_PORT = 3001;

let devServerStarted = false;

async function writeFilesToDisk(files: Record<string, string>) {
  const srcDir = path.join(OUTPUT_DIR, "src");
  await fs.rm(srcDir, { recursive: true, force: true });

  let count = 0;
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(OUTPUT_DIR, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
    count++;
  }
  logger.info("generate", `Wrote ${count} files to disk`);
}

function npmInstall(): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info("generate", "Running npm install...");
    exec("npm install", { cwd: OUTPUT_DIR, timeout: 120_000 }, (err, stdout, stderr) => {
      if (err) {
        logger.error("generate", "npm install failed", { error: err.message, stderr: stderr?.slice(0, 500) });
        reject(err);
      } else {
        logger.info("generate", "npm install complete");
        resolve();
      }
    });
  });
}

function startDevServer() {
  if (devServerStarted) {
    logger.info("generate", "Dev server already running, skipping start");
    return;
  }
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
    const { data, selections } = (await req.json()) as {
      data: WorkspaceData;
      selections: UserSelections;
    };

    logger.info("generate", `[${requestId}] Generate request received`, {
      name: data.name,
      siteType: selections.siteType,
      theme: selections.theme,
      layout: selections.layout,
    });

    // 1. Generate files
    let files: Record<string, string>;

    if (isTemplateStyle(selections.theme)) {
      logger.info("generate", `[${requestId}] Using template-based generation: ${selections.theme}`);
      files = await generateFromTemplate(data, selections);
    } else {
      logger.info("generate", `[${requestId}] Using standard generation with design intelligence`);
      const designIntel = await queryDesignIntelligence(
        selections.siteType || "portfolio",
        selections.theme || "minimalist",
        selections.customTheme || undefined,
      );
      logger.info("generate", `[${requestId}] Design intelligence loaded`);
      files = generateFileMap(data, selections, designIntel);
    }

    logger.info("generate", `[${requestId}] Generated ${Object.keys(files).length} files`);

    // 2. Fix tsconfig to skip type checking for problematic modules
    if (files["tsconfig.json"]) {
      try {
        const tsconfig = JSON.parse(files["tsconfig.json"]);
        tsconfig.compilerOptions = tsconfig.compilerOptions || {};
        tsconfig.compilerOptions.skipLibCheck = true;
        files["tsconfig.json"] = JSON.stringify(tsconfig, null, 2);
        logger.info("generate", `[${requestId}] Patched tsconfig.json: skipLibCheck=true`);
      } catch {
        logger.warn("generate", `[${requestId}] Could not patch tsconfig.json`);
      }
    }

    // 3. Write to disk
    await writeFilesToDisk(files);

    // 3.5. Copy .env.local
    const envSrc = path.join(process.cwd(), ".env.local");
    const envDst = path.join(OUTPUT_DIR, ".env.local");
    try {
      await fs.copyFile(envSrc, envDst);
      logger.info("generate", `[${requestId}] Copied .env.local to output`);
    } catch {
      logger.warn("generate", `[${requestId}] No .env.local to copy`);
    }

    // 4. npm install
    await npmInstall();

    // 5. Start dev server
    startDevServer();

    // 6. Return the preview URL
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const url = `http://localhost:${PREVIEW_PORT}`;
    logger.info("generate", `[${requestId}] Generation complete in ${elapsed}s`, { url });

    return NextResponse.json({ url, port: PREVIEW_PORT });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.error("generate", `[${requestId}] Generation failed after ${elapsed}s: ${message}`, {
      stack: err instanceof Error ? err.stack?.split("\n").slice(0, 3) : undefined,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
