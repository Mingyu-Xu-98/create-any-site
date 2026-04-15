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
import { editSessions, sites, siteBuilds, knowledgeFiles as knowledgeFilesTable } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { classifyEditIntent, getFileScopeForIntent } from "@/lib/edit-classifier";
import { runEditAgent, type FileChange } from "@/lib/edit-agent";
import { tryFastPath } from "@/lib/edit-fast-paths";
import { runCodeGuardrails, runAdvancedModeGuardrails } from "@/lib/code-guardrails";
import { recordBuildError } from "@/lib/error-collector";
import { resolveSiteDir } from "@/lib/site-paths";
import { siteRoot, siteCurrentLink } from "@/lib/site-paths";
import { summarizeBuildOutput, syncDraftPreview, rewriteExportAssetPaths, ALLOWED_DEPENDENCIES } from "@/lib/build-runtime";
import { copyUserImagesToSite } from "@/lib/asset-store";
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
  /** True when the edit was handled by a deterministic fast path (no LLM). */
  fastPath?: boolean;
}

export interface RunEditSessionInput {
  siteId: string;
  userId: string;
  instruction: string;
  maxRetries?: number;
}

// ---------------------------------------------------------------------------
// Version management — create a site_builds record after successful edit
// ---------------------------------------------------------------------------

