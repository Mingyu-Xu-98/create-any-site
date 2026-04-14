/**
 * Edit Runtime — orchestrates the secondary edit flow.
 *
 * Flow:
 * 1. Create edit_sessions row
 * 2. Classify intent
 * 3. Load relevant files from site's fileMap
 * 4. Call Edit Agent
 * 5. Apply changes to fileMap + write to disk
 * 6. Run guardrails + build
 * 7. Update session with result
 * 8. On failure: retry with error context (max 2 retries)
 */
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { db, sqlite } from "@/lib/db";
import { editSessions, sites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { classifyEditIntent, getFileScopeForIntent } from "@/lib/edit-classifier";
import { runEditAgent, type FileChange } from "@/lib/edit-agent";
import { runCodeGuardrails, runAdvancedModeGuardrails } from "@/lib/code-guardrails";
import { recordBuildError } from "@/lib/error-collector";
import { resolveSiteDir } from "@/lib/site-paths";
import { summarizeBuildOutput, syncDraftPreview, ALLOWED_DEPENDENCIES } from "@/lib/build-runtime";
import { logger } from "@/lib/logger";

const MAX_EDIT_RETRIES = 2;

export interface EditSessionResult {
  sessionId: string;
  status: "completed" | "failed";
  changes: FileChange[];
  summary: string;
  buildSuccess: boolean;
  buildError?: string;
  previewUrl?: string;
}

export interface RunEditSessionInput {
  siteId: string;
  userId: string;
  instruction: string;
  maxRetries?: number;
}

export async function runEditSession(input: RunEditSessionInput): Promise<EditSessionResult> {
  const { siteId, userId, instruction, maxRetries = MAX_EDIT_RETRIES } = input;

  // 1. Get site and its fileMap
  const site = await db.select({
    fileMap: sites.fileMap,
    draftBuildId: sites.draftBuildId,
  }).from(sites).where(eq(sites.id, siteId)).get();

  if (!site) {
    throw new Error("Site not found");
  }

  let fileMap: Record<string, string>;

  if (site.fileMap) {
    fileMap = JSON.parse(site.fileMap);
  } else {
    // Fallback: reconstruct fileMap from disk
    logger.warn("edit-runtime", `Site ${siteId} has no fileMap in DB, reconstructing from disk...`);
    const siteDir = await resolveSiteDir(siteId);
    const srcDir = path.join(siteDir, "src");
    const recovered: Record<string, string> = {};
    const scanFiles = ["src/app/page.tsx", "src/app/layout.tsx", "src/app/globals.css", "src/i18n/translations.ts"];
    for (const filePath of scanFiles) {
      try {
        recovered[filePath] = await fs.readFile(path.join(siteDir, filePath), "utf-8");
      } catch { /* file doesn't exist */ }
    }
    if (Object.keys(recovered).length === 0) {
      throw new Error("Site has no fileMap and no source files on disk — cannot edit");
    }
    fileMap = recovered;
    // Save reconstructed fileMap to DB for future edits
    await db.update(sites)
      .set({ fileMap: JSON.stringify(recovered), updatedAt: new Date().toISOString() })
      .where(eq(sites.id, siteId));
    logger.info("edit-runtime", `Reconstructed fileMap for site ${siteId}: ${Object.keys(recovered).join(", ")}`);
  }

  // ---------- AUTOFIX fast-path: run guardrails before Edit Agent ----------
  if (instruction === "__AUTOFIX__") {
    return runAutofixSession({ siteId, userId, fileMap, draftBuildId: site.draftBuildId || null });
  }

  // 2. Create edit session
  const sessionId = crypto.randomUUID();
  const intent = classifyEditIntent(instruction);
  const now = new Date().toISOString();

  sqlite.prepare(
    `INSERT INTO edit_sessions (id, site_id, user_id, status, intent, instruction, build_id_before, created_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`
  ).run(sessionId, siteId, userId, intent, instruction, site.draftBuildId || null, now);

  logger.info("edit-runtime", `[${sessionId}] Starting edit: intent=${intent}, instruction="${instruction.slice(0, 80)}"`);

  // 3. Extract relevant files based on intent
  const fileScope = getFileScopeForIntent(intent);
  const currentFiles: Record<string, string> = {};
  for (const filePath of fileScope) {
    if (fileMap[filePath]) {
      currentFiles[filePath] = fileMap[filePath];
    }
  }

  // 4. Call Edit Agent with retry loop
  let changes: FileChange[] = [];
  let summary = "";
  let buildSuccess = false;
  let buildError: string | undefined;
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Call Edit Agent
    const editResult = await runEditAgent({
      instruction,
      intent,
      currentFiles: attempt === 0 ? currentFiles : currentFiles, // On retry, use original files
      buildError: lastError,
      userId,
      siteId,
    });

    if (!editResult.valid || editResult.changes.length === 0) {
      logger.warn("edit-runtime", `[${sessionId}] Edit Agent produced no valid changes (attempt ${attempt + 1})`);
      if (attempt >= maxRetries) {
        buildError = "Edit Agent could not produce valid changes";
        break;
      }
      continue;
    }

    changes = editResult.changes;
    summary = editResult.summary;

    // 5. Apply changes to fileMap
    const updatedFileMap = { ...fileMap };
    for (const change of changes) {
      updatedFileMap[change.path] = change.content;
    }

    // 6. Run guardrails
    const previewBaseUrl = (process.env.PREVIEW_BASE_URL?.trim() || "http://localhost:3002").replace(/\/+$/, "");
    const guardedResult = runCodeGuardrails(updatedFileMap, siteId, previewBaseUrl, logger);
    const guardedFiles = guardedResult.files;
    runAdvancedModeGuardrails(guardedFiles, ALLOWED_DEPENDENCIES, logger);

    // 7. Write files to disk and build
    const siteDir = await resolveSiteDir(siteId);
    try {
      // Write only changed files
      for (const change of changes) {
        const fullPath = path.join(siteDir, change.path);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, guardedFiles[change.path] || change.content, "utf-8");
      }

      // Also write any guardrail-fixed files
      for (const [filePath, content] of Object.entries(guardedFiles)) {
        if (content !== updatedFileMap[filePath]) {
          const fullPath = path.join(siteDir, filePath);
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, content, "utf-8");
        }
      }

      // Build
      await runNextBuild(siteDir);
      buildSuccess = true;

      // Update site fileMap
      await db.update(sites)
        .set({
          fileMap: JSON.stringify(guardedFiles),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(sites.id, siteId));

      // Sync preview
      const PREVIEW_PUBLISH_DIR = process.env.PREVIEW_PUBLISH_DIR?.trim() || "";
      if (PREVIEW_PUBLISH_DIR) {
        await syncDraftPreview(siteId, siteDir);
      }

      logger.info("edit-runtime", `[${sessionId}] Edit succeeded on attempt ${attempt + 1}`);
      break;
    } catch (err) {
      const errObj = err as { stdout?: string; stderr?: string; message?: string };
      const stderrText = errObj.stderr || "";
      const stdoutText = errObj.stdout || "";
      const errSummary = summarizeBuildOutput(stdoutText, stderrText).join("\n");
      lastError = errSummary || errObj.message || "unknown build error";
      buildError = lastError;

      // Record to error memory
      recordBuildError(lastError, { siteId, theme: undefined, siteType: undefined });

      logger.warn("edit-runtime", `[${sessionId}] Build failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.slice(0, 300)}`);

      if (attempt >= maxRetries) {
        logger.error("edit-runtime", `[${sessionId}] All retries exhausted`);
      }
    }
  }

  // 8. Update session
  const completedAt = new Date().toISOString();
  sqlite.prepare(
    `UPDATE edit_sessions SET
      status = ?,
      changes = ?,
      build_success = ?,
      build_error = ?,
      completed_at = ?
     WHERE id = ?`
  ).run(
    buildSuccess ? "completed" : "failed",
    JSON.stringify(changes),
    buildSuccess ? 1 : 0,
    buildError || null,
    completedAt,
    sessionId,
  );

  return {
    sessionId,
    status: buildSuccess ? "completed" : "failed",
    changes,
    summary,
    buildSuccess,
    buildError,
  };
}

