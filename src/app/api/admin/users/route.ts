import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { users, sites, knowledgeItems } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  // Get counts per user
  const userList = await Promise.all(
    allUsers.map(async (u) => {
      const [sc] = await db.select({ count: sql<number>`count(*)` }).from(sites).where(eq(sites.userId, u.id));
      const [kc] = await db.select({ count: sql<number>`count(*)` }).from(knowledgeItems).where(eq(knowledgeItems.userId, u.id));
      return { ...u, siteCount: sc.count, knowledgeCount: kc.count };
    })
  );

  return NextResponse.json({ users: userList });
}