async function createEditBuildRecord(opts: {
  siteId: string;
  userId: string;
  fileMap: Record<string, string>;
  intent: string;
  instruction: string;
}): Promise<string> {
  const buildId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(siteBuilds).values({
    id: buildId,
    siteId: opts.siteId,
    userId: opts.userId,
    status: "ready",
    payload: JSON.stringify({
      type: "edit",
      intent: opts.intent,
      instruction: opts.instruction.slice(0, 200),
    }),
    fileMapSnapshot: JSON.stringify(opts.fileMap),
    startedAt: now,
    finishedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return buildId;
}

export async function runEditSession(input: RunEditSessionInput): Promise<EditSessionResult> {
  const { siteId, userId, instruction, maxRetries = MAX_EDIT_RETRIES } = input;

  // 0. Concurrent edit lock — reject if another active session exists
  const STALE_SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  const activeSession = sqlite.prepare(
    `SELECT id, created_at FROM edit_sessions WHERE site_id = ? AND status = 'active' LIMIT 1`
  ).get(siteId) as { id: string; created_at: string } | undefined;
  if (activeSession) {
    const age = Date.now() - new Date(activeSession.created_at).getTime();
    if (age < STALE_SESSION_TIMEOUT_MS) {
      throw new Error("CONCURRENT_EDIT: 该站点正在编辑中，请稍后再试");
    }
    // Stale session — mark as failed so we can proceed
    sqlite.prepare(
      `UPDATE edit_sessions SET status = 'failed', build_error = 'session timeout', completed_at = ? WHERE id = ?`
    ).run(new Date().toISOString(), activeSession.id);
    logger.warn("edit-runtime", `Expired stale active session ${activeSession.id} (${Math.round(age / 1000)}s old)`);
  }

  // 1. Get site and its fileMap — verify ownership
  const site = await db.select({
    fileMap: sites.fileMap,
    draftBuildId: sites.draftBuildId,
  }).from(sites).where(and(eq(sites.id, siteId), eq(sites.userId, userId))).get();

  if (!site) {
    throw new Error("Site not found or access denied");
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

  // ---------- Deterministic fast-path: skip LLM for simple transforms ----------
  const fpIntent = classifyEditIntent(instruction);
  const fastResult = tryFastPath(instruction, fpIntent, fileMap);
  let existingSessionId: string | undefined;
  if (fastResult) {
    logger.info("edit-runtime", `Fast-path matched for "${instruction.slice(0, 60)}" (${fastResult.changes.length} file(s))`);
    const fpResult = await runFastPathSession({
      siteId, userId, fileMap, intent: fpIntent, instruction,
      changes: fastResult.changes,
      summary: fastResult.summary,
      draftBuildId: site.draftBuildId || null,
    });
    if (fpResult.buildSuccess) return fpResult;
    // Fast-path build failed → reuse its session ID for the full Edit Agent flow
    existingSessionId = fpResult.sessionId;
    logger.warn("edit-runtime", `Fast-path build failed, falling through to Edit Agent (reusing session ${existingSessionId})`);
  }

  // 2. Create edit session (or reuse fast-path session if it failed)
  const sessionId = existingSessionId || crypto.randomUUID();
  const intent = classifyEditIntent(instruction);
  const now = new Date().toISOString();

  const fileMapBeforeJson = JSON.stringify(fileMap);
  if (existingSessionId) {
    // Reuse fast-path session — reset it for the full edit flow
    sqlite.prepare(
      `UPDATE edit_sessions SET status = 'active', intent = ?, build_error = NULL WHERE id = ?`
    ).run(intent, existingSessionId);
  } else {
    // Store pre-edit fileMap snapshot for undo
    sqlite.prepare(
      `INSERT INTO edit_sessions (id, site_id, user_id, status, intent, instruction, build_id_before, file_map_before, created_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)`
    ).run(sessionId, siteId, userId, intent, instruction, site.draftBuildId || null, fileMapBeforeJson, now);
  }

  logger.info("edit-runtime", `[${sessionId}] Starting edit: intent=${intent}, instruction="${instruction.slice(0, 80)}"`);

  // 3. Extract relevant files based on intent
  const fileScope = getFileScopeForIntent(intent);
  const currentFiles: Record<string, string> = {};
  for (const filePath of fileScope) {
    if (fileMap[filePath]) {
      currentFiles[filePath] = fileMap[filePath];
    }
  }

  // 3b. Always load KB context when user has KB data — let the LLM decide what to use.
  //     Previously gated by keyword regex, but that's fragile: every new module
  //     type would need new keywords, and misses are silent. The KB payload is
  //     small (≤15 KB) so the extra tokens are negligible compared to a missed edit.
  let kbContext = "";
  if (userId) {
    try {
      const { loadFullKBContext, formatFilesForPrompt } = await import("./kb-loader");
      const kbCtx = await loadFullKBContext(userId);
      if (kbCtx.fileCount > 0) {
        const sorted = new Map([...kbCtx.fileContents.entries()].slice(0, 20));
        kbContext = formatFilesForPrompt(sorted, 15000);
        logger.info("edit-runtime", `[${sessionId}] Loaded KB context: ${kbCtx.fileCount} files, ${kbContext.length} chars`);
      }
    } catch (err) {
      logger.warn("edit-runtime", `[${sessionId}] Failed to load KB context: ${(err as Error).message}`);
    }
  }

  // 3c. Load user image metadata so Edit Agent knows what images are available
  let imageContext = "";
  const userImages: Array<{ name: string; assetPath: string; description: string | null; usageTag: string | null }> = [];
  if (userId) {
    try {
      const images = await db.select({
        name: knowledgeFilesTable.name,
        assetPath: knowledgeFilesTable.assetPath,
        description: knowledgeFilesTable.description,
        usageTag: knowledgeFilesTable.usageTag,
      }).from(knowledgeFilesTable).where(
        and(eq(knowledgeFilesTable.userId, userId), eq(knowledgeFilesTable.type, "image"))
      );
      for (const img of images) {
        if (img.assetPath) {
          userImages.push({ name: img.name, assetPath: img.assetPath, description: img.description, usageTag: img.usageTag });
        }
      }
      if (userImages.length > 0) {
        imageContext = "## Available User Images\n" + userImages.map(img =>
          `- /images/${img.assetPath} — ${img.description || img.name}${img.usageTag ? ` [${img.usageTag}]` : ""}`
        ).join("\n");
      }
    } catch {
      // Non-critical
    }
  }

  // 3d. Check if instruction wants image generation
  const wantsImageGen = /生成.*图片|生成.*图像|重新生成.*头像|重新生成.*背景|生成.*avatar|generate.*image|new.*avatar|new.*background/i.test(instruction);

  // 4. Call Edit Agent with retry loop
  let changes: FileChange[] = [];
  let summary = "";
  let buildSuccess = false;
  let buildError: string | undefined;
  let lastError: string | undefined;
  let editBuildId: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // On ANY retry, expand to full "fix" scope — the extra tokens are much
    // cheaper than another failed build.  Edit Agent sees everything and can
    // fix cross-file issues (missing translations, broken imports, etc.).
    if (attempt > 0) {
      const fixScope = getFileScopeForIntent("fix");
      let expanded = false;
      for (const fp of fixScope) {
        if (!currentFiles[fp] && fileMap[fp]) {
          currentFiles[fp] = fileMap[fp];
          expanded = true;
        }
      }
      if (expanded) {
        logger.info("edit-runtime", `[${sessionId}] Expanded file scope to fix-level for retry ${attempt}`);
      }
    }

    // Call Edit Agent
    const editResult = await runEditAgent({
      instruction,
      intent,
      currentFiles,
      buildError: lastError,
      kbContext: kbContext || undefined,
      imageContext: imageContext || undefined,
      userId,
      siteId,
    });

    if (!editResult.valid || editResult.changes.length === 0) {
      logger.warn("edit-runtime", `[${sessionId}] Edit Agent produced no valid changes (attempt ${attempt + 1})`);
      if (attempt >= maxRetries) {
        buildError = "AI 未能生成有效的代码修改，请尝试更具体的描述（例如：把标题颜色改为蓝色、在 hero 区域添加一个按钮）";
        summary = editResult.summary || buildError;
        break;
      }
      // On retry, add a hint to the instruction asking for COMPLETE code output
      if (!lastError) {
        lastError = "Previous attempt was REJECTED because it contained placeholder comments like '// ... remains the same ...' instead of actual code. You MUST output COMPLETE files with ALL code — no abbreviations, no placeholders. Every single line must be real, executable code.";
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

    // 7. Write ALL files to disk and build
    //    Must sync the entire fileMap — previous failed edits may have left
    //    dirty files on disk that differ from the DB fileMap.
    const siteDir = await resolveSiteDir(siteId);
    try {
      await syncFileMapToDisk(siteDir, guardedFiles);

      // Copy user-uploaded images BEFORE build so Next.js copies them to out/images/
      // (initial build in build-runtime.ts does this at line ~1621, before staticBuild)
      if (userId && userImages.length > 0) {
        try {
          const tagMap = new Map<string, string>();
          for (const img of userImages) {
            if (img.usageTag) tagMap.set(img.assetPath, img.usageTag);
          }
          const imgCount = await copyUserImagesToSite(userId, siteDir, tagMap.size > 0 ? tagMap : undefined);
          if (imgCount > 0) logger.info("edit-runtime", `[${sessionId}] Copied ${imgCount} user image(s) to public/images/ (pre-build)`);
        } catch (err) {
          logger.warn("edit-runtime", `[${sessionId}] copyUserImagesToSite (pre-build) failed: ${(err as Error).message}`);
        }
      }

      // Build
      await runNextBuild(siteDir);
      buildSuccess = true;
      buildError = undefined; // Clear error from earlier failed attempts

      // Create a build record for this edit (version identity)
      editBuildId = await createEditBuildRecord({
        siteId, userId, fileMap: guardedFiles, intent, instruction,
      });

      // Update site fileMap + advance draftBuildId
      await db.update(sites)
        .set({
          fileMap: JSON.stringify(guardedFiles),
          draftBuildId: editBuildId,
          buildStatus: "ready",
          buildError: null,
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(sites.id, siteId), eq(sites.userId, userId)));

      // AI image generation (when user explicitly asks to generate/regenerate images)
      if (wantsImageGen && userId) {
        try {
          await runEditImageGeneration(siteId, userId, instruction, sessionId);
        } catch (err) {
          logger.warn("edit-runtime", `[${sessionId}] Image generation failed (non-fatal): ${(err as Error).message}`);
        }
      }

      // Sync preview — rewrite asset paths so static server can route them
      // Initial build uses /drafts/{siteId} prefix for out/ (build-runtime.ts ~line 1809)
      // Static server routes /drafts/{siteId}/... → out/ directory
      const PREVIEW_PUBLISH_DIR = process.env.PREVIEW_PUBLISH_DIR?.trim() || "";
      if (PREVIEW_PUBLISH_DIR) {
        await syncDraftPreview(siteId, siteDir);
      } else {
        await rewriteExportAssetPaths(path.join(siteDir, "out"), "", `/drafts/${siteId}`);
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
      build_id_after = ?,
      build_success = ?,
      build_error = ?,
      completed_at = ?
     WHERE id = ?`
  ).run(
    buildSuccess ? "completed" : "failed",
    JSON.stringify(changes),
    editBuildId || null,
    buildSuccess ? 1 : 0,
    buildError || null,
    completedAt,
    sessionId,
  );

  // Fetch final previewUrl from DB
  const updatedSite = await db.select({ previewUrl: sites.previewUrl }).from(sites).where(eq(sites.id, siteId)).get();

  return {
    sessionId,
    status: buildSuccess ? "completed" : "failed",
    changes,
    summary: summary || (buildError ? `编辑失败: ${buildError}` : changes.length === 0 ? "AI 未能生成有效的代码修改" : ""),
    buildSuccess,
    buildError,
    previewUrl: updatedSite?.previewUrl || undefined,
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

  // Store pre-edit fileMap snapshot for undo
  const fileMapBeforeJson = JSON.stringify(fileMap);
  sqlite.prepare(
    `INSERT INTO edit_sessions (id, site_id, user_id, status, intent, instruction, build_id_before, file_map_before, created_at)
     VALUES (?, ?, ?, 'active', 'fix', '__AUTOFIX__', ?, ?, ?)`
  ).run(sessionId, siteId, userId, draftBuildId, fileMapBeforeJson, now);

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
  let autofixBuildId: string | undefined;

  try {
    // Sync ALL fileMap files to disk (guards against stale files from previous failed edits)
    await syncFileMapToDisk(siteDir, guardedFiles);

    await runNextBuild(siteDir);
    buildSuccess = true;

    // Create build record + update site
    const autofixBuildId = await createEditBuildRecord({
      siteId, userId, fileMap: guardedFiles, intent: "fix", instruction: "__AUTOFIX__",
    });
    await db.update(sites)
      .set({
        fileMap: JSON.stringify(guardedFiles),
        draftBuildId: autofixBuildId,
        buildStatus: "ready",
        buildError: null,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(sites.id, siteId), eq(sites.userId, userId)));

    // Sync preview — rewrite asset paths so static server can route them
    const PREVIEW_PUBLISH_DIR = process.env.PREVIEW_PUBLISH_DIR?.trim() || "";
    if (PREVIEW_PUBLISH_DIR) {
      await syncDraftPreview(siteId, siteDir);
    } else {
      await rewriteExportAssetPaths(path.join(siteDir, "out"), "", `/drafts/${siteId}`);
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
      instruction: `检查并修复页面中的构建错误。错误信息：\n${buildError || existingBuildError || "Build failed"}`,
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
    `UPDATE edit_sessions SET status = 'completed', changes = ?, build_id_after = ?, build_success = 1, completed_at = ? WHERE id = ?`
  ).run(JSON.stringify(changes), autofixBuildId, completedAt, sessionId);

  return {
    sessionId,
    status: "completed",
    changes,
    summary: `自动修复完成：guardrails 修复了 ${changes.length} 个文件`,
    buildSuccess: true,
  };
}

// ---------------------------------------------------------------------------
// FAST PATH: deterministic CSS/content transform → rebuild → fallback on fail
// ---------------------------------------------------------------------------

async function runFastPathSession(opts: {
  siteId: string;
  userId: string;
  fileMap: Record<string, string>;
  intent: string;
  instruction: string;
  changes: FileChange[];
  summary: string;
  draftBuildId: string | null;
}): Promise<EditSessionResult> {
  const { siteId, userId, fileMap, intent, instruction, changes, summary, draftBuildId } = opts;
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Store pre-edit fileMap snapshot for undo
  const fileMapBeforeJson = JSON.stringify(fileMap);
  sqlite.prepare(
    `INSERT INTO edit_sessions (id, site_id, user_id, status, intent, instruction, build_id_before, file_map_before, created_at)
     VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)`
  ).run(sessionId, siteId, userId, intent, instruction, draftBuildId, fileMapBeforeJson, now);

  logger.info("edit-runtime", `[${sessionId}] FAST-PATH: applying ${changes.length} change(s)...`);

  // 1. Apply changes to fileMap copy
  const updatedFileMap: Record<string, string> = { ...fileMap };
  for (const change of changes) {
    updatedFileMap[change.path] = change.content;
  }

  // 2. Run guardrails
  const previewBaseUrl = (process.env.PREVIEW_BASE_URL?.trim() || "http://localhost:3002").replace(/\/+$/, "");
  const guardedResult = runCodeGuardrails(updatedFileMap, siteId, previewBaseUrl, logger);
  const guardedFiles = guardedResult.files;
  runAdvancedModeGuardrails(guardedFiles, ALLOWED_DEPENDENCIES, logger);

  // 3. Write & build
  const siteDir = await resolveSiteDir(siteId);
  let buildSuccess = false;
  let buildError: string | undefined;
  let fpBuildId: string | undefined;

  try {
    // Sync ALL fileMap files to disk (guards against stale files from previous failed edits)
    await syncFileMapToDisk(siteDir, guardedFiles);

    await runNextBuild(siteDir);
    buildSuccess = true;

    // Create build record + update site
    const fpBuildId = await createEditBuildRecord({
      siteId, userId, fileMap: guardedFiles, intent, instruction,
    });
    await db.update(sites)
      .set({
        fileMap: JSON.stringify(guardedFiles),
        draftBuildId: fpBuildId,
        buildStatus: "ready",
        buildError: null,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(sites.id, siteId), eq(sites.userId, userId)));

    // Sync preview — rewrite asset paths so static server can route them
    const PREVIEW_PUBLISH_DIR = process.env.PREVIEW_PUBLISH_DIR?.trim() || "";
    if (PREVIEW_PUBLISH_DIR) {
      await syncDraftPreview(siteId, siteDir);
    } else {
      await rewriteExportAssetPaths(path.join(siteDir, "out"), "", `/drafts/${siteId}`);
    }

    logger.info("edit-runtime", `[${sessionId}] FAST-PATH: build succeeded`);
  } catch (err) {
    const errObj = err as { stdout?: string; stderr?: string; message?: string };
    const stderrText = errObj.stderr || "";
    const stdoutText = errObj.stdout || "";
    const errSummary = summarizeBuildOutput(stdoutText, stderrText).join("\n");
    buildError = errSummary || errObj.message || "unknown build error";
    logger.warn("edit-runtime", `[${sessionId}] FAST-PATH: build failed — ${buildError?.slice(0, 120)}`);
  }

  // 4. Update session
  const completedAt = new Date().toISOString();
  const fpBuildIdForSession = buildSuccess ? fpBuildId : undefined;
  sqlite.prepare(
    `UPDATE edit_sessions SET status = ?, changes = ?, build_id_after = ?, build_success = ?, build_error = ?, completed_at = ? WHERE id = ?`
  ).run(
    buildSuccess ? "completed" : "failed",
    JSON.stringify(changes),
    fpBuildIdForSession || null,
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
    fastPath: true,
  };
}

// ---------------------------------------------------------------------------
// Internal: AI image generation for edit flow
// ---------------------------------------------------------------------------

/** Detect which images the user wants regenerated and call the generate-image API. */
async function runEditImageGeneration(siteId: string, userId: string, instruction: string, sessionId: string) {
  const { getHeroImagePrompt, getImageTasks } = await import("./image-prompts");

  // Load site theme for prompt generation
  const siteRow = await db.select({ theme: sites.theme, name: sites.name })
    .from(sites).where(eq(sites.id, siteId)).get();
  const theme = (siteRow?.theme || "cyberpunk") as import("./types").ThemeStyle;
  const userName = siteRow?.name || "User";

  // Get all available image tasks for this theme
  const allImageTasks = getImageTasks(theme, userName, []);

  const tasks: Array<{ prompt: string; filename: string }> = [];

  // Detect which images to regenerate from instruction
  const wantsAvatar = /头像|avatar|个人照片|profile/i.test(instruction);
  const wantsHero = /背景|background|hero|banner/i.test(instruction);
  const wantsAll = /所有图片|all.*image|全部.*图/i.test(instruction);

  if (wantsAvatar || wantsAll) {
    const avatarTask = allImageTasks.find(t => t.filename === "avatar.png");
    if (avatarTask) tasks.push(avatarTask);
  }
  if (wantsHero || wantsAll) {
    const heroTask = allImageTasks.find(t => t.filename.includes("hero-bg") || t.filename.includes("background"));
    if (heroTask) tasks.push(heroTask);
    // Fallback: use getHeroImagePrompt directly
    if (!heroTask) {
      const heroPrompt = getHeroImagePrompt(theme);
      if (heroPrompt) tasks.push({ prompt: heroPrompt, filename: "hero-bg.png" });
    }
  }

  // If no specific type detected but user clearly wants images, regenerate both
  if (tasks.length === 0) {
    const avatarTask = allImageTasks.find(t => t.filename === "avatar.png");
    if (avatarTask) tasks.push(avatarTask);
    const heroPrompt = getHeroImagePrompt(theme);
    if (heroPrompt) tasks.push({ prompt: heroPrompt, filename: "hero-bg.png" });
  }

  if (tasks.length === 0) {
    logger.info("edit-runtime", `[${sessionId}] No image tasks for theme=${theme}`);
    return;
  }

  logger.info("edit-runtime", `[${sessionId}] Generating ${tasks.length} image(s): ${tasks.map(t => t.filename).join(", ")}`);

  // Call SiliconFlow image API directly (same logic as /api/generate-image)
  const apiKey = process.env.SILICONFLOW_API_KEY?.trim();
  if (!apiKey) {
    logger.warn("edit-runtime", `[${sessionId}] SILICONFLOW_API_KEY not set, skipping image generation`);
    return;
  }

  const imageModels = (process.env.SILICONFLOW_IMAGE_MODELS?.trim() || process.env.SILICONFLOW_IMAGE_MODEL?.trim() || "black-forest-labs/FLUX.1-schnell,Kwai-Kolors/Kolors")
    .split(",").map(s => s.trim()).filter(Boolean);

  const siteDir = siteRoot(siteId);
  const PREVIEW_PUBLISH_DIR = process.env.PREVIEW_PUBLISH_DIR?.trim() || "";

  await Promise.allSettled(tasks.map(async (task) => {
    const isSquare = task.filename === "avatar.png";

    for (const model of imageModels) {
      const imageSize = isSquare ? "1024x1024" : (model.toLowerCase().includes("kolors") ? "768x1024" : "1024x576");
      try {
        const response = await fetch("https://api.siliconflow.cn/v1/images/generations", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, prompt: task.prompt, image_size: imageSize, num_inference_steps: 20 }),
        });
        if (!response.ok) continue;

        const result = await response.json();
        const imageUrl = result.images?.[0]?.url;
        if (!imageUrl) continue;

        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) continue;

        const buffer = Buffer.from(await imgRes.arrayBuffer());

        // Write to all relevant directories
        const targetDirs = [
          path.join(siteDir, "public", "images"),
          path.join(siteCurrentLink(siteId), "out", "images"),
        ];
        if (PREVIEW_PUBLISH_DIR) {
          targetDirs.push(path.join(PREVIEW_PUBLISH_DIR, "drafts", siteId, "images"));
          targetDirs.push(path.join(PREVIEW_PUBLISH_DIR, siteId, "images"));
        }

        for (const dir of targetDirs) {
          try {
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(path.join(dir, task.filename), buffer);
          } catch { /* non-fatal */ }
        }

        logger.info("edit-runtime", `[${sessionId}] Generated ${task.filename} via ${model} (${buffer.length} bytes)`);
        return; // Success — stop trying models
      } catch {
        // Try next model
      }
    }
    logger.warn("edit-runtime", `[${sessionId}] Failed to generate ${task.filename} with all models`);
  }));
}

// ---------------------------------------------------------------------------
// Internal: sync ALL fileMap files to disk before building.
//
// Why?  The edit flow writes to disk, then builds.  If the build fails, dirty
// files stay on disk but the DB fileMap isn't updated.  A subsequent edit that
// only writes its OWN changed files leaves the old dirty files in place, and
// the build sees an inconsistent mix of DB-version and stale-disk-version code.
//
// Solution: before every build, write ALL fileMap files to ensure consistency.
// ---------------------------------------------------------------------------

async function syncFileMapToDisk(siteDir: string, fileMap: Record<string, string>): Promise<void> {
  const resolvedSiteDir = path.resolve(siteDir);
  for (const [filePath, content] of Object.entries(fileMap)) {
    const fullPath = path.resolve(siteDir, filePath);
    // Path traversal guard: reject paths that escape the site directory
    if (!fullPath.startsWith(resolvedSiteDir + path.sep) && fullPath !== resolvedSiteDir) {
      logger.warn("edit-runtime", `Path traversal blocked: ${filePath}`);
      continue;
    }
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf-8");
  }
}

// ---------------------------------------------------------------------------
// Internal: run `next build --webpack` (consistent with staticBuild in build-runtime.ts)
//
// Why --webpack?  Next.js 16 defaults to Turbopack, but Turbopack + output:"export"
// triggers an InvariantError on the synthetic /_global-error route and parse errors
// on some dynamically generated code.  The initial generation already uses --webpack;
// edits must too.
// ---------------------------------------------------------------------------

async function runNextBuild(siteDir: string): Promise<void> {
  // 1. Guarantee next.config.mjs is correct (guards against Code Agent overwriting it)
  const configContent = `const nextConfig = {\n  output: "export",\n  images: { unoptimized: true },\n};\nexport default nextConfig;`;

  for (const old of ["next.config.js", "next.config.ts", "next.config.cjs"]) {
    try { await fs.unlink(path.join(siteDir, old)); } catch {}
  }
  await fs.writeFile(path.join(siteDir, "next.config.mjs"), configContent, "utf-8");

  // 2. Run build with Webpack
  const nextBin = path.join(siteDir, "node_modules", "next", "dist", "bin", "next");
  const buildEnv = { ...process.env, NODE_ENV: "production" } as NodeJS.ProcessEnv;
  delete buildEnv.TURBOPACK;
  delete buildEnv.NEXT_DISABLE_TURBOPACK;

  return new Promise((resolve, reject) => {
    exec(`"${nextBin}" build --webpack`, {
      cwd: siteDir,
      env: buildEnv,
      timeout: 180_000,
    }, (err: any, stdout: any, stderr: any) => {
      if (err) {
        reject(Object.assign(err, { stdout, stderr }));
      } else {
        resolve();
      }
    });
  });
}