// ---------------------------------------------------------------------------
// AUTOFIX: deterministic guardrails → rebuild → fallback to Edit Agent
// ---------------------------------------------------------------------------

async function runAutofixSession(opts: {
  siteId: string;
  userId: string;
  fileMap: Record<string, string>;
  draftBuildId: string | null;
}): Promise<EditSessionResult> {
  const { siteId, userId, fileMap, draftBuildId } = opts;

  // Read the site's existing build error for context
  const siteRow = await db.select({ buildError: sites.buildError }).from(sites).where(eq(sites.id, siteId)).get();
  const existingBuildError = siteRow?.buildError || "";
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();

  sqlite.prepare(
    `INSERT INTO edit_sessions (id, site_id, user_id, status, intent, instruction, build_id_before, created_at)
     VALUES (?, ?, ?, 'active', 'fix', '__AUTOFIX__', ?, ?)`
  ).run(sessionId, siteId, userId, draftBuildId, now);

  logger.info("edit-runtime", `[${sessionId}] AUTOFIX: running deterministic guardrails...`);

  // 1. Run code guardrails on current fileMap
  const previewBaseUrl = (process.env.PREVIEW_BASE_URL?.trim() || "http://localhost:3002").replace(/\/+$/, "");
  const guardedResult = runCodeGuardrails({ ...fileMap }, siteId, previewBaseUrl, logger);
  const guardedFiles = guardedResult.files;

  // 2. Run advanced mode guardrails (page.tsx syntax, trailing junk, etc.)
  runAdvancedModeGuardrails(guardedFiles, ALLOWED_DEPENDENCIES, logger);

  // 3. Detect which files changed
  const changes: FileChange[] = [];
  for (const [filePath, content] of Object.entries(guardedFiles)) {
    if (content !== fileMap[filePath]) {
      changes.push({ path: filePath, content });
    }
  }

  logger.info("edit-runtime", `[${sessionId}] AUTOFIX: ${changes.length} file(s) fixed by guardrails`);

  // 4. Write fixed files and try build
  const siteDir = await resolveSiteDir(siteId);
  let buildSuccess = false;
  let buildError: string | undefined;

  try {
    for (const change of changes) {
      const fullPath = path.join(siteDir, change.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, change.content, "utf-8");
    }

    await runNextBuild(siteDir);
    buildSuccess = true;

    // Update site fileMap
    await db.update(sites)
      .set({
        fileMap: JSON.stringify(guardedFiles),
        buildStatus: "ready",
        buildError: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(sites.id, siteId));

    // Sync preview
    const PREVIEW_PUBLISH_DIR = process.env.PREVIEW_PUBLISH_DIR?.trim() || "";
    if (PREVIEW_PUBLISH_DIR) {
      await syncDraftPreview(siteId, siteDir);
    }

    logger.info("edit-runtime", `[${sessionId}] AUTOFIX: build succeeded with guardrails-only fixes`);
  } catch (err) {
    const errObj = err as { stdout?: string; stderr?: string; message?: string };
    const stderrText = errObj.stderr || "";
    const stdoutText = errObj.stdout || "";
    const errSummary = summarizeBuildOutput(stdoutText, stderrText).join("\n");
    buildError = errSummary || errObj.message || "unknown build error";

    logger.warn("edit-runtime", `[${sessionId}] AUTOFIX: guardrails-only build failed, falling through to Edit Agent`);
  }

  // 5. If guardrails alone didn't fix it, fall through to Edit Agent
  if (!buildSuccess) {
    // Persist guardrail fixes to fileMap so they aren't lost
    if (changes.length > 0) {
      await db.update(sites)
        .set({ fileMap: JSON.stringify(guardedFiles), updatedAt: new Date().toISOString() })
        .where(eq(sites.id, siteId));
    }

    logger.info("edit-runtime", `[${sessionId}] AUTOFIX: delegating to Edit Agent with error context`);

    const fallbackResult = await runEditSession({
      siteId,
      userId,
      instruction: `检查并修复页面中的构建错误。错误信息：\n${buildError || existingBuildError || "Turbopack build failed"}`,
      maxRetries: MAX_EDIT_RETRIES,
    });

    // Update our autofix session with the final result
    const completedAt = new Date().toISOString();
    sqlite.prepare(
      `UPDATE edit_sessions SET status = ?, changes = ?, build_success = ?, build_error = ?, completed_at = ? WHERE id = ?`
    ).run(
      fallbackResult.buildSuccess ? "completed" : "failed",
      JSON.stringify([...changes, ...fallbackResult.changes]),
      fallbackResult.buildSuccess ? 1 : 0,
      fallbackResult.buildError || null,
      completedAt,
      sessionId,
    );

    return {
      sessionId,
      status: fallbackResult.buildSuccess ? "completed" : "failed",
      changes: [...changes, ...fallbackResult.changes],
      summary: `自动修复：guardrails 修复了 ${changes.length} 个文件${fallbackResult.buildSuccess ? "，Edit Agent 修复了剩余问题" : "，但仍有错误未解决"}`,
      buildSuccess: fallbackResult.buildSuccess,
      buildError: fallbackResult.buildError,
      previewUrl: fallbackResult.previewUrl,
    };
  }

  // Guardrails-only fix succeeded
  const completedAt = new Date().toISOString();
  sqlite.prepare(
    `UPDATE edit_sessions SET status = 'completed', changes = ?, build_success = 1, completed_at = ? WHERE id = ?`
  ).run(JSON.stringify(changes), completedAt, sessionId);

  return {
    sessionId,
    status: "completed",
    changes,
    summary: `自动修复完成：guardrails 修复了 ${changes.length} 个文件`,
    buildSuccess: true,
  };
}

// ---------------------------------------------------------------------------
// Internal: run `next build`
// ---------------------------------------------------------------------------

function runNextBuild(siteDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, NODE_ENV: "production" as const };
    exec("npx next build", { cwd: siteDir, env, timeout: 120_000 }, (err: any, stdout: any, stderr: any) => {
      if (err) {
        reject(Object.assign(err, { stdout, stderr }));
      } else {
        resolve();
      }
    });
  });
}
