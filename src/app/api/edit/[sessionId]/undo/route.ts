import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized } from "@/lib/require-auth";
import { internalError } from "@/lib/api-errors";
import { sqlite } from "@/lib/db";
import { db } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { syncDraftPreview, rewriteExportAssetPaths } from "@/lib/build-runtime";
import { resolveSiteDir } from "@/lib/site-paths";
import { runCodeGuardrails, runAdvancedModeGuardrails } from "@/lib/code-guardrails";
import { logger } from "@/lib/logger";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";

const ALLOWED_DEPENDENCIES = new Set(["next", "react", "react-dom"]);

/**
 * POST /api/edit/[sessionId]/undo — Undo an edit by restoring the pre-edit fileMap
 *
 * Reads the `file_map_before` snapshot from the edit session, restores it
 * to the site's fileMap, syncs files to disk, rebuilds, and updates the preview.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const userId = await requireAuth();
  if (!userId) return unauthorized();

  const { sessionId } = await params;

  try {
    // Get the edit session with fileMap snapshot
    const session = sqlite.prepare(
      `SELECT id, site_id, user_id, file_map_before, build_id_before, status
       FROM edit_sessions WHERE id = ? AND user_id = ?`
    ).get(sessionId, userId) as {
      id: string;
      site_id: string;
      user_id: string;
      file_map_before: string | null;
      build_id_before: string | null;
      status: string;
    } | undefined;

    if (!session) {
      return NextResponse.json({ error: "Edit session not found" }, { status: 404 });
    }

    if (!session.file_map_before) {
      return NextResponse.json({ error: "No snapshot available for undo (older edit session)" }, { status: 400 });
    }

    // Parse the pre-edit fileMap
    let restoredFileMap: Record<string, string>;
    try {
      restoredFileMap = JSON.parse(session.file_map_before);
    } catch {
      return NextResponse.json({ error: "Corrupted fileMap snapshot" }, { status: 500 });
    }

    const siteDir = await resolveSiteDir(session.site_id);

    // Run guardrails on restored fileMap (safety net)
    const previewBaseUrl = (process.env.PREVIEW_BASE_URL?.trim() || "http://localhost:3002").replace(/\/+$/, "");
    const guardedResult = runCodeGuardrails({ ...restoredFileMap }, session.site_id, previewBaseUrl, logger);
    const guardedFiles = guardedResult.files;
    runAdvancedModeGuardrails(guardedFiles, ALLOWED_DEPENDENCIES, logger);

    // Sync ALL files to disk (ensures no stale files from failed edits)
    for (const [filePath, content] of Object.entries(guardedFiles)) {
      const fullPath = path.join(siteDir, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, "utf-8");
    }

    // Rebuild
    await runUndoBuild(siteDir);

    // Rewrite asset paths for preview
    const PREVIEW_PUBLISH_DIR = process.env.PREVIEW_PUBLISH_DIR?.trim() || "";
    if (PREVIEW_PUBLISH_DIR) {
      await syncDraftPreview(session.site_id, siteDir);
    } else {
      await rewriteExportAssetPaths(path.join(siteDir, "out"), "", `/drafts/${session.site_id}`);
    }

    // Update site's fileMap in DB
    await db.update(sites)
      .set({
        fileMap: JSON.stringify(guardedFiles),
        buildStatus: "ready",
        buildError: null,
        draftBuildId: session.build_id_before,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(sites.id, session.site_id), eq(sites.userId, userId)));

    // Mark the undone session
    sqlite.prepare(
      `UPDATE edit_sessions SET status = 'undone' WHERE id = ?`
    ).run(sessionId);

    logger.info("edit-undo", `Reverted site ${session.site_id} to pre-edit state (session ${sessionId})`);

    return NextResponse.json({
      success: true,
      message: "已成功撤销编辑",
    });
  } catch (err) {
    logger.error("edit-undo", `Undo failed for session ${sessionId}: ${(err as Error).message}`);
    return internalError(err, "api-edit-undo");
  }
}

/** Run next build for undo — same config as edit-runtime's runNextBuild */
function runUndoBuild(siteDir: string): Promise<void> {
  const configContent = `const nextConfig = {
  output: "export",
  images: { unoptimized: true },
};
export default nextConfig;`;

  return new Promise(async (resolve, reject) => {
    try {
      for (const old of ["next.config.js", "next.config.ts", "next.config.cjs"]) {
        try { await fs.unlink(path.join(siteDir, old)); } catch {}
      }
      await fs.writeFile(path.join(siteDir, "next.config.mjs"), configContent, "utf-8");
    } catch (e) {
      reject(e);
      return;
    }

    const nextBin = path.join(siteDir, "node_modules", "next", "dist", "bin", "next");
    const env = { ...process.env, NODE_ENV: "production" as const };
    delete (env as Record<string, unknown>).TURBOPACK;

    exec(`"${nextBin}" build --webpack`, {
      cwd: siteDir,
      env,
      timeout: 180_000,
    }, (err: Error | null, _stdout: string, _stderr: string) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
