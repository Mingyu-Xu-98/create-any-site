import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { logger } from "@/lib/logger";

const SITES_DIR = path.join(process.cwd(), "sites-data");

interface FileChange {
  file: string;
  action: "replace" | "create" | "delete";
  content?: string;
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { siteId, changes } = await req.json() as { siteId: string; changes: FileChange[] };
    if (!siteId || !Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json({ error: "siteId and changes required" }, { status: 400 });
    }

    logger.info("modify", `[${requestId}] Modifying site ${siteId}: ${changes.length} changes`);

    // Load current fileMap from DB
    const site = await db.select({ fileMap: sites.fileMap }).from(sites)
      .where(and(eq(sites.id, siteId), eq(sites.userId, session.user.id))).get();

    let fileMap: Record<string, string> = {};
    if (site?.fileMap) {
      try { fileMap = JSON.parse(site.fileMap); } catch {}
    }

    const siteDir = path.join(SITES_DIR, siteId);

    // Apply each change
    const applied: string[] = [];
    for (const change of changes) {
      const filePath = change.file;
      const fullPath = path.join(siteDir, filePath);

      if (change.action === "delete") {
        delete fileMap[filePath];
        try { await fs.unlink(fullPath); } catch {}
        applied.push(`deleted: ${filePath}`);
      } else if (change.action === "replace" || change.action === "create") {
        if (!change.content) continue;
        fileMap[filePath] = change.content;
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, change.content, "utf-8");
        applied.push(`${change.action}: ${filePath}`);
      }
    }

    // Save updated fileMap back to DB
    await db.update(sites).set({
      fileMap: JSON.stringify(fileMap),
      updatedAt: new Date().toISOString(),
    }).where(eq(sites.id, siteId));

    logger.info("modify", `[${requestId}] Applied ${applied.length} changes, rebuilding...`, { applied });

    // Rebuild static export after modification
    try {
      await new Promise<void>((resolve, reject) => {
        exec("npx next build", { cwd: siteDir, timeout: 120_000, env: { ...process.env, NODE_ENV: "production" } }, (err) => {
          if (err) { logger.warn("modify", `Rebuild failed: ${err.message}`); reject(err); }
          else { logger.info("modify", "Rebuild complete"); resolve(); }
        });
      });
    } catch {
      // Non-fatal: files are saved, build can be retried
    }

    return NextResponse.json({ ok: true, applied });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error("modify", `[${requestId}] Failed: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
