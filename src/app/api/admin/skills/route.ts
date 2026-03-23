import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { desc, eq, like, or } from "drizzle-orm";

// GET /api/admin/skills - List all skills with optional search/filter
export async function GET(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const search = searchParams.get("search");

  let query = db.select().from(skills);

  if (category && category !== "all") {
    query = query.where(eq(skills.category, category)) as typeof query;
  }

  if (search) {
    query = query.where(
      or(
        like(skills.name, `%${search}%`),
        like(skills.description, `%${search}%`)
      )
    ) as typeof query;
  }

  const result = await query.orderBy(desc(skills.createdAt));

  return NextResponse.json({ skills: result });
}

// POST /api/admin/skills - Create a new skill
export async function POST(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, category, content, siteTypes, templates, enabled } = body;

  if (!name || !category || !content) {
    return NextResponse.json({ error: "name, category, and content are required" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(skills).values({
    id,
    name,
    description: description || "",
    category,
    content,
    siteTypes: siteTypes ? JSON.stringify(siteTypes) : "[]",
    templates: templates ? JSON.stringify(templates) : "[]",
    enabled: enabled !== false ? 1 : 0,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id });
}
