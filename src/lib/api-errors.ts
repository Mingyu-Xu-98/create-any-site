import { NextResponse } from "next/server";

/**
 * Standardized 500 response for API routes.
 *
 * Problem this solves: every `catch (err) { return NextResponse.json({
 * error: err.message }) }` in an API handler leaks internal detail to
 * any authenticated (or anonymous) client. In the wild that means:
 *   - stack traces mentioning absolute filesystem paths
 *   - SQL errors revealing table/column names
 *   - upstream API error bodies (siliconflow returning its own 4xx
 *     message with internal prompt content)
 *   - `ENOENT` messages exposing user data file layouts
 * None of that belongs in a client response. It belongs in the server
 * log, keyed by a requestId the client can quote when asking for help.
 *
 * Usage at the bottom of any API handler:
 *
 *   } catch (err) {
 *     return internalError(err, "chat-build");
 *   }
 *
 * In production: client sees { error: "Internal error", requestId }.
 * In development: client sees the real message for DX, still gets a
 * requestId, and the full error is also logged server-side.
 */

const isProd = process.env.NODE_ENV === "production";

export interface InternalErrorOptions {
  /** Override the generic client-facing message. */
  clientMessage?: string;
  /** Override HTTP status (default 500). */
  status?: number;
}

/**
 * Log the error server-side with a fresh requestId, return a safe
 * JSON response that never leaks internals in production.
 *
 * @param err    the caught error (any type — we defensively stringify)
 * @param source short tag for the log line, e.g. "chat-build", "kb-upload"
 * @param opts   optional overrides
 */
export function internalError(
  err: unknown,
  source: string,
  opts: InternalErrorOptions = {},
): NextResponse {
  const requestId = crypto.randomUUID().slice(0, 8);
  const realMessage = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  // Always log the full thing server-side, keyed by requestId.
  // console.error is intentional — keeps this module dep-free so it
  // can be imported from any route without triggering circular imports
  // via the logger module.
  console.error(
    `[${source}] [${requestId}] ${realMessage}${stack ? "\n" + stack : ""}`,
  );

  const clientMessage = opts.clientMessage ?? "Internal error";
  const body: Record<string, unknown> = { error: clientMessage, requestId };

  // In dev, surface the real message so the dev console is useful.
  // Never in prod — that's the whole point of this helper.
  if (!isProd) {
    body.debug = realMessage;
  }

  return NextResponse.json(body, { status: opts.status ?? 500 });
}

/**
 * Same as internalError but returns a plain Response with CORS headers —
 * for public endpoints like /api/site-chat/[siteId] that use Response
 * directly instead of NextResponse and set their own CORS.
 */
export function internalErrorWithHeaders(
  err: unknown,
  source: string,
  extraHeaders: Record<string, string> = {},
  opts: InternalErrorOptions = {},
): Response {
  const requestId = crypto.randomUUID().slice(0, 8);
  const realMessage = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  console.error(
    `[${source}] [${requestId}] ${realMessage}${stack ? "\n" + stack : ""}`,
  );

  const clientMessage = opts.clientMessage ?? "Internal error";
  const body: Record<string, unknown> = { error: clientMessage, requestId };
  if (!isProd) body.debug = realMessage;

  return new Response(JSON.stringify(body), {
    status: opts.status ?? 500,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}
