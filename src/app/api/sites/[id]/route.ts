import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

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
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const now = new Date().toISOString();

  await db
    .update(sites)
    .set({ ...body, updatedAt: now })
    .where(and(eq(sites.id, id), eq(sites.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}

// DELETE /api/sites/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .delete(sites)
    .where(and(eq(sites.id, id), eq(sites.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}
