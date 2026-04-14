import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, sqlite } from "@/lib/db";
import { siteBuilds, sites, conversations } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { runSiteBuild, summarizeBuildOutput, cleanupOldBuilds } from "@/lib/build-runtime";
import type { WorkspaceData, UserSelections } from "@/lib/types";
import { recordUsage } from "@/lib/usage";

interface BuildPayload {
  data: WorkspaceData;
  selections: UserSelections;
  spec?: import("./site-spec").SiteSpec | null;
  prd?: unknown;
  previewBaseUrl: string;
  knowledgeRefs?: unknown[];
  knowledgeBaseId?: string;
  knowledgeBaseIds?: string[];
  userId?: string;
  isNew?: boolean;
  siteName?: string;
}

const runningJobs = new Set<string>();
let kickScheduled = false;

/** Write an incremental build step to the job's logs column so the frontend can show progress. */
async function updateBuildStep(jobId: string, step: string) {
  try {
    const now = new Date().toISOString();
    const job = await db.select({ logs: siteBuilds.logs }).from(siteBuilds).where(eq(siteBuilds.id, jobId)).get();
    const steps: string[] = job?.logs ? JSON.parse(job.logs) : [];
    steps.push(step);
    await db.update(siteBuilds).set({ logs: JSON.stringify(steps), updatedAt: now }).where(eq(siteBuilds.id, jobId));
  } catch {
    // Non-critical — don't let progress reporting break the build
  }
}

