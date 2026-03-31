import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { knowledgeItems, knowledgeRelations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/knowledge-graph
 * Returns all knowledge items and relations as a graph structure for visualization.
 */
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await db
    .select({
      id: knowledgeItems.id,
      category: knowledgeItems.category,
      title: knowledgeItems.title,
      tags: knowledgeItems.tags,
      useCase: knowledgeItems.useCase,
      selected: knowledgeItems.selected,
      groupId: knowledgeItems.groupId,
    })
    .from(knowledgeItems)
    .where(eq(knowledgeItems.userId, session.user.id));

  const relations = await db
    .select({
      id: knowledgeRelations.id,
      fromId: knowledgeRelations.fromId,
      toId: knowledgeRelations.toId,
      relationType: knowledgeRelations.relationType,
      label: knowledgeRelations.label,
      strength: knowledgeRelations.strength,
    })
    .from(knowledgeRelations)
    .where(eq(knowledgeRelations.userId, session.user.id));

  // Build graph structure
  const nodes = items.map(item => ({
    id: item.id,
    label: item.title,
    category: item.category,
    tags: item.tags ? JSON.parse(item.tags) : [],
    useCase: item.useCase,
    selected: item.selected === 1,
    groupId: item.groupId,
  }));

  const edges = relations.map(rel => ({
    id: rel.id,
    source: rel.fromId,
    target: rel.toId,
    type: rel.relationType,
    label: rel.label,
    strength: rel.strength || 1,
  }));

  return NextResponse.json({ nodes, edges });
}

/**
 * POST /api/knowledge-graph
 * Save extracted relations for a set of knowledge items.
 * Body: { relations: [{ fromTitle, toTitle, relationType, label? }] }
 * Resolves titles to item IDs within the user's knowledge base.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { relations: rawRelations } = await req.json() as {
    relations: Array<{ fromTitle: string; toTitle: string; relationType: string; label?: string }>;
  };

  if (!Array.isArray(rawRelations) || rawRelations.length === 0) {
    return NextResponse.json({ error: "No relations provided" }, { status: 400 });
  }

  // Load all user's items for title → ID resolution
  const items = await db
    .select({ id: knowledgeItems.id, title: knowledgeItems.title })
    .from(knowledgeItems)
    .where(eq(knowledgeItems.userId, session.user.id));

  const titleMap = new Map<string, string>();
  for (const item of items) {
    titleMap.set(item.title.toLowerCase(), item.id);
  }

  // Fuzzy title match: try exact, then substring
  function resolveTitle(title: string): string | null {
    const lower = title.toLowerCase();
    if (titleMap.has(lower)) return titleMap.get(lower)!;
    for (const [key, id] of titleMap) {
      if (key.includes(lower) || lower.includes(key)) return id;
    }
    return null;
  }

  const saved: Array<{ from: string; to: string; type: string }> = [];

  for (const rel of rawRelations) {
    const fromId = resolveTitle(rel.fromTitle);
    const toId = resolveTitle(rel.toTitle);
    if (!fromId || !toId || fromId === toId) continue;

    await db.insert(knowledgeRelations).values({
      userId: session.user.id,
      fromId,
      toId,
      relationType: rel.relationType,
      label: rel.label || `${rel.fromTitle} → ${rel.toTitle}`,
      strength: 2,
    });

    saved.push({ from: rel.fromTitle, to: rel.toTitle, type: rel.relationType });
  }

  return NextResponse.json({ ok: true, saved: saved.length, relations: saved });
}
