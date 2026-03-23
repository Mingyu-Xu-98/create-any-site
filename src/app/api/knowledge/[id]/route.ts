import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { knowledgeItems } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// PUT /api/knowledge/[id] - Update a single knowledge item
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = { updatedAt: now };
  if (body.title !== undefined) updates.title = body.title;
  if (body.content !== undefined) updates.content = body.content;
  if (body.category !== undefined) updates.category = body.category;
  if (body.tags !== undefined) updates.tags = JSON.stringify(body.tags);
  if (body.selected !== undefined) updates.selected = body.selected ? 1 : 0;

  await db
    .update(knowledgeItems)
    .set(updates)
    .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}

// DELETE /api/knowledge/[id] - Delete a single knowledge item
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .delete(knowledgeItems)
    .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}
