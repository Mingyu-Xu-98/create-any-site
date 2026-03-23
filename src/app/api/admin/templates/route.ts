import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { templates } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

// GET /api/admin/templates
export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const all = await db.select().from(templates).orderBy(desc(templates.createdAt));
  return NextResponse.json({ templates: all });
}

// POST /api/admin/templates
export async function POST(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, category, siteType, theme, layout, previewImage, previewUrl, fileMap, featured } = body;

  if (!name || !category || !siteType) {
    return NextResponse.json({ error: "name, category, siteType required" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(templates).values({
    id,
    name,
    description: description || "",
    category: category || "other",
    siteType: siteType || "portfolio",
    theme: theme || "minimalist",
    layout: layout || "card-grid",
    previewImage: previewImage || null,
    previewUrl: previewUrl || null,
    fileMap: fileMap ? JSON.stringify(fileMap) : null,
    popularity: 0,
    featured: featured ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id });
}
