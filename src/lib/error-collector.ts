/**
 * Error Collector — cross-build error memory.
 *
 * Records build errors and guardrail fixes into `error_patterns` table,
 * deduplicates via fingerprint, and provides top-N prompt hints for
 * the Code Agent to avoid known pitfalls.
 */
import { db, sqlite } from "@/lib/db";
import { errorPatterns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { classifyBuildError, classifyGuardrailFix, type ErrorClassification } from "@/lib/error-classifier";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Record helpers
// ---------------------------------------------------------------------------

/**
 * Record a build error (from `next build` failure).
 * Classifies the raw error, then upserts into error_patterns.
 */
export function recordBuildError(
  rawError: string,
  context?: { siteId?: string; buildId?: string; theme?: string | null; siteType?: string | null },
): void {
  try {
    const classification = classifyBuildError(rawError);
    if (!classification) return; // unclassifiable noise

    upsertPattern(classification, rawError, context);
  } catch (err) {
    logger.warn("error-collector", `recordBuildError failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Record guardrail fixes that were applied during a build.
 * Each fix name (e.g. "fixMissingUseClient") is converted to a pattern.
 */
export function recordGuardrailFixes(
  fixes: string[],
  context?: { siteId?: string; buildId?: string; theme?: string | null; siteType?: string | null },
): void {
  try {
    for (const fixName of fixes) {
      // Extract the fix function name from the log message
      // Messages look like: "fixMissingUseClient: added 'use client' to page.tsx"
      const funcName = fixName.split(":")[0].trim();
      if (!funcName.startsWith("fix")) continue;

      const classification = classifyGuardrailFix(funcName);
      upsertPattern(classification, fixName, context);
    }
  } catch (err) {
    logger.warn("error-collector", `recordGuardrailFixes failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Prompt hint query
// ---------------------------------------------------------------------------

interface HintContext {
  theme?: string;
  siteType?: string;
  sections?: string[];
}

/**
 * Query the top-N most relevant error hints for Code Agent prompt injection.
 *
 * Returns a formatted markdown block (max ~500 chars) or empty string.
 * Prioritizes: high frequency → recent → matching context.
 */
export function getRelevantHints(context?: HintContext, limit = 5): string {
  try {
    // Query top patterns by frequency, only from "prompt" layer
    const rows = sqlite
      .prepare(
        `SELECT pattern, category, bad_pattern, fix_hint, frequency, applicable_context
         FROM error_patterns
         WHERE layer = 'prompt'
         ORDER BY frequency DESC, last_seen_at DESC
         LIMIT ?`,
      )
      .all(limit * 2) as Array<{
      pattern: string;
      category: string;
      bad_pattern: string;
      fix_hint: string;
      frequency: number;
      applicable_context: string | null;
    }>;

    if (rows.length === 0) return "";

    // Score and filter by context relevance
    const scored = rows.map((row) => {
      let score = row.frequency;

      if (context && row.applicable_context) {
        try {
          const ac = JSON.parse(row.applicable_context) as {
            themes?: string[];
            siteTypes?: string[];
            sections?: string[];
          };
          if (context.theme && ac.themes?.includes(context.theme)) score += 5;
          if (context.siteType && ac.siteTypes?.includes(context.siteType)) score += 5;
          if (context.sections && ac.sections) {
            const overlap = context.sections.filter((s) => ac.sections!.includes(s));
            score += overlap.length * 2;
          }
        } catch {
          // ignore malformed JSON
        }
      }

      return { ...row, score };
    });

    // Sort by score descending, take top `limit`
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, limit);

    // Format as markdown block
    const lines = top.map(
      (r) => `- **${r.category}**: ${r.bad_pattern} → ${r.fix_hint} (seen ${r.frequency}×)`,
    );

    return `## Known Pitfalls\nThese errors have appeared in previous builds. Avoid them:\n${lines.join("\n")}`;
  } catch (err) {
    logger.warn("error-collector", `getRelevantHints failed: ${err instanceof Error ? err.message : String(err)}`);
    return "";
  }
}

// ---------------------------------------------------------------------------
// Internal: upsert into error_patterns
// ---------------------------------------------------------------------------

function upsertPattern(
  classification: ErrorClassification,
  rawExample: string,
  context?: { siteId?: string; buildId?: string; theme?: string | null; siteType?: string | null },
): void {
  const now = new Date().toISOString();

  // Try to find existing pattern by fingerprint
  const existing = sqlite
    .prepare("SELECT id, frequency, applicable_context FROM error_patterns WHERE fingerprint = ?")
    .get(classification.fingerprint) as
    | { id: string; frequency: number; applicable_context: string | null }
    | undefined;

  if (existing) {
    // Update frequency + last_seen_at + merge context
    const mergedContext = mergeContext(existing.applicable_context, context);
    sqlite
      .prepare(
        `UPDATE error_patterns
         SET frequency = frequency + 1,
             last_seen_at = ?,
             applicable_context = ?
         WHERE id = ?`,
      )
      .run(now, mergedContext, existing.id);
  } else {
    // Insert new pattern
    const id = crypto.randomUUID();
    const applicableContext = context
      ? JSON.stringify({
          themes: context.theme ? [context.theme] : [],
          siteTypes: context.siteType ? [context.siteType] : [],
          sections: [],
        })
      : null;

    sqlite
      .prepare(
        `INSERT INTO error_patterns (id, fingerprint, pattern, category, layer, raw_example, bad_pattern, fix_hint, frequency, applicable_context, last_seen_at, created_at)
         VALUES (?, ?, ?, ?, 'prompt', ?, ?, ?, 1, ?, ?, ?)`,
      )
      .run(
        id,
        classification.fingerprint,
        classification.pattern,
        classification.category,
        rawExample.slice(0, 2000), // cap raw example length
        classification.badPattern,
        classification.fixHint,
        applicableContext,
        now,
        now,
      );
  }
}

function mergeContext(
  existingJson: string | null,
  newContext?: { theme?: string | null; siteType?: string | null },
): string | null {
  if (!newContext) return existingJson;

  let existing: { themes: string[]; siteTypes: string[]; sections: string[] } = {
    themes: [],
    siteTypes: [],
    sections: [],
  };

  if (existingJson) {
    try {
      existing = JSON.parse(existingJson);
    } catch {
      // reset if malformed
    }
  }

  if (newContext.theme && !existing.themes.includes(newContext.theme)) {
    existing.themes.push(newContext.theme);
  }
  if (newContext.siteType && !existing.siteTypes.includes(newContext.siteType)) {
    existing.siteTypes.push(newContext.siteType);
  }

  return JSON.stringify(existing);
}
