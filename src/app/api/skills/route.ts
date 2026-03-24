import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

/**
 * GET /api/skills — Progressive skill loading for build-time AI
 *
 * Level 0 (default): returns {id, name, description, category, siteTypes} for ALL enabled skills
 *   → Builder AI reads all descriptions to decide which skills are relevant
 *
 * Level 1 (?ids=id1,id2&level=1): returns indexContent for specific skills
 *   → Builder AI reads the full instruction of selected skills
 *
 * Level 2 (?ids=id1&level=2): returns indexContent + references for a specific skill
 *   → Builder AI loads deep reference docs when needed
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const level = parseInt(searchParams.get("level") || "0");
  const ids = searchParams.get("ids")?.split(",").filter(Boolean);
  const siteType = searchParams.get("siteType");

  // Level 0: return all enabled skills' descriptions (lightweight)
  if (level === 0 || !ids) {
    const allSkills = await db
      .select({
        id: skills.id,
        name: skills.name,
        description: skills.description,
        category: skills.category,
        siteTypes: skills.siteTypes,
      })
      .from(skills)
      .where(eq(skills.enabled, 1));

    // Optionally filter by site type
    let filtered = allSkills;
    if (siteType) {
      filtered = allSkills.filter(s => {
        const types = safeParseArray(s.siteTypes);
        return types.length === 0 || types.includes(siteType);
      });
    }

    return NextResponse.json({
      level: 0,
      skills: filtered.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
        siteTypes: safeParseArray(s.siteTypes),
      })),
    });
  }

  // Level 1: return indexContent for selected skills
  if (level === 1) {
    const selected = await db
      .select({
        id: skills.id,
        name: skills.name,
        description: skills.description,
        category: skills.category,
        indexContent: skills.indexContent,
        hasReferences: skills.references,
      })
      .from(skills)
      .where(inArray(skills.id, ids));

    return NextResponse.json({
      level: 1,
      skills: selected.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
        indexContent: s.indexContent,
        hasReferences: !!s.hasReferences,
      })),
    });
  }

  // Level 2: return everything including references
  if (level === 2) {
    const selected = await db
      .select()
      .from(skills)
      .where(inArray(skills.id, ids));

    return NextResponse.json({
      level: 2,
      skills: selected.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
        indexContent: s.indexContent,
        references: safeParseArray(s.references),
      })),
    });
  }

  return NextResponse.json({ error: "Invalid level (0, 1, or 2)" }, { status: 400 });
}

function safeParseArray(json: string | null): unknown[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}
