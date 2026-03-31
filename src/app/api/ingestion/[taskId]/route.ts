import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ingestionTasks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * GET /api/ingestion/[taskId] — Get status of a specific task.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await db
    .select()
    .from(ingestionTasks)
    .where(and(eq(ingestionTasks.id, taskId), eq(ingestionTasks.userId, session.user.id)))
    .get();

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ task });
}

/**
 * DELETE /api/ingestion/[taskId] — Delete a task record.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.delete(ingestionTasks).where(and(eq(ingestionTasks.id, taskId), eq(ingestionTasks.userId, session.user.id)));
  return NextResponse.json({ ok: true });
}
