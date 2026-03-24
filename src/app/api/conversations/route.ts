import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET - List user's conversations
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = await db.select({
    id: conversations.id,
    siteId: conversations.siteId,
    title: conversations.title,
    previewUrl: conversations.previewUrl,
    createdAt: conversations.createdAt,
    updatedAt: conversations.updatedAt,
  }).from(conversations).where(eq(conversations.userId, session.user.id)).orderBy(desc(conversations.updatedAt));

  return NextResponse.json({ conversations: list });
}

// POST - Create new conversation
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Derive title from first user message
  const messages = body.messages || [];
  const firstUserMsg = messages.find((m: { role: string }) => m.role === "user");
  const title = firstUserMsg?.content?.slice(0, 50) || "New conversation";

  await db.insert(conversations).values({
    id,
    userId: session.user.id,
    siteId: body.siteId || null,
    title,
    messages: JSON.stringify(messages),
    previewUrl: body.previewUrl || null,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id });
}
