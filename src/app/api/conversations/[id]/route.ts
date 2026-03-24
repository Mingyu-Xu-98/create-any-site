import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// GET - Load conversation
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conv = await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, session.user.id))).get();
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    conversation: { ...conv, messages: JSON.parse(conv.messages || "[]") },
  });
}

// PUT - Update conversation
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (body.messages !== undefined) updates.messages = JSON.stringify(body.messages);
  if (body.siteId !== undefined) updates.siteId = body.siteId;
  if (body.previewUrl !== undefined) updates.previewUrl = body.previewUrl;
  if (body.title !== undefined) updates.title = body.title;

  await db.update(conversations).set(updates).where(and(eq(conversations.id, id), eq(conversations.userId, session.user.id)));

  return NextResponse.json({ ok: true });
}

// DELETE
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, session.user.id)));
  return NextResponse.json({ ok: true });
}
