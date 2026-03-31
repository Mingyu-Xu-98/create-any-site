import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { siteBuilds, sites } from "@/lib/db/schema";
import { scheduleBuildJob } from "@/lib/build-queue";
import type { WorkspaceData, UserSelections } from "@/lib/types";

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
    const body = await req.json() as {
      data: WorkspaceData;
      selections: UserSelections;
      siteId?: string;
      siteName?: string;
      prd?: unknown;
      spec?: import("@/lib/site-spec").SiteSpec;
      knowledgeRefs?: unknown[];
    };

    const { data, selections, siteId: inputSiteId, siteName, prd, spec, knowledgeRefs } = body;
    if (!data || !selections) {
      return NextResponse.json({ error: "Missing data or selections" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const siteId = inputSiteId || crypto.randomUUID();
    const previewBaseUrl = getPreviewBaseUrl(req);

    if (!inputSiteId) {
      await db.insert(sites).values({
        id: siteId,
        userId: session.user.id,
        slug: nanoid(10),
        name: siteName || `${data.name || "My"} - ${(selections.siteType || "portfolio")}`,
        siteType: selections.siteType || "portfolio",
        theme: selections.theme || "cyberpunk",
        layout: selections.layout || "card-grid",
        workspaceData: JSON.stringify(data),
        selections: JSON.stringify(selections),
        status: "draft",
        buildStatus: "queued",
        buildError: null,
        prd: prd ? JSON.stringify(prd) : null,
        editorState: JSON.stringify({ compiledSpec: spec || null, knowledgeRefs: Array.isArray(knowledgeRefs) ? knowledgeRefs : [] }),
        createdAt: now,
        updatedAt: now,
      });
    } else {
      const existingSite = await db.select({ id: sites.id }).from(sites)
        .where(and(eq(sites.id, siteId), eq(sites.userId, session.user.id)))
        .get();
      if (!existingSite) {
        return NextResponse.json({ error: "Site not found" }, { status: 404 });
      }

      await db.update(sites).set({
        name: siteName || data.name || "My Site",
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
        userId: session.user.id,
      }),
      createdAt: now,
      updatedAt: now,
    });

    scheduleBuildJob(jobId);

    return NextResponse.json({ ok: true, jobId, siteId, status: "queued" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
