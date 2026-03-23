import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { users, sites, skills, knowledgeItems, templates } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [siteCount] = await db.select({ count: sql<number>`count(*)` }).from(sites);
  const [skillCount] = await db.select({ count: sql<number>`count(*)` }).from(skills);
  const [knowledgeCount] = await db.select({ count: sql<number>`count(*)` }).from(knowledgeItems);
  const [templateCount] = await db.select({ count: sql<number>`count(*)` }).from(templates);

  return NextResponse.json({
    users: userCount.count,
    sites: siteCount.count,
    skills: skillCount.count,
    knowledgeItems: knowledgeCount.count,
    templates: templateCount.count,
  });
}
