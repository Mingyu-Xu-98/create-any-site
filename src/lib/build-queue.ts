import { eq } from "drizzle-orm";
import { db, sqlite } from "@/lib/db";
import { siteBuilds, sites } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { runSiteBuild, summarizeBuildOutput } from "@/lib/build-runtime";
import type { WorkspaceData, UserSelections } from "@/lib/types";

interface BuildPayload {
  data: WorkspaceData;
  selections: UserSelections;
  spec?: { sections?: Array<{ id?: string; type?: string; enabled?: boolean }> } | null;
  prd?: unknown;
  previewBaseUrl: string;
  knowledgeRefs?: unknown[];
}

const runningJobs = new Set<string>();

export function shouldInlineBuildJobs(): boolean {
  if (process.env.BUILD_INLINE_JOBS === "1") return true;
  if (process.env.BUILD_INLINE_JOBS === "0") return false;
  return process.env.NODE_ENV !== "production";
}

export function scheduleBuildJob(jobId: string) {
  if (!shouldInlineBuildJobs()) return;
  if (runningJobs.has(jobId)) return;
  runningJobs.add(jobId);
  setTimeout(() => {
    void processBuildJob(jobId).finally(() => {
      runningJobs.delete(jobId);
    });
  }, 0);
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

  if (!options?.alreadyClaimed) {
    await db.update(siteBuilds).set({ status: "building", startedAt: now, updatedAt: now, error: null, logs: null }).where(eq(siteBuilds.id, jobId));
    await db.update(sites).set({ buildStatus: "building", buildError: null, updatedAt: now }).where(eq(sites.id, job.siteId));
  }

  try {
    const payload = JSON.parse(job.payload) as BuildPayload;
    const result = await runSiteBuild({
      siteId: job.siteId,
      data: payload.data,
      selections: payload.selections,
      spec: payload.spec || null,
      previewBaseUrl: payload.previewBaseUrl,
      requestId,
    });

    const finishedAt = new Date().toISOString();
    await db.update(siteBuilds).set({
      status: "ready",
      previewUrl: result.url,
      finishedAt,
      updatedAt: finishedAt,
      logs: JSON.stringify(result.verification?.checks || []),
    }).where(eq(siteBuilds.id, jobId));

    await db.update(sites).set({
      previewUrl: result.url,
      workspaceData: JSON.stringify(payload.data),
      selections: JSON.stringify(payload.selections),
      fileMap: JSON.stringify(result.fileMap),
      prd: payload.prd ? JSON.stringify(payload.prd) : null,
      editorState: JSON.stringify({ compiledSpec: payload.spec || null, knowledgeRefs: Array.isArray(payload.knowledgeRefs) ? payload.knowledgeRefs : [] }),
      buildStatus: "ready",
      buildError: null,
      lastBuiltAt: finishedAt,
      updatedAt: finishedAt,
    }).where(eq(sites.id, job.siteId));
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
  }
}

export async function claimNextQueuedBuildJob(): Promise<string | null> {
  const now = new Date().toISOString();
  const claim = sqlite.transaction(() => {
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
