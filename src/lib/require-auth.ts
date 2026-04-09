import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Returns the authenticated user's id for the current request, or null if
 * there is no valid session. Mirrors the shape of `requireAdmin()` in
 * `src/lib/admin.ts` so the two can be used side-by-side.
 *
 * Usage at the top of any API route handler:
 *
 *   export async function POST(req: NextRequest) {
 *     const userId = await requireAuth();
 *     if (!userId) return unauthorized();
 *     // ... handler logic, userId is guaranteed non-null here
 *   }
 *
 * Keep this helper tiny and dependency-free — every LLM-calling route in
 * the app will import it, and any bug here becomes a site-wide auth bug.
 */
export async function requireAuth(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id || null;
}

/**
 * Standard 401 JSON response for API routes. Centralized so the error shape
 * stays consistent across every protected endpoint — clients can rely on
 * `{ error: string }` with status 401 to trigger their re-login flow.
 */
export function unauthorized(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}
