import { NextRequest, NextResponse } from "next/server";

/**
 * Upload size ceilings for multipart endpoints.
 *
 * Why this exists: Next.js does NOT cap request body size by default on
 * the App Router. Any authenticated user can POST an arbitrarily large
 * file to /api/analyze, /api/analyze-source, /api/ingestion, or
 * /api/kb/[baseId]/files and blow through server RAM / disk before the
 * handler gets a chance to reject it. Worse, `req.formData()` buffers
 * the whole thing in memory before returning. Without an explicit
 * ceiling one bad actor can OOM the web process.
 *
 * Strategy:
 *   1. First pass — check the Content-Length header before parsing the
 *      body. Cheap, lets us reject oversized requests without touching
 *      memory.
 *   2. Second pass — after extracting the File from formData, check
 *      file.size. Catches clients that lied about Content-Length or
 *      sent multiple fields.
 *
 * Limits are overridable via env vars so ops can tune them per deploy
 * without touching code. Defaults are generous for real use (portfolio
 * source zips can be tens of MB) but tight enough that a single request
 * can't OOM a 1 GB Node process.
 */

/** Max bytes for a single uploaded file on ingestion/analyze endpoints. */
export const DEFAULT_MAX_UPLOAD_BYTES = Number(
  process.env.MAX_UPLOAD_BYTES || 100 * 1024 * 1024,
); // 100 MB

/** Max bytes for KB file uploads (per-file inside the KB). */
export const DEFAULT_MAX_KB_UPLOAD_BYTES = Number(
  process.env.MAX_KB_UPLOAD_BYTES || 50 * 1024 * 1024,
); // 50 MB

function tooLarge(limit: number, actual?: number): NextResponse {
  return NextResponse.json(
    {
      error: "Payload too large",
      limitBytes: limit,
      limitMB: Math.round(limit / (1024 * 1024)),
      actualBytes: actual,
    },
    { status: 413 },
  );
}

/**
 * Reject the request up front if Content-Length exceeds the limit.
 * Returns null when the request is within limits (or missing
 * Content-Length — we fall through to the post-parse check in that
 * case). Returns a 413 Response otherwise.
 */
export function checkContentLength(
  req: NextRequest,
  maxBytes: number,
): NextResponse | null {
  const header = req.headers.get("content-length");
  if (!header) return null; // unknown — rely on post-parse check
  const declared = Number(header);
  if (!Number.isFinite(declared)) return null;
  if (declared > maxBytes) return tooLarge(maxBytes, declared);
  return null;
}

/**
 * Reject if an already-parsed File's size exceeds the limit. Returns
 * null when fine, a 413 Response otherwise. Call this AFTER extracting
 * the File from formData but BEFORE calling file.arrayBuffer().
 */
export function checkFileSize(
  file: File,
  maxBytes: number,
): NextResponse | null {
  if (file.size > maxBytes) return tooLarge(maxBytes, file.size);
  return null;
}
