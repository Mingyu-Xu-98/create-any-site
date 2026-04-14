import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { sqlite } from "@/lib/db";
import { getErrorStats, checkPromotionCandidates, promotePattern } from "@/lib/error-lifecycle";

/**
 * GET /api/admin/error-patterns — List all error patterns with stats
 */
export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const patterns = sqlite
    .prepare(
      `SELECT id, fingerprint, pattern, category, layer, bad_pattern, fix_hint,
              frequency, applicable_context, last_seen_at, created_at
       FROM error_patterns
       ORDER BY frequency DESC
       LIMIT 200`
    )
    .all();

  const stats = getErrorStats();
  const candidates = checkPromotionCandidates();

  return NextResponse.json({ patterns, stats, candidates });
}

/**
 * POST /api/admin/error-patterns — Promote a pattern to a lower layer
 * Body: { patternId: string, targetLayer: "guardrail" | "template" }
 */
export async function POST(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { patternId, targetLayer } = body;

  if (!patternId || !["guardrail", "template"].includes(targetLayer)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const success = promotePattern(patternId, targetLayer);
  return NextResponse.json({ success });
}
