import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { knowledgeBases, knowledgeFiles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/** GET /api/kb/[baseId] — get a knowledge base with its files */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ baseId: string }> }) {
  const { baseId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const base = await db.select().from(knowledgeBases)
    .where(and(eq(knowledgeBases.id, baseId), eq(knowledgeBases.userId, session.user.id)))
    .get();

  if (!base) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const files = await db.select({
    id: knowledgeFiles.id,
    name: knowledgeFiles.name,
    type: knowledgeFiles.type,
    description: knowledgeFiles.description,
    keywords: knowledgeFiles.keywords,
    originalUrl: knowledgeFiles.originalUrl,
    contentLength: knowledgeFiles.contentLength,
    assetPath: knowledgeFiles.assetPath,
    createdAt: knowledgeFiles.createdAt,
  }).from(knowledgeFiles)
    .where(eq(knowledgeFiles.baseId, baseId))
    .orderBy(knowledgeFiles.createdAt);

  return NextResponse.json({ base, files });
}

/** PUT /api/kb/[baseId] — update name/description */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ baseId: string }> }) {
  const { baseId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  await db.update(knowledgeBases).set({
    ...(body.name ? { name: body.name } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    updatedAt: new Date().toISOString(),
  }).where(and(eq(knowledgeBases.id, baseId), eq(knowledgeBases.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}

/** DELETE /api/kb/[baseId] — delete knowledge base and all its files */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ baseId: string }> }) {
  const { baseId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.delete(knowledgeBases)
    .where(and(eq(knowledgeBases.id, baseId), eq(knowledgeBases.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}
