import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { knowledgeBases, knowledgeFiles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { saveUserImage, isImageFile } from "@/lib/asset-store";

/**
 * POST /api/kb/[baseId]/files — upload a file or add a link to a knowledge base.
 *
 * For files: multipart/form-data with "file" field
 * For links: JSON { url, type, title? }
 *
 * Saves RAW content (full text), then AI generates description + keywords.
 * Does NOT do heavy extraction — just parse + describe.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ baseId: string }> }) {
  const { baseId } = await params;
  try {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify base ownership
  const base = await db.select({ id: knowledgeBases.id }).from(knowledgeBases)
    .where(and(eq(knowledgeBases.id, baseId), eq(knowledgeBases.userId, session.user.id))).get();
  if (!base) return NextResponse.json({ error: "Knowledge base not found" }, { status: 404 });

  const contentType = req.headers.get("content-type") || "";
  let fileName: string;
  let fileType: string;
  let rawContent: string;
  let originalUrl: string | null = null;
  let assetPath: string | null = null;
  let mimeType: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    // File upload
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    fileName = file.name;
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const buffer = await file.arrayBuffer();

    // Image: save to asset store
    if (isImageFile(fileName)) {
      const saved = await saveUserImage(session.user.id, fileName, Buffer.from(buffer), `kb:${baseId}`);
      assetPath = saved;
      mimeType = file.type || `image/${ext}`;
      fileType = "image";
      rawContent = "";
    }
    // ZIP: extract and save each file separately
    else if (ext === "zip") {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(buffer);
      const results: Array<{ name: string; fileId: string }> = [];

      for (const [filePath, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        const entryName = filePath.split("/").pop() || filePath;
        const entryExt = entryName.split(".").pop()?.toLowerCase() || "";

        // Skip hidden/system files
        if (entryName.startsWith(".") || entryName.startsWith("__")) continue;

        let entryContent = "";
        let entryType = "txt";
        let entryAssetPath: string | null = null;
        let entryMime: string | null = null;

        if (isImageFile(entryName)) {
          const imgBuf = await entry.async("nodebuffer");
          if (imgBuf.byteLength > 500) {
            entryAssetPath = await saveUserImage(session.user.id, entryName, imgBuf, `kb:${baseId}`);
            entryType = "image";
            entryMime = `image/${entryExt}`;
          }
        } else if (entryExt === "pdf") {
          // For PDFs inside ZIP, use MinerU via analyze-source
          const pdfBuf = await entry.async("arraybuffer");
          entryContent = await parsePdfContent(pdfBuf, entryName, session.user.id);
          entryType = "pdf";
        } else if (entryExt === "docx" || entryExt === "doc") {
          const docBuf = await entry.async("arraybuffer");
          const mammoth = await import("mammoth");
          const result = await mammoth.extractRawText({ buffer: Buffer.from(docBuf) });
          entryContent = result.value;
          entryType = "docx";
        } else {
          // Text file inside ZIP — use encoding detection
          const textBuf = await entry.async("nodebuffer");
          entryContent = decodeTextWithFallback(new Uint8Array(textBuf));
          entryType = entryExt === "md" ? "md" : "txt";
        }

        // Generate description for this file
        const desc = await generateFileDescription(entryName, entryType, entryContent.slice(0, 3000));

        const entryFileId = crypto.randomUUID();
        await db.insert(knowledgeFiles).values({
          id: entryFileId,
          baseId,
          userId: session.user.id,
          name: entryName,
          type: entryType,
          description: desc.description,
          keywords: JSON.stringify(desc.keywords),
          contentLength: entryContent.length,
          content: entryContent,
          mimeType: entryMime,
          assetPath: entryAssetPath,
          createdAt: new Date().toISOString(),
        });

        results.push({ name: entryName, fileId: entryFileId });
      }

      // Update index and return
      await regenerateIndex(baseId, session.user.id);
      return NextResponse.json({ files: results, count: results.length, type: "zip" });
    }
    // PDF: parse with MinerU API
    else if (ext === "pdf") {
      fileType = "pdf";
      rawContent = await parsePdfContent(buffer, fileName, session.user.id);
    }
    // DOCX
    else if (ext === "docx" || ext === "doc") {
      fileType = "docx";
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      rawContent = result.value;
    }
    // Text files — detect encoding (UTF-8 / GBK)
    else {
      fileType = ext === "md" ? "md" : "txt";
      rawContent = decodeTextWithFallback(new Uint8Array(buffer));
    }
  } else {
    // Link
    const body = await req.json();
    if (!body.url) return NextResponse.json({ error: "URL required" }, { status: 400 });

    fileName = body.title || body.url.split("/").pop() || body.url;
    fileType = "link";
    originalUrl = body.url;

    // Fetch link content (basic)
    rawContent = await fetchLinkContent(body.url, body.type || "url");
  }

  // AI: generate one-line description + keywords (lightweight, fast)
  const { description, keywords } = await generateFileDescription(fileName, fileType, rawContent.slice(0, 3000));

  // Save file record
  const fileId = crypto.randomUUID();
  await db.insert(knowledgeFiles).values({
    id: fileId,
    baseId,
    userId: session.user.id,
    name: fileName,
    type: fileType,
    description,
    keywords: JSON.stringify(keywords),
    originalUrl,
    contentLength: rawContent.length,
    content: rawContent,
    mimeType,
    assetPath,
    createdAt: new Date().toISOString(),
  });

  // Update index.md
  await regenerateIndex(baseId, session.user.id);

  return NextResponse.json({ fileId, name: fileName, description, keywords, contentLength: rawContent.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[KB upload error]", msg, err);
    return NextResponse.json({ error: `Upload failed: ${msg}` }, { status: 500 });
  }
}

// ---- Helpers ----

/**
 * Parse PDF via MinerU → markdown. Directly calls shared parser (no HTTP self-fetch).
 */
async function parsePdfContent(buffer: ArrayBuffer, filename: string, userId?: string): Promise<string> {
  const { parsePdfSafe } = await import("@/lib/pdf-parser");
  return parsePdfSafe(buffer, filename, userId ? {
    saveImage: async (fn, buf, src) => saveUserImage(userId, fn, buf, src),
  } : undefined);
}

async function fetchLinkContent(url: string, type: string): Promise<string> {
  try {
    if (type === "git" && url.includes("github.com")) {
      // Extract owner/repo and fetch README
      const parts = url.replace("https://github.com/", "").split("/");
      const owner = parts[0], repo = parts[1]?.replace(".git", "");
      if (owner && repo) {
        const readmeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
          headers: { Accept: "application/vnd.github.raw" },
        });
        if (readmeRes.ok) {
          const readme = await readmeRes.text();
          return `GitHub Repository: ${url}\n\n${readme}`;
        }
      }
    }
    // Generic: just store the URL as content
    return `Link: ${url}\n\nThis is an external link. Content available at the URL above.`;
  } catch {
    return `Link: ${url}`;
  }
}

