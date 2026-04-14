/**
 * Usage Tracking — records LLM token consumption per user per call.
 *
 * Design: record everything, restrict nothing (for now).
 * The checkQuota() stub is pre-wired so limits can be enabled later
 * by uncommenting the checks — zero code change in API routes.
 */
import { db } from "@/lib/db";
import { usageLogs, userQuotas } from "@/lib/db/schema";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { logger } from "@/lib/logger";

// ---- Types ----

export interface UsageRecord {
  action: "llm_call" | "build" | "file_upload" | "entity_extract" | "relation_infer";
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  durationMs?: number;
  label?: string;
  siteId?: string;
  status?: "success" | "error";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  remaining?: number;
  upgradeHint?: string;
}

export interface UserUsageSummary {
  plan: string;
  monthlyTokenLimit: number;
  monthlyBuildLimit: number;
  currentMonthTokens: number;
  currentMonthBuilds: number;
  currentStorageMb: number;
  storageLimitMb: number;
  tokenUsagePercent: number;
  buildUsagePercent: number;
}

// ---- Record Usage ----

/**
 * Record a usage event. Async, fire-and-forget — never blocks the caller.
 */
export async function recordUsage(userId: string, record: UsageRecord): Promise<void> {
  try {
    await db.insert(usageLogs).values({
      userId,
      action: record.action,
      provider: record.provider || null,
      model: record.model || null,
      inputTokens: record.inputTokens || 0,
      outputTokens: record.outputTokens || 0,
      totalTokens: record.totalTokens || 0,
      durationMs: record.durationMs || null,
      label: record.label || null,
      siteId: record.siteId || null,
      status: record.status || "success",
      errorMessage: record.errorMessage || null,
      metadata: record.metadata ? JSON.stringify(record.metadata) : null,
    });

    // Update monthly accumulators
    const tokenDelta = record.totalTokens || 0;
    const buildDelta = record.action === "build" ? 1 : 0;

    if (tokenDelta > 0 || buildDelta > 0) {
      await ensureQuota(userId);
      await maybeResetPeriod(userId);
      await db.update(userQuotas).set({
        currentMonthTokens: sql`current_month_tokens + ${tokenDelta}`,
        currentMonthBuilds: sql`current_month_builds + ${buildDelta}`,
        updatedAt: new Date().toISOString(),
      }).where(eq(userQuotas.userId, userId));
    }
  } catch (err) {
    logger.warn("usage", `Record failed for ${userId}: ${err instanceof Error ? err.message : "unknown"}`);
  }
}

// ---- Quota Management ----

/**
 * Ensure a quota row exists for user. Creates default free quota if missing.
 */
export async function ensureQuota(userId: string): Promise<void> {
  const existing = await db.select({ id: userQuotas.id })
    .from(userQuotas).where(eq(userQuotas.userId, userId)).get();
  if (!existing) {
    try {
      await db.insert(userQuotas).values({ userId });
    } catch {
      // Race condition: another request already created it
    }
  }
}

/**
 * Reset monthly counters if we've crossed into a new calendar month.
 */
export async function maybeResetPeriod(userId: string): Promise<void> {
  const quota = await db.select({ periodStart: userQuotas.periodStart })
    .from(userQuotas).where(eq(userQuotas.userId, userId)).get();
  if (!quota?.periodStart) return;

  const now = new Date();
  const period = new Date(quota.periodStart);
  const sameMonth = now.getFullYear() === period.getFullYear()
    && now.getMonth() === period.getMonth();

  if (!sameMonth) {
    await db.update(userQuotas).set({
      currentMonthTokens: 0,
      currentMonthBuilds: 0,
      periodStart: now.toISOString(),
      updatedAt: now.toISOString(),
    }).where(eq(userQuotas.userId, userId));
  }
}

// ---- Quota Check (stub — always allows, uncomment to enforce) ----

