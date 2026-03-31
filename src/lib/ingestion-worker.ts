/**
 * Ingestion Worker — processes file uploads in the background.
 * Runs asynchronously, updates task status in DB.
 * Survives page navigation because task state is in DB, not React state.
 */
import { db } from "@/lib/db";
import { ingestionTasks, knowledgeGroups, knowledgeItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { saveUserImage, isImageFile } from "@/lib/asset-store";
import type { KnowledgeItem } from "@/lib/knowledge";

interface IngestionInput {
  fileName: string;
  fileType: string;
  fileBuffer: Buffer | null;
  url: string | null;
  urlType: string | null;
}

async function updateTask(taskId: string, update: Record<string, unknown>) {
  await db.update(ingestionTasks).set({ ...update, updatedAt: new Date().toISOString() }).where(eq(ingestionTasks.id, taskId));
}

/**
 * Main entry point — called from the API route, runs in background.
 */
export async function runIngestionTask(taskId: string, userId: string, input: IngestionInput) {
  try {
    await updateTask(taskId, { status: "processing", progress: "解析文件中..." });
    logger.info("ingestion", `[${taskId}] Starting: ${input.fileName} (${input.fileType})`);

    // Handle direct image upload
    if (input.fileBuffer && isImageFile(input.fileName)) {
      const savedName = await saveUserImage(userId, input.fileName, input.fileBuffer, "direct-upload");
      const item: KnowledgeItem = {
        id: crypto.randomUUID(),
        category: "media",
        title: input.fileName,
        content: `Image: /images/${savedName}`,
        sourceId: "",
        selected: true,
        tags: ["image"],
      };
      const groupId = await saveToKnowledgeBase(userId, input.fileName, input.fileType, [item]);
      await updateTask(taskId, { status: "done", progress: "图片已保存", itemCount: 1, groupId });
      return;
    }

    // Call analyze-source via internal HTTP (same process, no auth needed for file parsing)
    await updateTask(taskId, { progress: "AI 正在提取知识..." });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";
    let analyzeRes: Response;

    if (input.fileBuffer) {
      const formData = new FormData();
      formData.append("file", new Blob([new Uint8Array(input.fileBuffer)]), input.fileName);
      formData.append("type", input.fileType);
      analyzeRes = await fetch(`${baseUrl}/api/analyze-source`, { method: "POST", body: formData });
    } else if (input.url) {
      analyzeRes = await fetch(`${baseUrl}/api/analyze-source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: input.url, type: input.urlType }),
      });
    } else {
      throw new Error("No file or URL provided");
    }

    if (!analyzeRes.ok) {
      const errText = await analyzeRes.text();
      throw new Error(`Analysis failed: ${errText.slice(0, 200)}`);
    }

    const data = await analyzeRes.json();
    const extractedItems: KnowledgeItem[] = data.items || [];

    await updateTask(taskId, { progress: `提取到 ${extractedItems.length} 条知识，正在保存...` });

    const groupId = await saveToKnowledgeBase(userId, input.fileName, input.fileType, extractedItems);

    // Save relations if present
    if (data.relations?.length > 0) {
      try {
        await fetch(`${baseUrl}/api/knowledge-graph`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ relations: data.relations }),
        });
      } catch {}
    }

    await updateTask(taskId, { status: "done", progress: `完成，提取 ${extractedItems.length} 条`, itemCount: extractedItems.length, groupId });
    logger.info("ingestion", `[${taskId}] Done: ${extractedItems.length} items`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error("ingestion", `[${taskId}] Failed: ${msg}`);
    await updateTask(taskId, { status: "error", error: msg, progress: "处理失败" });
  }
}

async function saveToKnowledgeBase(userId: string, fileName: string, fileType: string, items: KnowledgeItem[]): Promise<string> {
  const tags: string[] = [];
  for (const item of items) tags.push(...(item.tags || []).slice(0, 3));

  const groupId = crypto.randomUUID();
  await db.insert(knowledgeGroups).values({
    id: groupId,
    userId,
    name: fileName.replace(/\.[^.]+$/, ""),
    description: `${items.length} items extracted from ${fileName}`,
    tags: JSON.stringify([...new Set(tags)].slice(0, 10)),
    sourceFile: fileName,
    sourceType: fileType,
  });

  for (const item of items) {
    await db.insert(knowledgeItems).values({
      userId,
      groupId,
      sourceId: groupId,
      sourceName: fileName,
      sourceType: fileType,
      category: item.category,
      title: item.title,
      content: item.content,
      tags: JSON.stringify(item.tags || []),
      useCase: item.useCase || null,
      selected: 1,
    });
  }

  return groupId;
}

