import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const tpl = await db.select().from(templates).where(eq(templates.id, id)).get();
  if (!tpl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ template: tpl });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await req.json();
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = { updatedAt: now };
  for (const key of ["name", "description", "category", "siteType", "theme", "layout", "previewImage", "previewUrl"]) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (body.fileMap !== undefined) updates.fileMap = JSON.stringify(body.fileMap);
  if (body.featured !== undefined) updates.featured = body.featured ? 1 : 0;

  await db.update(templates).set(updates).where(eq(templates.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  await db.delete(templates).where(eq(templates.id, id));
  return NextResponse.json({ ok: true });
}
