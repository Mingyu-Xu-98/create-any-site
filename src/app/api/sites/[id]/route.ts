import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sites, siteBuilds } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { hasPublishedPreviewDirectory, publishDraftPreview, unpublishPreview, syncDraftPreview } from "@/lib/build-runtime";
import { internalError } from "@/lib/api-errors";
import { siteBuildDir, siteCurrentLink, siteRoot } from "@/lib/site-paths";

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
        // Try fast path: symlink swap (if build dir still exists on disk)
        const buildDir = siteBuildDir(id, site.publishedBuildId);
        let usedSymlinkSwap = false;
        try {
          await fs.access(path.join(buildDir, "out", "index.html"));
          // Build dir exists — atomic symlink swap
          const link = siteCurrentLink(id);
          const tmpLink = `${link}_tmp_${Date.now()}`;
          await fs.symlink(path.join("builds", site.publishedBuildId), tmpLink);
          await fs.rename(tmpLink, link);
          try { await syncDraftPreview(id, buildDir); } catch {}
          usedSymlinkSwap = true;
        } catch {
          // Build dir pruned — fall back to file restore from snapshot
        }

        if (!usedSymlinkSwap) {
          // Slow path: restore files from DB snapshot
          // First, clean the site directory to remove residual files from the current build
          const fileMap = JSON.parse(publishedBuild.fileMapSnapshot) as Record<string, string>;
          const siteDir = siteRoot(id);
          try {
            const srcDir = path.join(siteDir, "src");
            await fs.rm(srcDir, { recursive: true, force: true });
          } catch {
            // src dir may not exist
          }
          // Then write back all files from the snapshot
          for (const [filePath, content] of Object.entries(fileMap)) {
            const fullPath = path.join(siteDir, filePath);
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content, "utf-8");
          }
          try { await syncDraftPreview(id, siteDir); } catch {}
        }

        // Update DB
        await db.update(sites).set({
          draftBuildId: site.publishedBuildId,
          fileMap: publishedBuild.fileMapSnapshot,
          previewUrl: publishedBuild.previewUrl || site.previewUrl,
          buildStatus: "ready",
          buildError: null,
          updatedAt: now,
        }).where(and(eq(sites.id, id), eq(sites.userId, session.user.id)));
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

    // Whitelist: only allow safe fields to be updated by the client
    const ALLOWED_FIELDS = new Set([
      "name", "slug", "siteType", "theme", "layout",
      "workspaceData", "selections", "fileMap", "editorState",
      "prd", "prdHistory", "isPublic", "publicDesc",
    ]);
    const safeUpdate: Record<string, unknown> = { updatedAt: now };
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(key)) {
        safeUpdate[key] = value;
      }
    }

    await db
      .update(sites)
      .set(safeUpdate)
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
  const siteDir = siteRoot(id);
  try { await fs.rm(siteDir, { recursive: true, force: true }); } catch {}

  await db
    .delete(sites)
    .where(and(eq(sites.id, id), eq(sites.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}