export async function checkQuota(
  userId: string,
  _action: "llm_call" | "build" | "file_upload",
): Promise<QuotaCheckResult> {
  // Currently disabled — usage is still recorded via recordUsage().
  // When an external points/credits system is ready, replace this
  // function body with an API call:
  //
  //   const resp = await fetch(POINTS_API_URL + "/check", {
  //     method: "POST",
  //     headers: { "Authorization": `Bearer ${POINTS_API_KEY}` },
  //     body: JSON.stringify({ userId, action, ... }),
  //   });
  //   const { allowed, remaining, reason } = await resp.json();
  //   return { allowed, remaining, reason };
  //
  // The call sites (chat-build, generate, ingestion, kb/files) are
  // already wired — no route changes needed when enabling this.
  return { allowed: true };
}

// ---- Query Helpers ----

export async function getUserUsageSummary(userId: string): Promise<UserUsageSummary> {
  await ensureQuota(userId);
  await maybeResetPeriod(userId);

  const quota = await db.select().from(userQuotas)
    .where(eq(userQuotas.userId, userId)).get();

  if (!quota) {
    return {
      plan: "free", monthlyTokenLimit: 500000, monthlyBuildLimit: 20,
      currentMonthTokens: 0, currentMonthBuilds: 0,
      currentStorageMb: 0, storageLimitMb: 100,
      tokenUsagePercent: 0, buildUsagePercent: 0,
    };
  }

  return {
    plan: quota.plan,
    monthlyTokenLimit: quota.monthlyTokenLimit,
    monthlyBuildLimit: quota.monthlyBuildLimit,
    currentMonthTokens: quota.currentMonthTokens,
    currentMonthBuilds: quota.currentMonthBuilds,
    currentStorageMb: quota.currentStorageMb,
    storageLimitMb: quota.storageLimitMb,
    tokenUsagePercent: quota.monthlyTokenLimit > 0
      ? Math.round(quota.currentMonthTokens / quota.monthlyTokenLimit * 100) : 0,
    buildUsagePercent: quota.monthlyBuildLimit > 0
      ? Math.round(quota.currentMonthBuilds / quota.monthlyBuildLimit * 100) : 0,
  };
}

/**
 * Get recent usage logs for a user (for admin detail page).
 */
export async function getRecentLogs(userId: string, limit = 50) {
  return db.select({
    id: usageLogs.id,
    action: usageLogs.action,
    provider: usageLogs.provider,
    model: usageLogs.model,
    inputTokens: usageLogs.inputTokens,
    outputTokens: usageLogs.outputTokens,
    totalTokens: usageLogs.totalTokens,
    durationMs: usageLogs.durationMs,
    label: usageLogs.label,
    siteId: usageLogs.siteId,
    status: usageLogs.status,
    createdAt: usageLogs.createdAt,
  }).from(usageLogs)
    .where(eq(usageLogs.userId, userId))
    .orderBy(desc(usageLogs.createdAt))
    .limit(limit);
}

/**
 * Aggregate token usage by label (for admin charts).
 */
export async function getLabelBreakdown(userId: string) {
  return db.select({
    label: usageLogs.label,
    totalTokens: sql<number>`sum(total_tokens)`,
    callCount: sql<number>`count(*)`,
  }).from(usageLogs)
    .where(and(
      eq(usageLogs.userId, userId),
      eq(usageLogs.action, "llm_call"),
    ))
    .groupBy(usageLogs.label)
    .orderBy(sql`sum(total_tokens) desc`);
}

/**
 * Global usage stats (for admin dashboard).
 */
export async function getGlobalUsageStats() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStr = monthStart.toISOString();

  const [todayStats] = await db.select({
    tokens: sql<number>`coalesce(sum(total_tokens), 0)`,
    calls: sql<number>`count(*)`,
    builds: sql<number>`sum(case when action = 'build' then 1 else 0 end)`,
  }).from(usageLogs).where(gte(usageLogs.createdAt, todayStr));

  const [monthStats] = await db.select({
    tokens: sql<number>`coalesce(sum(total_tokens), 0)`,
    calls: sql<number>`count(*)`,
    builds: sql<number>`sum(case when action = 'build' then 1 else 0 end)`,
  }).from(usageLogs).where(gte(usageLogs.createdAt, monthStr));

  return {
    todayTokens: todayStats?.tokens || 0,
    todayCalls: todayStats?.calls || 0,
    todayBuilds: todayStats?.builds || 0,
    monthTokens: monthStats?.tokens || 0,
    monthCalls: monthStats?.calls || 0,
    monthBuilds: monthStats?.builds || 0,
  };
}
