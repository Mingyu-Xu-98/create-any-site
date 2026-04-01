import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { siteBuilds, sites } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { logger } from "@/lib/logger";
import { syncDraftPreview, hasPublishedPreviewDirectory, rewriteExportAssetPaths } from "@/lib/build-runtime";
import { runCodeGuardrails } from "@/lib/code-guardrails";

const SITES_DIR = path.join(process.cwd(), "sites-data");
const TRANSLATIONS_FILE = "src/i18n/translations.ts";

function getPreviewUrl(siteId: string): string {
  const base = (process.env.PREVIEW_BASE_URL?.trim() || "http://localhost:3002").replace(/\/+$/, "");
  return process.env.PREVIEW_PUBLISH_DIR?.trim()
    ? `${base}/drafts/${siteId}`
    : `${base}/${siteId}`;
}

function normalizeTranslationsModule(content: string, fallback: string): string {
  const trimmed = content.trim().replace(/^```(?:ts|typescript|json)?\s*/i, "").replace(/\s*```$/, "").trim();
  if (trimmed.includes("export const translations")) return trimmed;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && ("zh" in parsed || "en" in parsed)) {
      return `export const translations = ${JSON.stringify(parsed, null, 2)};\n\nexport type Lang = keyof typeof translations;\nexport type Translations = typeof translations.zh;\n`;
    }
  } catch {}

  return fallback;
}

function getBuildEnv(): NodeJS.ProcessEnv {
  const buildEnv = { ...process.env, NODE_ENV: "production" } as NodeJS.ProcessEnv;
  delete buildEnv.TURBOPACK;
  delete buildEnv.NEXT_DISABLE_TURBOPACK;
  return buildEnv;
}

