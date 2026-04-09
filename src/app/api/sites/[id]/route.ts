import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sites, siteBuilds } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import path from "path";
import { hasPublishedPreviewDirectory, publishDraftPreview, unpublishPreview, syncDraftPreview } from "@/lib/build-runtime";
import { internalError } from "@/lib/api-errors";

// GET /api/sites/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const site = await db
    .select()
    .from(sites)
    .where(and(eq(sites.id, id), eq(sites.userId, session.user.id)))
    .get();

  if (!site) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ site });
}

// PUT /api/sites/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const now = new Date().toISOString();
    const site = await db
      .select()
      .from(sites)
      .where(and(eq(sites.id, id), eq(sites.userId, session.user.id)))
      .get();

    if (!site) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (body?.action === "publish") {
      if (!site.draftBuildId) {
        return NextResponse.json({ error: "No draft build is ready to publish. Please generate or rebuild first." }, { status: 400 });
      }

      let publishedUrl: string;
      try {
        publishedUrl = await publishDraftPreview(id);
      } catch (err) {
        return internalError(err, "sites-publish", { clientMessage: "Failed to publish" });
      }
      await db
        .update(sites)
        .set({
          status: "published",
          publishedBuildId: site.draftBuildId,
          publishedUrl,
          publishedAt: now,
          updatedAt: now,
        })
        .where(and(eq(sites.id, id), eq(sites.userId, session.user.id)));

      return NextResponse.json({
        ok: true,
        site: {
          status: "published",
          publishedUrl,
          publishedBuildId: site.draftBuildId,
          publishMode: hasPublishedPreviewDirectory() ? "static" : "preview-fallback",
        },
      });
    }

    if (body?.action === "rollback") {
      if (!site.publishedBuildId) {
        return NextResponse.json({ error: "No published build to rollback to" }, { status: 400 });
      }

      const publishedBuild = await db.select({ fileMapSnapshot: siteBuilds.fileMapSnapshot, previewUrl: siteBuilds.previewUrl })
        .from(siteBuilds).where(eq(siteBuilds.id, site.publishedBuildId)).get();

      if (publishedBuild?.fileMapSnapshot) {
        // 1. Update DB
        await db.update(sites).set({
          draftBuildId: site.publishedBuildId,
          fileMap: publishedBuild.fileMapSnapshot,
          previewUrl: publishedBuild.previewUrl || site.previewUrl,
          buildStatus: "ready",
          buildError: null,
          updatedAt: now,
        }).where(and(eq(sites.id, id), eq(sites.userId, session.user.id)));

        // 2. Restore files on disk from the snapshot
        const fileMap = JSON.parse(publishedBuild.fileMapSnapshot) as Record<string, string>;
        const siteDir = path.join(process.cwd(), "sites-data", id);
        const fsModule = await import("fs/promises");
        for (const [filePath, content] of Object.entries(fileMap)) {
          const fullPath = path.join(siteDir, filePath);
          await fsModule.mkdir(path.dirname(fullPath), { recursive: true });
          await fsModule.writeFile(fullPath, content, "utf-8");
        }

        // 3. Re-sync preview directory
        try { await syncDraftPreview(id, siteDir); } catch {}
      }

      return NextResponse.json({ ok: true, site: { status: site.status, rolledBack: true } });
    }

    if (body?.action === "unpublish") {
      await unpublishPreview(id);
      await db
        .update(sites)
        .set({
          status: "draft",
          publishedBuildId: null,
          publishedUrl: null,
          publishedAt: null,
          updatedAt: now,
        })
        .where(and(eq(sites.id, id), eq(sites.userId, session.user.id)));

      return NextResponse.json({ ok: true, site: { status: "draft", publishedUrl: null, publishedBuildId: null } });
    }

    await db
      .update(sites)
      .set({ ...body, updatedAt: now })
      .where(and(eq(sites.id, id), eq(sites.userId, session.user.id)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    return internalError(err, "sites-patch");
  }
}

// DELETE /api/sites/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Unpublish if published
  try { await unpublishPreview(id); } catch {}

  // Clean up site files on disk
  const fs = await import("fs/promises");
  const path = await import("path");
  const siteDir = path.default.join(process.cwd(), "sites-data", id);
  try { await fs.rm(siteDir, { recursive: true, force: true }); } catch {}

  await db
    .delete(sites)
    .where(and(eq(sites.id, id), eq(sites.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}
