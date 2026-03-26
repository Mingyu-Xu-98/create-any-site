import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { knowledgeGroups, knowledgeItems } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// GET - Get group with all items
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const group = await db.select().from(knowledgeGroups)
    .where(and(eq(knowledgeGroups.id, id), eq(knowledgeGroups.userId, session.user.id))).get();
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await db.select().from(knowledgeItems).where(eq(knowledgeItems.groupId, id));
  const parsed = items.map(i => ({
    ...i,
    tags: (() => { try { return JSON.parse(i.tags || "[]"); } catch { return []; } })(),
    selected: !!i.selected,
  }));

  return NextResponse.json({
    group: { ...group, tags: (() => { try { return JSON.parse(group.tags || "[]"); } catch { return []; } })() },
    items: parsed,
  });
}

// PUT - Update group (name, description, tags, indexMd)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.indexMd !== undefined) updates.indexMd = body.indexMd;
  if (body.tags !== undefined) updates.tags = JSON.stringify(body.tags);

  await db.update(knowledgeGroups).set(updates)
    .where(and(eq(knowledgeGroups.id, id), eq(knowledgeGroups.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}

// DELETE - Delete group and all its items (CASCADE)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.delete(knowledgeGroups)
    .where(and(eq(knowledgeGroups.id, id), eq(knowledgeGroups.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}
