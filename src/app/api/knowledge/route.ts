import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { knowledgeItems } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

// GET /api/knowledge - List current user's knowledge items
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await db
    .select()
    .from(knowledgeItems)
    .where(eq(knowledgeItems.userId, session.user.id))
    .orderBy(desc(knowledgeItems.createdAt));

  // Parse tags JSON
  const parsed = items.map((item) => ({
    ...item,
    tags: (() => { try { return JSON.parse(item.tags || "[]"); } catch { return []; } })(),
    selected: !!item.selected,
  }));

  return NextResponse.json({ items: parsed });
}

// POST /api/knowledge - Batch create knowledge items (from source analysis)
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { items, sourceId, sourceName, sourceType } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items array required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const created = [];

    for (const item of items) {
      const id = crypto.randomUUID();
      await db.insert(knowledgeItems).values({
        id,
        userId: session.user.id,
        sourceId: sourceId || item.sourceId || null,
        sourceName: sourceName || null,
        sourceType: sourceType || null,
        category: item.category || "factual",
        title: item.title || "Untitled",
        content: item.content || "",
        tags: JSON.stringify(item.tags || []),
        selected: 1,
        createdAt: now,
        updatedAt: now,
      });
      created.push(id);
    }

    return NextResponse.json({ ok: true, count: created.length, ids: created });
  } catch (err) {
    console.error("POST /api/knowledge error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/knowledge - Delete items by sourceId or all
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sourceId = searchParams.get("sourceId");

  if (sourceId) {
    await db
      .delete(knowledgeItems)
      .where(and(eq(knowledgeItems.userId, session.user.id), eq(knowledgeItems.sourceId, sourceId)));
  } else {
    await db.delete(knowledgeItems).where(eq(knowledgeItems.userId, session.user.id));
  }

  return NextResponse.json({ ok: true });
}
