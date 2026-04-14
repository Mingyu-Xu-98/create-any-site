import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized } from "@/lib/require-auth";
import { internalError } from "@/lib/api-errors";
import { sqlite } from "@/lib/db";
import { db } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { syncDraftPreview } from "@/lib/build-runtime";
import { siteBuildDir, resolveSiteDir } from "@/lib/site-paths";
import { logger } from "@/lib/logger";
import fs from "fs/promises";

/**
 * POST /api/edit/[sessionId]/undo — Undo an edit by reverting to previous build
 *
 * Uses the immutable build system: each edit's buildIdBefore is preserved,
 * so we can atomically swap the symlink back.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const userId = await requireAuth();
  if (!userId) return unauthorized();

  const { sessionId } = await params;

  try {
    // Get the edit session
    const session = sqlite.prepare(
      `SELECT id, site_id, user_id, build_id_before, status
       FROM edit_sessions WHERE id = ? AND user_id = ?`
    ).get(sessionId, userId) as {
      id: string;
      site_id: string;
      user_id: string;
      build_id_before: string | null;
      status: string;
    } | undefined;

    if (!session) {
      return NextResponse.json({ error: "Edit session not found" }, { status: 404 });
    }

    if (!session.build_id_before) {
      return NextResponse.json({ error: "No previous build to revert to" }, { status: 400 });
    }

    // Check the previous build directory exists
    const prevBuildDir = siteBuildDir(session.site_id, session.build_id_before);
    try {
      await fs.access(prevBuildDir);
    } catch {
      return NextResponse.json({ error: "Previous build directory no longer exists" }, { status: 410 });
    }

    // Swap symlink back to previous build
    const { siteCurrentLink } = await import("@/lib/site-paths");
    const link = siteCurrentLink(session.site_id);
    const target = `builds/${session.build_id_before}`;

    try {
      await fs.unlink(link);
    } catch {
      // symlink may not exist in legacy layout
    }
    await fs.symlink(target, link);

    // Update site's draftBuildId
    await db.update(sites)
      .set({
        draftBuildId: session.build_id_before,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sites.id, session.site_id));

    // Sync preview
    const PREVIEW_PUBLISH_DIR = process.env.PREVIEW_PUBLISH_DIR?.trim() || "";
    if (PREVIEW_PUBLISH_DIR) {
      const siteDir = await resolveSiteDir(session.site_id);
      await syncDraftPreview(session.site_id, siteDir);
    }

    logger.info("edit-undo", `Reverted site ${session.site_id} to build ${session.build_id_before} (session ${sessionId})`);

    return NextResponse.json({
      success: true,
      revertedToBuildId: session.build_id_before,
    });
  } catch (err) {
    return internalError(err, "api-edit-undo");
  }
}
