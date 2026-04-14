/**
 * KB Index — shared functions for regenerating knowledge base indexes.
 * Extracted from files/route.ts so it can be reused by PATCH and other endpoints.
 */
import { db } from "@/lib/db";
import { knowledgeBases, knowledgeFiles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/** Infer how this file should be used on the website */
export function inferUsageSuggestion(name: string, type: string, desc: string, keywords: string[]): string {
  const allText = `${name.toLowerCase()} ${desc.toLowerCase()} ${keywords.join(" ")}`.toLowerCase();

  if (type === "image") return "网站头像、项目封面、背景图等视觉展示";
  if (type === "link") return "嵌入网站作为外部链接跳转，或展示为链接卡片";
  if (/resume|简历|cv/i.test(allText)) return "提取个人信息、工作经历、教育背景、技能列表用于网站各 section";
  if (/project|项目|作品|portfolio|案例/i.test(allText)) return "用于项目展示 section，提取项目名称、描述、技术栈、成果";
  if (/blog|文章|article|post/i.test(allText)) return "用于博客/文章 section，作为文章内容展示";
  if (/skill|技能|tech|技术/i.test(allText)) return "用于技能展示 section";
  if (/readme|介绍|about/i.test(allText)) return "用于关于页面或项目介绍";
  if (/award|荣誉|证书|certification/i.test(allText)) return "用于荣誉/证书展示 section";
  if (/paper|论文|publication|研究/i.test(allText)) return "用于学术成果/论文展示 section";
  return "根据内容判断适合放在网站的哪个部分";
}

/** Regenerate the index.md for a knowledge base, including image usage tags. */
export async function regenerateIndex(baseId: string, userId: string) {
  const files = await db.select().from(knowledgeFiles)
    .where(and(eq(knowledgeFiles.baseId, baseId), eq(knowledgeFiles.userId, userId)))
    .orderBy(knowledgeFiles.createdAt);

  const base = await db.select({ name: knowledgeBases.name }).from(knowledgeBases)
    .where(eq(knowledgeBases.id, baseId)).get();

  let totalChars = 0;
  const sections: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    totalChars += f.contentLength || 0;
    const kw = f.keywords ? JSON.parse(f.keywords) : [];

    // Content preview (first 200 chars)
    const preview = f.content ? f.content.replace(/\s+/g, " ").slice(0, 200).trim() : "";

    // Usage suggestion based on file type and content
    const usage = inferUsageSuggestion(f.name, f.type, f.description || "", kw);

    // Build section entry
    let entry = `### ${i + 1}. ${f.name}
- **文件ID**: ${f.id}
- **类型**: ${f.type}
- **内容概述**: ${f.description || "无描述"}
- **关键词**: ${kw.join(", ") || "无"}
- **内容长度**: ${f.contentLength || 0} 字
- **建议用途**: ${usage}`;

    if (f.originalUrl) entry += `\n- **原始链接**: ${f.originalUrl}（可直接嵌入网站或跳转）`;
    if (f.assetPath) {
      entry += `\n- **图片路径**: /images/${f.assetPath}（可用于头像、项目封面等）`;
      if (f.usageTag) entry += `\n- **用途标记**: ${f.usageTag}`;
    }
    if (preview) entry += `\n- **内容预览**: ${preview}...`;

    sections.push(entry);
  }

  const indexMd = `# ${base?.name || "知识库"}

> 本索引供 AI 构建网站时使用。请根据文件ID读取完整内容。

- 更新时间: ${new Date().toISOString().split("T")[0]}
- 文件数: ${files.length}
- 总内容: ${totalChars} 字

## 使用说明

构建网站时：
1. 先阅读本索引了解有哪些内容可用
2. 根据网站 section 需要，按文件ID读取对应文件的完整内容
3. 优先使用原文内容，不要编造或泛化
4. 链接类文件保留原始URL，用于网站跳转
5. 图片类文件使用图片路径，用于网站展示
6. 标记了用途(usageTag)的图片优先用于对应位置

## 文件清单

${sections.length > 0 ? sections.join("\n\n") : "*暂无文件*"}`;

  await db.update(knowledgeBases).set({
    indexMd,
    fileCount: files.length,
    totalChars,
    updatedAt: new Date().toISOString(),
  }).where(eq(knowledgeBases.id, baseId));
}
