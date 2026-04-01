import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { knowledgeBases } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** GET /api/kb — list all knowledge bases for current user */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bases = await db.select().from(knowledgeBases)
    .where(eq(knowledgeBases.userId, session.user.id))
    .orderBy(knowledgeBases.createdAt);

  return NextResponse.json({ bases });
}

/** POST /api/kb — create a new knowledge base */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(knowledgeBases).values({
    id,
    userId: session.user.id,
    name: name.trim(),
    description: description?.trim() || "",
    indexMd: `# ${name.trim()}\n\n创建时间: ${now}\n文件数: 0\n\n## 文件清单\n\n*暂无文件*`,
    fileCount: 0,
    totalChars: 0,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id, name: name.trim() });
}
