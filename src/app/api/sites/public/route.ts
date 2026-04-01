import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sites } from "@/lib/db/schema";
import { eq, and, isNotNull, desc } from "drizzle-orm";

/** GET /api/sites/public — list publicly shared sites (no auth required) */
export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || "12"), 50);

  const publicSites = await db
    .select({
      id: sites.id,
      name: sites.name,
      publishedUrl: sites.publishedUrl,
      publicDesc: sites.publicDesc,
      theme: sites.theme,
      siteType: sites.siteType,
      publishedAt: sites.publishedAt,
    })
    .from(sites)
    .where(
      and(
        eq(sites.isPublic, 1),
        eq(sites.status, "published"),
        isNotNull(sites.publishedUrl),
      ),
    )
    .orderBy(desc(sites.publishedAt))
    .limit(limit);

  return NextResponse.json({ sites: publicSites });
}
