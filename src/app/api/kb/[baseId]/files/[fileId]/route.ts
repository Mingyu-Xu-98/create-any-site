import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { knowledgeFiles, knowledgeBases } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/** GET /api/kb/[baseId]/files/[fileId] — get file with full content */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ baseId: string; fileId: string }> }) {
  const { baseId, fileId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const file = await db.select().from(knowledgeFiles)
    .where(and(eq(knowledgeFiles.id, fileId), eq(knowledgeFiles.baseId, baseId), eq(knowledgeFiles.userId, session.user.id)))
    .get();

  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ file });
}

/** DELETE /api/kb/[baseId]/files/[fileId] — delete a file */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ baseId: string; fileId: string }> }) {
  const { baseId, fileId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await db.delete(knowledgeFiles)
    .where(and(eq(knowledgeFiles.id, fileId), eq(knowledgeFiles.baseId, baseId), eq(knowledgeFiles.userId, session.user.id)));

  // Regenerate index
  const files = await db.select().from(knowledgeFiles).where(eq(knowledgeFiles.baseId, baseId)).orderBy(knowledgeFiles.createdAt);
  const base = await db.select({ name: knowledgeBases.name }).from(knowledgeBases).where(eq(knowledgeBases.id, baseId)).get();

  let totalChars = 0;
  const sections: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    totalChars += f.contentLength || 0;
    const kw = f.keywords ? JSON.parse(f.keywords) : [];
    sections.push(`### ${i + 1}. ${f.name}\n- 类型: ${f.type}\n- 描述: ${f.description || "无描述"}\n- 关键词: ${kw.join(", ") || "无"}\n- 内容长度: ${f.contentLength || 0} 字\n- 文件ID: ${f.id}`);
  }

  const indexMd = `# ${base?.name || "知识库"}\n文件数: ${files.length}\n总内容: ${totalChars} 字\n\n## 文件清单\n\n${sections.length > 0 ? sections.join("\n\n") : "*暂无文件*"}`;

  await db.update(knowledgeBases).set({ indexMd, fileCount: files.length, totalChars, updatedAt: new Date().toISOString() }).where(eq(knowledgeBases.id, baseId));

  return NextResponse.json({ ok: true });
}