function summarizeBuildOutput(stdout: string, stderr: string): string[] {
  const merged = `${stderr || ""}\n${stdout || ""}`
    .split("\n")
    .map((line) => line.replace(/\u001b\[[0-9;]*m/g, "").trim())
    .filter(Boolean);

  const important = merged.filter((line) =>
    /error|failed|module not found|type error|syntaxerror|can't resolve|panic|operation not permitted/i.test(line),
  );

  const lines = (important.length > 0 ? important : merged).slice(-12);
  return Array.from(new Set(lines));
}

interface FileChange {
  file: string;
  action: "replace" | "create" | "delete";
  content?: string;
}

async function runVerification(siteDir: string, spec?: { sections?: Array<{ id?: string; type?: string; enabled?: boolean }>; pages?: Array<{ route?: string; sections: Array<{ id?: string; type?: string; enabled?: boolean }> }> }) {
  const checks: Array<{ label: string; ok: boolean }> = [];
  const outIndex = path.join(siteDir, "out", "index.html");

  try {
    const html = await fs.readFile(outIndex, "utf-8");
    checks.push({ label: "Static export index.html exists", ok: html.length > 0 });

    // Check flat sections
    const allSections = spec?.pages?.flatMap(p => p.sections) || spec?.sections || [];
    for (const section of allSections.filter(item => item.enabled !== false)) {
      const sectionId = section.id || section.type;
      if (!sectionId) continue;
      const anchorId = sectionId === "timeline" ? "experience" : sectionId;
      checks.push({
        label: `Rendered section anchor: ${sectionId}`,
        ok: html.includes(`id="${anchorId}"`) || html.includes(`id='${anchorId}'`) || html.includes(`#${anchorId}`),
      });
    }

    // Check multi-page routes
    if (spec?.pages) {
      for (const page of spec.pages) {
        if (!page.route || page.route === "/") continue;
        const routeDir = page.route.replace(/^\//, "");
        const routeIndex = path.join(siteDir, "out", routeDir, "index.html");
        try {
          const routeHtml = await fs.readFile(routeIndex, "utf-8");
          checks.push({ label: `Multi-page route: /${routeDir}`, ok: routeHtml.length > 0 });
        } catch {
          checks.push({ label: `Multi-page route: /${routeDir}`, ok: false });
        }
      }
    }
  } catch {
    checks.push({ label: "Static export index.html exists", ok: false });
  }

  return {
    ok: checks.every(check => check.ok),
    checks,
  };
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { siteId, changes, spec, prd, knowledgeRefs } = await req.json() as {
      siteId: string;
      changes: FileChange[];
      spec?: { sections?: Array<{ id?: string; type?: string; enabled?: boolean }> };
      prd?: unknown;
      knowledgeRefs?: unknown[];
    };
    if (!siteId || !Array.isArray(changes) || changes.length === 0) {
      return NextResponse.json({ error: "siteId and changes required" }, { status: 400 });
    }

    logger.info("modify", `[${requestId}] Modifying site ${siteId}: ${changes.length} changes`);

    // Load current fileMap from DB
    const site = await db.select({ fileMap: sites.fileMap, draftBuildId: sites.draftBuildId, previewUrl: sites.previewUrl }).from(sites)
      .where(and(eq(sites.id, siteId), eq(sites.userId, session.user.id))).get();

    let fileMap: Record<string, string> = {};
    if (site?.draftBuildId) {
      const latestBuild = await db.select({ fileMapSnapshot: siteBuilds.fileMapSnapshot }).from(siteBuilds)
        .where(and(eq(siteBuilds.id, site.draftBuildId), eq(siteBuilds.siteId, siteId))).get();
      if (latestBuild?.fileMapSnapshot) {
        try { fileMap = JSON.parse(latestBuild.fileMapSnapshot); } catch {}
      }
    }
    if (site?.fileMap) {
      try { fileMap = { ...JSON.parse(site.fileMap), ...fileMap }; } catch {}
    }

    const siteDir = path.join(SITES_DIR, siteId);

    // Apply each change
    const applied: string[] = [];
    for (const change of changes) {
      const filePath = change.file;
      const fullPath = path.join(siteDir, filePath);

      if (change.action === "delete") {
        delete fileMap[filePath];
        try { await fs.unlink(fullPath); } catch {}
        applied.push(`deleted: ${filePath}`);
      } else if (change.action === "replace" || change.action === "create") {
        if (!change.content) continue;

        // Validate critical files — reject truncated/partial content that would break the build
        if (filePath === "src/app/page.tsx" && change.action === "replace") {
          const c = change.content;
          if (!c.includes("export default") || !c.includes("return")) {
            logger.warn("modify", `[${requestId}] Rejected truncated page.tsx replacement (missing export default or return). Keeping original.`);
            applied.push(`rejected: ${filePath} (truncated content)`);
            continue;
          }
        }

        const nextContent = filePath === TRANSLATIONS_FILE
          ? normalizeTranslationsModule(change.content, fileMap[filePath] || "")
          : change.content;
        fileMap[filePath] = nextContent;
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, nextContent, "utf-8");
        applied.push(`${change.action}: ${filePath}`);
      }
    }

    // Save updated fileMap back to DB
    await db.update(sites).set({
      fileMap: JSON.stringify(fileMap),
      editorState: JSON.stringify({ compiledSpec: spec || null, knowledgeRefs: Array.isArray(knowledgeRefs) ? knowledgeRefs : [] }),
      prd: prd ? JSON.stringify(prd) : undefined,
      updatedAt: new Date().toISOString(),
    }).where(eq(sites.id, siteId));

    logger.info("modify", `[${requestId}] Applied ${applied.length} changes, running guardrails...`, { applied });

    // Run code guardrails on modified files (fixes translations exports, SharePoster, JSX issues, etc.)
    const previewBaseUrl = (process.env.PREVIEW_BASE_URL?.trim() || "http://localhost:3002").replace(/\/+$/, "");
    const guarded = runCodeGuardrails(fileMap, siteId, previewBaseUrl, logger);
    // Write any guardrail-fixed files back to disk
    for (const [filePath, content] of Object.entries(guarded)) {
      if (content !== fileMap[filePath]) {
        const fullPath = path.join(siteDir, filePath);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content, "utf-8");
      }
    }
    Object.assign(fileMap, guarded);

    // Rebuild static export after modification
    let buildSuccess = true;
    let buildError = "";
    let buildLogs: string[] = [];
    let verification: { ok: boolean; checks: Array<{ label: string; ok: boolean }> } | null = null;
    try {
      const nextBin = path.join(siteDir, "node_modules", "next", "dist", "bin", "next");
      await new Promise<void>((resolve, reject) => {
        exec(`"${nextBin}" build --webpack`, { cwd: siteDir, timeout: 180_000, env: getBuildEnv() }, (err, stdout, stderr) => {
          if (err) { logger.warn("modify", `Rebuild failed: ${err.message}`); reject(Object.assign(err, { stdout, stderr })); }
          else { logger.info("modify", "Rebuild complete"); resolve(); }
        });
      });
      // Rewrite asset paths for static preview (same as first build does)
      const outDir = path.join(siteDir, "out");
      if (!hasPublishedPreviewDirectory()) {
        await rewriteExportAssetPaths(outDir, "", `/${siteId}`);
      }
      await syncDraftPreview(siteId, siteDir);
      verification = await runVerification(siteDir, spec);
      await db.update(sites).set({
        previewUrl: site?.previewUrl || getPreviewUrl(siteId),
        buildStatus: "ready",
        buildError: null,
        updatedAt: new Date().toISOString(),
      }).where(eq(sites.id, siteId));
    } catch (buildErr) {
      buildSuccess = false;
      buildError = buildErr instanceof Error ? buildErr.message : "Build failed";
      buildLogs = summarizeBuildOutput(
        (buildErr as { stdout?: string })?.stdout || "",
        (buildErr as { stderr?: string })?.stderr || "",
      );
      await db.update(sites).set({
        buildStatus: "failed",
        buildError,
        updatedAt: new Date().toISOString(),
      }).where(eq(sites.id, siteId));
    }

    return NextResponse.json({ ok: true, applied, buildSuccess, buildError: buildError || undefined, buildLogs, verification });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error("modify", `[${requestId}] Failed: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
