import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { knowledgeFiles, knowledgeBases } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { regenerateIndex } from "@/lib/kb-index";

/** GET /api/kb/[baseId]/files/[fileId] — get file with full content */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ baseId: string; fileId: string }> }) {
  const { baseId, fileId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const file = await db.select().from(knowledgeFiles)
    .where(and(eq(knowledgeFiles.id, fileId), eq(knowledgeFiles.baseId, baseId), eq(knowledgeFiles.userId, session.user.id)))
    .get();

  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ file });
}

/** PATCH /api/kb/[baseId]/files/[fileId] — update file metadata (name, description, usageTag) */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ baseId: string; fileId: string }> }) {
  const { baseId, fileId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify file ownership
  const file = await db.select({ id: knowledgeFiles.id }).from(knowledgeFiles)
    .where(and(eq(knowledgeFiles.id, fileId), eq(knowledgeFiles.baseId, baseId), eq(knowledgeFiles.userId, session.user.id)))
    .get();
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined && typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }
  if (body.description !== undefined && typeof body.description === "string") {
    updates.description = body.description;
  }
  if (body.usageTag !== undefined) {
    // Allow: "avatar", "hero-bg", "project-cover", "gallery", "" (clear), null (clear)
    const validTags = ["avatar", "hero-bg", "project-cover", "gallery", "", null];
    if (validTags.includes(body.usageTag)) {
      updates.usageTag = body.usageTag || null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await db.update(knowledgeFiles).set(updates)
    .where(and(eq(knowledgeFiles.id, fileId), eq(knowledgeFiles.userId, session.user.id)));

  // Regenerate index to reflect updated metadata
  await regenerateIndex(baseId, session.user.id);

  return NextResponse.json({ ok: true });
}

/** DELETE /api/kb/[baseId]/files/[fileId] — delete a file */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ baseId: string; fileId: string }> }) {
  const { baseId, fileId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.delete(knowledgeFiles)
    .where(and(eq(knowledgeFiles.id, fileId), eq(knowledgeFiles.baseId, baseId), eq(knowledgeFiles.userId, session.user.id)));

  // Regenerate index
  await regenerateIndex(baseId, session.user.id);

  return NextResponse.json({ ok: true });
}
