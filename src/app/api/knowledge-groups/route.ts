import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { knowledgeGroups, knowledgeItems } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET - List user's knowledge groups with item counts
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groups = await db.select().from(knowledgeGroups)
    .where(eq(knowledgeGroups.userId, session.user.id))
    .orderBy(desc(knowledgeGroups.createdAt));

  // Attach item counts per group
  const result = await Promise.all(groups.map(async (g) => {
    const items = await db.select({ id: knowledgeItems.id, category: knowledgeItems.category, selected: knowledgeItems.selected })
      .from(knowledgeItems).where(eq(knowledgeItems.groupId, g.id));

    const categoryCounts: Record<string, number> = {};
    for (const it of items) { categoryCounts[it.category] = (categoryCounts[it.category] || 0) + 1; }

    return {
      ...g,
      tags: (() => { try { return JSON.parse(g.tags || "[]"); } catch { return []; } })(),
      itemCount: items.length,
      selectedCount: items.filter(i => i.selected).length,
      categoryCounts,
    };
  }));

  return NextResponse.json({ groups: result });
}

// POST - Create a new knowledge group
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, description, tags, sourceFile, sourceType, indexMd, items } = body;

    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(knowledgeGroups).values({
      id,
      userId: session.user.id,
      name,
      description: description || "",
      indexMd: indexMd || "",
      tags: JSON.stringify(tags || []),
      sourceFile: sourceFile || null,
      sourceType: sourceType || null,
      createdAt: now,
      updatedAt: now,
    });

    // If items provided, insert them linked to this group
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await db.insert(knowledgeItems).values({
          id: crypto.randomUUID(),
          userId: session.user.id,
          groupId: id,
          sourceId: item.sourceId || null,
          sourceName: sourceFile || null,
          sourceType: sourceType || null,
          category: item.category || "factual",
          title: item.title || "Untitled",
          content: item.content || "",
          tags: JSON.stringify(item.tags || []),
          selected: 1,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return NextResponse.json({ id, itemCount: items?.length || 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
