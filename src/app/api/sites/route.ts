import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sites, conversations } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

// GET /api/sites - List current user's sites
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userSites = await db
    .select({
      id: sites.id,
      slug: sites.slug,
      name: sites.name,
      siteType: sites.siteType,
      theme: sites.theme,
      layout: sites.layout,
      status: sites.status,
      createdAt: sites.createdAt,
      updatedAt: sites.updatedAt,
    })
    .from(sites)
    .where(eq(sites.userId, session.user.id))
    .orderBy(desc(sites.createdAt));

  // Attach conversationId to each site
  const sitesWithConv = await Promise.all(
    userSites.map(async (s) => {
      const conv = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.siteId, s.id)).get();
      return { ...s, conversationId: conv?.id || null };
    })
  );

  return NextResponse.json({ sites: sitesWithConv });
}

// POST /api/sites - Create a new site
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, siteType, theme, layout, workspaceData, selections, fileMap, previewUrl } = body;

  if (!name || !siteType || !theme || !layout) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const slug = nanoid(10);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(sites).values({
    id,
    userId: session.user.id,
    slug,
    name,
    siteType,
    theme,
    layout,
    workspaceData: workspaceData ? JSON.stringify(workspaceData) : null,
    selections: selections ? JSON.stringify(selections) : null,
    fileMap: fileMap ? JSON.stringify(fileMap) : null,
    status: "draft",
    previewUrl: previewUrl || null,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id, slug });
}
