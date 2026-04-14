import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { siteBuilds, sites } from "@/lib/db/schema";
import { scheduleBuildJob } from "@/lib/build-queue";
import { ensureStaticServer } from "@/lib/build-runtime";
import type { WorkspaceData, UserSelections } from "@/lib/types";
import { internalError } from "@/lib/api-errors";
import { checkQuota } from "@/lib/usage";

function getPreviewBaseUrl(req: NextRequest): string {
  const configured = process.env.PREVIEW_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const hostHeader = forwardedHost || req.headers.get("host") || req.nextUrl.host;
  const protocol = forwardedProto || req.nextUrl.protocol.replace(":", "") || "http";
  const hostname = hostHeader.replace(/:\d+$/, "");
  return `${protocol}://${hostname}:3002`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Quota check — build action
    const quota = await checkQuota(session.user.id, "build");
    if (!quota.allowed) {
      return NextResponse.json({ error: quota.reason, quota: true, upgradeHint: quota.upgradeHint }, { status: 429 });
    }

    // Ensure the static preview server is running (no-op if already up)
    void ensureStaticServer();

    const body = await req.json() as {
      data: WorkspaceData;
      selections: UserSelections;
      siteId?: string;
      siteName?: string;
      prd?: unknown;
      spec?: import("@/lib/site-spec").SiteSpec;
      knowledgeRefs?: unknown[];
      knowledgeBaseId?: string;
      knowledgeBaseIds?: string[];
    };

    const { data, selections, siteId: inputSiteId, siteName, prd, spec, knowledgeRefs, knowledgeBaseId } = body;
    const knowledgeBaseIds: string[] = Array.isArray(body.knowledgeBaseIds) ? body.knowledgeBaseIds : (knowledgeBaseId ? [knowledgeBaseId] : []);
    if (!data || !selections) {
      return NextResponse.json({ error: "Missing data or selections" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const siteId = inputSiteId || crypto.randomUUID();
    const previewBaseUrl = getPreviewBaseUrl(req);
    let isNew = true;

    if (inputSiteId) {
      // Existing site — verify ownership, update selections
      const existingSite = await db.select({ id: sites.id }).from(sites)
        .where(and(eq(sites.id, siteId), eq(sites.userId, session.user.id)))
        .get();
      if (!existingSite) {
        return NextResponse.json({ error: "Site not found" }, { status: 404 });
      }
      isNew = false;

      await db.update(sites).set({
        siteType: selections.siteType || "portfolio",
        theme: selections.theme || "cyberpunk",
        layout: selections.layout || "card-grid",
        workspaceData: JSON.stringify(data),
        selections: JSON.stringify(selections),
        buildStatus: "queued",
        buildError: null,
        prd: prd ? JSON.stringify(prd) : null,
        editorState: JSON.stringify({ compiledSpec: spec || null, knowledgeRefs: Array.isArray(knowledgeRefs) ? knowledgeRefs : [] }),
        updatedAt: now,
      }).where(and(eq(sites.id, siteId), eq(sites.userId, session.user.id)));
    } else {
      // New site: insert a minimal placeholder row so site_builds FK is satisfied.
      // On build success, build-queue will populate the full record.
      // On build failure, build-queue will DELETE this row so it never shows on the dashboard.
      await db.insert(sites).values({
        id: siteId,
        userId: session.user.id,
        slug: crypto.randomUUID().slice(0, 10),
        name: siteName || `${data.name || "My"} - ${selections.siteType || "portfolio"}`,
        siteType: selections.siteType || "portfolio",
        theme: selections.theme || "cyberpunk",
        layout: selections.layout || "card-grid",
        status: "draft",
        buildStatus: "queued",
        workspaceData: JSON.stringify(data),
        selections: JSON.stringify(selections),
        createdAt: now,
        updatedAt: now,
      });
    }

    const jobId = crypto.randomUUID();
    await db.insert(siteBuilds).values({
      id: jobId,
      siteId,
      userId: session.user.id,
      status: "queued",
      payload: JSON.stringify({
        data,
        selections,
        spec: spec || null,
        prd: prd || null,
        previewBaseUrl,
        knowledgeRefs: Array.isArray(knowledgeRefs) ? knowledgeRefs : [],
        knowledgeBaseId: knowledgeBaseIds[0] || undefined,
        knowledgeBaseIds,
        userId: session.user.id,
        // New: pass site creation metadata so build-queue can create the site on success
        isNew,
        siteName: siteName || `${data.name || "My"} - ${(selections.siteType || "portfolio")}`,
      }),
      createdAt: now,
      updatedAt: now,
    });

    scheduleBuildJob(jobId);

    return NextResponse.json({ ok: true, jobId, siteId, isNew, status: "queued" });
  } catch (err) {
    return internalError(err, "generate");
  }
}
