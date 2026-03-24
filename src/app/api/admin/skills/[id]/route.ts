import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/admin/skills/[id] - Get full skill (all levels)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminId = await requireAdmin();
  if (!adminId) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const skill = await db.select().from(skills).where(eq(skills.id, id)).get();
  if (!skill) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ skill });
}

// PUT /api/admin/skills/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminId = await requireAdmin();
  if (!adminId) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = { updatedAt: now };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.category !== undefined) updates.category = body.category;
  if (body.indexContent !== undefined) updates.indexContent = body.indexContent;
  if (body.references !== undefined) updates.references = JSON.stringify(body.references);
  if (body.siteTypes !== undefined) updates.siteTypes = JSON.stringify(body.siteTypes);
  if (body.enabled !== undefined) updates.enabled = body.enabled ? 1 : 0;

  await db.update(skills).set(updates).where(eq(skills.id, id));

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/skills/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminId = await requireAdmin();
  if (!adminId) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  await db.delete(skills).where(eq(skills.id, id));

  return NextResponse.json({ ok: true });
}
