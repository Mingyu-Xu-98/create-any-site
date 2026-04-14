import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorized } from "@/lib/require-auth";
import { internalError } from "@/lib/api-errors";
import { runEditSession } from "@/lib/edit-runtime";
import { sqlite } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * POST /api/edit — Execute an edit session
 * Body: { siteId: string, instruction: string }
 */
export async function POST(req: NextRequest) {
  const userId = await requireAuth();
  if (!userId) return unauthorized();

  try {
    const body = await req.json();
    const siteId = typeof body?.siteId === "string" ? body.siteId : "";
    const instruction = typeof body?.instruction === "string" ? body.instruction.trim() : "";

    if (!siteId) {
      return NextResponse.json({ error: "siteId is required" }, { status: 400 });
    }
    if (!instruction) {
      return NextResponse.json({ error: "instruction is required" }, { status: 400 });
    }

    logger.info("api-edit", `Edit request for site ${siteId}: "${instruction.slice(0, 80)}"`);

    const result = await runEditSession({
      siteId,
      userId,
      instruction,
    });

    return NextResponse.json(result);
  } catch (err) {
    return internalError(err, "api-edit");
  }
}

/**
 * GET /api/edit?siteId=xxx — Get edit history for a site
 */
export async function GET(req: NextRequest) {
  const userId = await requireAuth();
  if (!userId) return unauthorized();

  const siteId = req.nextUrl.searchParams.get("siteId");
  if (!siteId) {
    return NextResponse.json({ error: "siteId is required" }, { status: 400 });
  }

  try {
    const sessions = sqlite.prepare(
      `SELECT id, status, intent, instruction, changes, build_success, build_error, created_at, completed_at
       FROM edit_sessions
       WHERE site_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`
    ).all(siteId, userId) as Array<{
      id: string;
      status: string;
      intent: string;
      instruction: string;
      changes: string | null;
      build_success: number | null;
      build_error: string | null;
      created_at: string;
      completed_at: string | null;
    }>;

    const formatted = sessions.map(s => ({
      id: s.id,
      status: s.status,
      intent: s.intent,
      instruction: s.instruction,
      changeCount: s.changes ? JSON.parse(s.changes).length : 0,
      buildSuccess: s.build_success === 1,
      buildError: s.build_error,
      createdAt: s.created_at,
      completedAt: s.completed_at,
    }));

    return NextResponse.json({ sessions: formatted });
  } catch (err) {
    return internalError(err, "api-edit-list");
  }
}
