import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { hasPublishedPreviewDirectory, publishDraftPreview, unpublishPreview } from "@/lib/build-runtime";

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
        return NextResponse.json({ error: "No draft build is ready to publish" }, { status: 400 });
      }

      const publishedUrl = await publishDraftPreview(id);
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
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
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