function getBuildConcurrency(): number {
  const raw = Number.parseInt(process.env.BUILD_MAX_CONCURRENCY || "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 2;
}

export function shouldInlineBuildJobs(): boolean {
  if (process.env.BUILD_INLINE_JOBS === "1") return true;
  if (process.env.BUILD_INLINE_JOBS === "0") return false;
  return process.env.NODE_ENV !== "production";
}

async function kickInlineBuildQueue() {
  if (!shouldInlineBuildJobs()) return;
  if (kickScheduled) return;
  kickScheduled = true;

  try {
    while (runningJobs.size < getBuildConcurrency()) {
      const nextJobId = await claimNextQueuedBuildJob();
      if (!nextJobId) break;
      if (runningJobs.has(nextJobId)) continue;

      runningJobs.add(nextJobId);
      setTimeout(() => {
        void processBuildJob(nextJobId, { alreadyClaimed: true }).finally(() => {
          runningJobs.delete(nextJobId);
          void kickInlineBuildQueue();
        });
      }, 0);
    }
  } finally {
    kickScheduled = false;
  }
}

export function scheduleBuildJob(_jobId: string) {
  void kickInlineBuildQueue();
}

export async function processBuildJob(jobId: string, options?: { alreadyClaimed?: boolean }) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  const job = await db.select().from(siteBuilds).where(eq(siteBuilds.id, jobId)).get();
  if (!job) return;
  if (options?.alreadyClaimed) {
    if (job.status !== "building") return;
  } else {
    if (job.status !== "queued") return;
  }

  let payload: BuildPayload;
  let isNewSite = false;
  try {
    payload = JSON.parse(job.payload) as BuildPayload;
    isNewSite = payload.isNew === true;
  } catch {
    const finishedAt = new Date().toISOString();
    logger.error("build-queue", `[${requestId}] Job ${jobId} failed: invalid payload JSON`);
    await db.update(siteBuilds).set({ status: "failed", error: "Invalid payload JSON", finishedAt, updatedAt: finishedAt }).where(eq(siteBuilds.id, jobId));
    await db.update(sites).set({ buildStatus: "failed", buildError: "Invalid payload JSON", updatedAt: finishedAt }).where(eq(sites.id, job.siteId));
    return;
  }

  if (!options?.alreadyClaimed) {
    await db.update(siteBuilds).set({ status: "building", startedAt: now, updatedAt: now, error: null, logs: null }).where(eq(siteBuilds.id, jobId));
    await db.update(sites).set({ buildStatus: "building", buildError: null, updatedAt: now }).where(eq(sites.id, job.siteId));
  }

  try {
    // 15 minutes. Generous enough to accommodate up to 2 auto-retries of the
    // Code Agent + staticBuild cycle when the first generation produces
    // code that fails `next build`. A single pass typically finishes in
    // 2–4 minutes; each retry adds roughly another 2–4 minutes.
    const BUILD_TIMEOUT_MS = 900_000;

    const buildPromise = runSiteBuild({
      siteId: job.siteId,
      buildId: jobId,
      userId: payload.userId,
      data: payload.data,
      selections: payload.selections,
      spec: payload.spec || null,
      previewBaseUrl: payload.previewBaseUrl,
      knowledgeBaseId: payload.knowledgeBaseId,
      knowledgeBaseIds: payload.knowledgeBaseIds,
      requestId,
      onProgress: (step: string) => updateBuildStep(jobId, step),
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Build timeout: exceeded ${BUILD_TIMEOUT_MS / 1000}s`)), BUILD_TIMEOUT_MS)
    );

    const result = await Promise.race([buildPromise, timeoutPromise]);

    const finishedAt = new Date().toISOString();
    await db.update(siteBuilds).set({
      status: "ready",
      previewUrl: result.url,
      fileMapSnapshot: JSON.stringify(result.fileMap),
      specSnapshot: payload.spec ? JSON.stringify(payload.spec) : null,
      prdSnapshot: payload.prd ? JSON.stringify(payload.prd) : null,
      knowledgeRefsSnapshot: JSON.stringify({
        knowledgeRefs: Array.isArray(payload.knowledgeRefs) ? payload.knowledgeRefs : [],
        compositionPlan: payload.selections?.compositionPlan || null,
        userId: payload.userId || null,
      }),
      finishedAt,
      updatedAt: finishedAt,
      logs: JSON.stringify(result.verification?.checks || []),
    }).where(eq(siteBuilds.id, jobId));

    const siteFields = {
      previewUrl: result.url,
      workspaceData: JSON.stringify(payload.data),
      selections: JSON.stringify(payload.selections),
      fileMap: JSON.stringify(result.fileMap),
      draftBuildId: jobId,
      prd: payload.prd ? JSON.stringify(payload.prd) : null,
      editorState: JSON.stringify({ compiledSpec: payload.spec || null, knowledgeRefs: Array.isArray(payload.knowledgeRefs) ? payload.knowledgeRefs : [] }),
      buildStatus: "ready",
      buildError: null,
      lastBuiltAt: finishedAt,
      updatedAt: finishedAt,
    };

    if (isNewSite) {
      // First successful build: populate the placeholder site record
      await db.update(sites).set({
        slug: nanoid(10),
        name: payload.siteName || `${payload.data?.name || "My"} - ${payload.selections?.siteType || "portfolio"}`,
        siteType: payload.selections?.siteType || "portfolio",
        theme: payload.selections?.theme || "cyberpunk",
        layout: payload.selections?.layout || "card-grid",
        status: "draft",
        ...siteFields,
      }).where(eq(sites.id, job.siteId));
    } else {
      await db.update(sites).set(siteFields).where(eq(sites.id, job.siteId));
    }

    // Record build usage for quota tracking
    void recordUsage(job.userId, {
      action: "build",
      label: "site-build",
      siteId: job.siteId,
      durationMs: Date.now() - new Date(now).getTime(),
    }).catch(() => {});

    // Build succeeded — delete the build conversation.
    // All build state (spec, PRD, fileMap, selections) is already persisted
    // on sites + site_builds tables. The conversation is only chat history
    // and is no longer needed. This forces future edits through the
    // dedicated edit workspace instead of a stale, context-polluted chat.
    try {
      await db.delete(conversations).where(eq(conversations.siteId, job.siteId));
    } catch {
      // Non-critical — don't let conversation cleanup fail the build
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const stdout = (err as { stdout?: string })?.stdout || "";
    const stderr = (err as { stderr?: string })?.stderr || "";
    const logs = summarizeBuildOutput(stdout, stderr);
    const finishedAt = new Date().toISOString();

    logger.error("build-queue", `[${requestId}] Job ${jobId} failed: ${message}`);

    await db.update(siteBuilds).set({
      status: "failed",
      error: message,
      logs: JSON.stringify(logs),
      finishedAt,
      updatedAt: finishedAt,
    }).where(eq(siteBuilds.id, jobId));

    await db.update(sites).set({
      buildStatus: "failed",
      buildError: message,
      updatedAt: finishedAt,
    }).where(eq(sites.id, job.siteId));
  } finally {
    // Clean up old build directories (fire-and-forget)
    void cleanupOldBuilds(job.siteId).catch(() => {});

    if (shouldInlineBuildJobs()) {
      void kickInlineBuildQueue();
    }
  }
}

export async function claimNextQueuedBuildJob(): Promise<string | null> {
  const now = new Date().toISOString();
  const claim = sqlite.transaction(() => {
    const buildingCount = sqlite.prepare(`
      SELECT COUNT(*) as count
      FROM site_builds
      WHERE status = 'building'
    `).get() as { count: number } | undefined;

    if ((buildingCount?.count || 0) >= getBuildConcurrency()) {
      return null;
    }

    const next = sqlite.prepare(`
      SELECT id, site_id
      FROM site_builds
      WHERE status = 'queued'
      ORDER BY created_at ASC
      LIMIT 1
    `).get() as { id: string; site_id: string } | undefined;

    if (!next) return null;

    const updateJob = sqlite.prepare(`
      UPDATE site_builds
      SET status = 'building', started_at = ?, updated_at = ?, error = NULL, logs = NULL
      WHERE id = ? AND status = 'queued'
    `).run(now, now, next.id);

    if (updateJob.changes === 0) return null;

    sqlite.prepare(`
      UPDATE sites
      SET build_status = 'building', build_error = NULL, updated_at = ?
      WHERE id = ?
    `).run(now, next.site_id);

    return next.id;
  });

  return claim();
}
