/**
 * Knowledge Base Loader — loads index + raw file content for agents.
 * Used by Design Agent (reads index) and Code Agent (reads specific files).
 */
import { db } from "@/lib/db";
import { knowledgeBases, knowledgeFiles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface KBContext {
  /** Combined index.md from all user's knowledge bases */
  indexContent: string;
  /** Total file count */
  fileCount: number;
  /** All file contents, keyed by file ID */
  fileContents: Map<string, { name: string; content: string; type: string }>;
}

/**
 * Load all knowledge base indexes for a user.
 * Lightweight — only loads index.md, not file contents.
 */
export async function loadKBIndexes(userId: string): Promise<string> {
  const bases = await db.select({
    name: knowledgeBases.name,
    indexMd: knowledgeBases.indexMd,
    fileCount: knowledgeBases.fileCount,
  }).from(knowledgeBases)
    .where(eq(knowledgeBases.userId, userId));

  if (bases.length === 0) return "";

  return bases.map(b => b.indexMd || `# ${b.name}\n(empty)`).join("\n\n---\n\n");
}

/**
 * Load full context: indexes + all file contents.
 * Used for Code Agent which needs actual content to write code.
 * When knowledgeBaseId is provided, only loads that specific KB.
 * Otherwise loads ALL user's KBs (legacy behavior).
 */
export async function loadFullKBContext(userId: string, knowledgeBaseId?: string): Promise<KBContext> {
  let bases: Array<{ id: string; name: string; indexMd: string | null }>;

  if (knowledgeBaseId) {
    bases = await db.select({
      id: knowledgeBases.id,
      name: knowledgeBases.name,
      indexMd: knowledgeBases.indexMd,
    }).from(knowledgeBases)
      .where(eq(knowledgeBases.id, knowledgeBaseId));
  } else {
    bases = await db.select({
      id: knowledgeBases.id,
      name: knowledgeBases.name,
      indexMd: knowledgeBases.indexMd,
    }).from(knowledgeBases)
      .where(eq(knowledgeBases.userId, userId));
  }

  const indexContent = bases.map(b => b.indexMd || "").join("\n\n---\n\n");
  const fileContents = new Map<string, { name: string; content: string; type: string }>();

  let fileCount = 0;
  for (const base of bases) {
    const files = await db.select({
      id: knowledgeFiles.id,
      name: knowledgeFiles.name,
      content: knowledgeFiles.content,
      type: knowledgeFiles.type,
      originalUrl: knowledgeFiles.originalUrl,
    }).from(knowledgeFiles)
      .where(eq(knowledgeFiles.baseId, base.id));

    for (const f of files) {
      fileCount++;
      fileContents.set(f.id, {
        name: f.name,
        content: f.content || "",
        type: f.type,
      });
    }
  }

  return { indexContent, fileCount, fileContents };
}

/**
 * Format file contents for Code Agent prompt.
 * Chunks long files, includes file IDs for reference.
 */
export function formatFilesForPrompt(
  fileContents: Map<string, { name: string; content: string; type: string }>,
  maxTotalChars = 60000,
): string {
  const parts: string[] = [];
  let totalChars = 0;

  for (const [id, file] of fileContents) {
    if (file.type === "image") continue; // Skip images
    if (!file.content || file.content.length < 10) continue;

    const available = maxTotalChars - totalChars;
    if (available <= 0) {
      parts.push(`\n... (${fileContents.size - parts.length} more files truncated)`);
      break;
    }

    const content = file.content.length > available
      ? file.content.slice(0, available) + "\n... (truncated)"
      : file.content;

    parts.push(`### [${id}] ${file.name}\n${content}`);
    totalChars += content.length;
  }

  return parts.join("\n\n");
}