async function generateFileDescription(
  fileName: string,
  fileType: string,
  contentPreview: string,
): Promise<{ description: string; keywords: string[] }> {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey || !contentPreview || contentPreview.length < 20) {
    return { description: fileName, keywords: [] };
  }

  try {
    const res = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "Pro/zai-org/GLM-5",
        messages: [
          { role: "system", content: `You are a file analyzer. Given a file name and content preview, output a JSON object with:\n- "description": one sentence describing what this file contains (Chinese if content is Chinese)\n- "keywords": array of 3-8 keywords\n\nOutput ONLY valid JSON, no markdown.` },
          { role: "user", content: `File: ${fileName} (${fileType})\n\nContent preview:\n${contentPreview.slice(0, 2000)}` },
        ],
        temperature: 0.1,
        max_tokens: 256,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim() || "";
      const json = JSON.parse(text.replace(/```json\s*\n?|\n?```/g, ""));
      return {
        description: json.description || fileName,
        keywords: Array.isArray(json.keywords) ? json.keywords : [],
      };
    }
  } catch {}

  return { description: fileName, keywords: [] };
}

async function regenerateIndex(baseId: string, userId: string) {
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

    sections.push(`### ${i + 1}. ${f.name}
- **文件ID**: ${f.id}
- **类型**: ${f.type}
- **内容概述**: ${f.description || "无描述"}
- **关键词**: ${kw.join(", ") || "无"}
- **内容长度**: ${f.contentLength || 0} 字
- **建议用途**: ${usage}${f.originalUrl ? `\n- **原始链接**: ${f.originalUrl}（可直接嵌入网站或跳转）` : ""}${f.assetPath ? `\n- **图片路径**: /images/${f.assetPath}（可用于头像、项目封面等）` : ""}${preview ? `\n- **内容预览**: ${preview}...` : ""}`);
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

## 文件清单

${sections.length > 0 ? sections.join("\n\n") : "*暂无文件*"}`;

  await db.update(knowledgeBases).set({
    indexMd,
    fileCount: files.length,
    totalChars,
    updatedAt: new Date().toISOString(),
  }).where(eq(knowledgeBases.id, baseId));
}

/**
 * Decode text with encoding fallback: UTF-8 → GBK/GB18030.
 * Windows Chinese users often save .txt as GBK. If UTF-8 produces replacement
 * characters (U+FFFD), try GBK. If both look bad, prefer the one with fewer garbled chars.
 */
function decodeTextWithFallback(bytes: Uint8Array): string {
  // Check for UTF-8 BOM
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder("utf-8").decode(bytes);
  }
  // Check for UTF-16 BOM
  if ((bytes[0] === 0xFF && bytes[1] === 0xFE) || (bytes[0] === 0xFE && bytes[1] === 0xFF)) {
    return new TextDecoder("utf-16").decode(bytes);
  }

  // Try UTF-8
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const replacements = (utf8.match(/\uFFFD/g) || []).length;

  // If clean UTF-8, use it
  if (replacements === 0) return utf8;

  // If many replacements, try GBK (common Chinese encoding on Windows)
  try {
    const gbk = new TextDecoder("gbk", { fatal: false }).decode(bytes);
    const gbkReplacements = (gbk.match(/\uFFFD/g) || []).length;
    // Use GBK if it has fewer garbled chars
    if (gbkReplacements < replacements) return gbk;
  } catch {
    // GBK decoder not available, fall through
  }

  return utf8;
}

/** Infer how this file should be used on the website */
function inferUsageSuggestion(name: string, type: string, desc: string, keywords: string[]): string {
  const n = name.toLowerCase();
  const d = desc.toLowerCase();
  const allText = `${n} ${d} ${keywords.join(" ")}`.toLowerCase();

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
