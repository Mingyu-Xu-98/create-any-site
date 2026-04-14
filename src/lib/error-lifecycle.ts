/**
 * Error Lifecycle Manager
 *
 * Manages the graduation of error patterns across defensive layers:
 *
 *   Layer 3 (prompt hints) → Layer 2 (guardrails) → Layer 1 (template)
 *
 * Errors start at Layer 3 (prompt injection). When frequency exceeds
 * thresholds, they are candidates for promotion to lower layers:
 * - 10+ occurrences → eligible for guardrail (deterministic auto-fix)
 * - 50+ occurrences → eligible for template change (structural prevention)
 *
 * Promotion requires manual review (admin action), but this module
 * identifies candidates and provides the data for decision-making.
 */
import { sqlite } from "@/lib/db";
import { logger } from "@/lib/logger";

const GUARDRAIL_THRESHOLD = 10;
const TEMPLATE_THRESHOLD = 50;

export interface PromotionCandidate {
  id: string;
  pattern: string;
  category: string;
  currentLayer: string;
  targetLayer: string;
  frequency: number;
  badPattern: string;
  fixHint: string;
  lastSeenAt: string;
}

/**
 * Check for error patterns that have exceeded their current layer's threshold.
 * Returns patterns eligible for promotion to a lower (more preventive) layer.
 */
export function checkPromotionCandidates(): PromotionCandidate[] {
  const candidates: PromotionCandidate[] = [];

  // Patterns at "prompt" layer with frequency >= GUARDRAIL_THRESHOLD
  const promptCandidates = sqlite
    .prepare(
      `SELECT id, pattern, category, layer, frequency, bad_pattern, fix_hint, last_seen_at
       FROM error_patterns
       WHERE layer = 'prompt' AND frequency >= ?
       ORDER BY frequency DESC`,
    )
    .all(GUARDRAIL_THRESHOLD) as Array<{
    id: string;
    pattern: string;
    category: string;
    layer: string;
    frequency: number;
    bad_pattern: string;
    fix_hint: string;
    last_seen_at: string;
  }>;

  for (const p of promptCandidates) {
    candidates.push({
      id: p.id,
      pattern: p.pattern,
      category: p.category,
      currentLayer: "prompt",
      targetLayer: p.frequency >= TEMPLATE_THRESHOLD ? "template" : "guardrail",
      frequency: p.frequency,
      badPattern: p.bad_pattern,
      fixHint: p.fix_hint,
      lastSeenAt: p.last_seen_at,
    });
  }

  // Patterns at "guardrail" layer with frequency >= TEMPLATE_THRESHOLD
  const guardrailCandidates = sqlite
    .prepare(
      `SELECT id, pattern, category, layer, frequency, bad_pattern, fix_hint, last_seen_at
       FROM error_patterns
       WHERE layer = 'guardrail' AND frequency >= ?
       ORDER BY frequency DESC`,
    )
    .all(TEMPLATE_THRESHOLD) as Array<{
    id: string;
    pattern: string;
    category: string;
    layer: string;
    frequency: number;
    bad_pattern: string;
    fix_hint: string;
    last_seen_at: string;
  }>;

  for (const p of guardrailCandidates) {
    candidates.push({
      id: p.id,
      pattern: p.pattern,
      category: p.category,
      currentLayer: "guardrail",
      targetLayer: "template",
      frequency: p.frequency,
      badPattern: p.bad_pattern,
      fixHint: p.fix_hint,
      lastSeenAt: p.last_seen_at,
    });
  }

  return candidates;
}

/**
 * Promote a pattern to a lower defensive layer.
 * This is an admin action — it just updates the `layer` field.
 * Actual guardrail/template implementation must be done manually.
 */
export function promotePattern(patternId: string, targetLayer: "guardrail" | "template"): boolean {
  try {
    const result = sqlite
      .prepare("UPDATE error_patterns SET layer = ? WHERE id = ?")
      .run(targetLayer, patternId);

    if (result.changes > 0) {
      logger.info("error-lifecycle", `Promoted pattern ${patternId} to layer: ${targetLayer}`);
      return true;
    }
    return false;
  } catch (err) {
    logger.warn("error-lifecycle", `Failed to promote pattern: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/**
 * Get summary statistics for all error patterns.
 */
export function getErrorStats(): {
  total: number;
  byLayer: Record<string, number>;
  byCategory: Record<string, number>;
  promotionCandidates: number;
} {
  const total = (sqlite.prepare("SELECT COUNT(*) as count FROM error_patterns").get() as { count: number }).count;

  const layerRows = sqlite.prepare("SELECT layer, COUNT(*) as count FROM error_patterns GROUP BY layer").all() as Array<{ layer: string; count: number }>;
  const byLayer: Record<string, number> = {};
  for (const row of layerRows) byLayer[row.layer] = row.count;

  const catRows = sqlite.prepare("SELECT category, COUNT(*) as count FROM error_patterns GROUP BY category").all() as Array<{ category: string; count: number }>;
  const byCategory: Record<string, number> = {};
  for (const row of catRows) byCategory[row.category] = row.count;

  const promotionCandidates = checkPromotionCandidates().length;

  return { total, byLayer, byCategory, promotionCandidates };
}
