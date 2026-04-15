import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { knowledgeBases, knowledgeFiles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { saveUserImage, isImageFile } from "@/lib/asset-store";
import { DEFAULT_MAX_KB_UPLOAD_BYTES, checkContentLength, checkFileSize } from "@/lib/upload-limits";
import { internalError } from "@/lib/api-errors";
import { startTrace } from "@/lib/llm-trace";
import { checkQuota } from "@/lib/usage";
import { regenerateIndex } from "@/lib/kb-index";

/**
 * GET /api/kb/[baseId]/files — list all files in a knowledge base.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ baseId: string }> }) {
  const { baseId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const base = await db.select({ id: knowledgeBases.id }).from(knowledgeBases)
    .where(and(eq(knowledgeBases.id, baseId), eq(knowledgeBases.userId, session.user.id))).get();
  if (!base) return NextResponse.json({ error: "Knowledge base not found" }, { status: 404 });

  const files = await db.select({
    id: knowledgeFiles.id,
    name: knowledgeFiles.name,
    type: knowledgeFiles.type,
    description: knowledgeFiles.description,
    keywords: knowledgeFiles.keywords,
    contentLength: knowledgeFiles.contentLength,
    mimeType: knowledgeFiles.mimeType,
    assetPath: knowledgeFiles.assetPath,
    usageTag: knowledgeFiles.usageTag,
    originalUrl: knowledgeFiles.originalUrl,
    createdAt: knowledgeFiles.createdAt,
  }).from(knowledgeFiles)
    .where(and(eq(knowledgeFiles.baseId, baseId), eq(knowledgeFiles.userId, session.user.id)))
    .orderBy(knowledgeFiles.createdAt);

  return NextResponse.json({ files });
}

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

  const uploadQuota = await checkQuota(session.user.id, "file_upload");
  if (!uploadQuota.allowed) {
    return NextResponse.json({ error: uploadQuota.reason, quota: true, upgradeHint: uploadQuota.upgradeHint }, { status: 429 });
  }

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
  let pendingPdfBuffer: ArrayBuffer | null = null; // For async background PDF processing

  if (contentType.includes("multipart/form-data")) {
    const tooLargeEarly = checkContentLength(req, DEFAULT_MAX_KB_UPLOAD_BYTES);
    if (tooLargeEarly) return tooLargeEarly;

    // File upload
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const tooLargeLate = checkFileSize(file, DEFAULT_MAX_KB_UPLOAD_BYTES);
    if (tooLargeLate) return tooLargeLate;

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
      const asyncDescriptionJobs: Array<{ fileId: string; fileName: string; fileType: string; content: string }> = [];
      const asyncPdfJobs: Array<{ fileId: string; fileName: string; buffer: ArrayBuffer }> = [];

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
        let entryPdfBuffer: ArrayBuffer | null = null;

        if (isImageFile(entryName)) {
          const imgBuf = await entry.async("nodebuffer");
          if (imgBuf.byteLength > 500) {
            entryAssetPath = await saveUserImage(session.user.id, entryName, imgBuf, `kb:${baseId}`);
            entryType = "image";
            entryMime = `image/${entryExt}`;
          }
        } else if (entryExt === "pdf") {
          // PDF inside ZIP: parse async in background (MinerU OCR can take minutes)
          entryPdfBuffer = await entry.async("arraybuffer");
          entryContent = ""; // Populated by background processing
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

        // Save file record immediately (description generated async)
        const entryFileId = crypto.randomUUID();
        await db.insert(knowledgeFiles).values({
          id: entryFileId,
          baseId,
          userId: session.user.id,
          name: entryName,
          type: entryType,
          description: entryName, // placeholder — updated async
          keywords: "[]",
          contentLength: entryContent.length,
          content: entryContent,
          mimeType: entryMime,
          assetPath: entryAssetPath,
          createdAt: new Date().toISOString(),
        });

        // Queue async description generation
        if (entryContent.length >= 20) {
          asyncDescriptionJobs.push({ fileId: entryFileId, fileName: entryName, fileType: entryType, content: entryContent.slice(0, 3000) });
        }
        // Queue background PDF parsing
        if (entryPdfBuffer) {
          asyncPdfJobs.push({ fileId: entryFileId, fileName: entryName, buffer: entryPdfBuffer });
        }

        results.push({ name: entryName, fileId: entryFileId });
      }

      // Update index and return immediately
      await regenerateIndex(baseId, session.user.id);

      // Fire-and-forget: PDF parsing + descriptions for all extracted files
      const zipUserId = session.user.id;
      Promise.resolve().then(async () => {
        // First: parse any PDF entries in background (MinerU OCR can take minutes per file)
        for (const pdfJob of asyncPdfJobs) {
          try {
            console.log(`[kb-upload] Background PDF (ZIP): ${pdfJob.fileName}`);
            const content = await parsePdfContent(pdfJob.buffer, pdfJob.fileName, zipUserId);
            await db.update(knowledgeFiles)
              .set({ content, contentLength: content.length })
              .where(eq(knowledgeFiles.id, pdfJob.fileId));
            // Queue description generation for successfully parsed PDFs
            if (content.length >= 20) {
              asyncDescriptionJobs.push({ fileId: pdfJob.fileId, fileName: pdfJob.fileName, fileType: "pdf", content: content.slice(0, 3000) });
            }
            console.log(`[kb-upload] PDF done (ZIP): ${pdfJob.fileName} (${content.length} chars)`);
          } catch (err) {
            console.error(`[kb-upload] PDF failed (ZIP): ${pdfJob.fileName}`, err);
            await db.update(knowledgeFiles)
              .set({ description: `PDF解析失败: ${(err as Error).message?.slice(0, 200) || "unknown"}`, contentLength: -1 })
              .where(eq(knowledgeFiles.id, pdfJob.fileId)).catch(() => {});
          }
        }
        // Then: generate AI descriptions for all files (including newly parsed PDFs)
        for (const job of asyncDescriptionJobs) {
          try {
            const desc = await generateFileDescription(job.fileName, job.fileType, job.content, zipUserId);
            await db.update(knowledgeFiles)
              .set({ description: desc.description, keywords: JSON.stringify(desc.keywords) })
              .where(eq(knowledgeFiles.id, job.fileId));
          } catch { /* non-fatal: file saved, just no AI description */ }
        }
        // Regenerate index with real data
        if (asyncDescriptionJobs.length > 0 || asyncPdfJobs.length > 0) {
          await regenerateIndex(baseId, zipUserId).catch(() => {});
        }
      });

      return NextResponse.json({ files: results, count: results.length, type: "zip" });
    }
    // PDF: save record immediately, parse in background.
    // MinerU OCR can take 5-10 min for large scanned PDFs — must not block the HTTP request.
    else if (ext === "pdf") {
      fileType = "pdf";
      rawContent = ""; // Populated async by background processing below
      pendingPdfBuffer = buffer;
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

  // Save file record immediately (description generated async in background)
  const fileId = crypto.randomUUID();
  await db.insert(knowledgeFiles).values({
    id: fileId,
    baseId,
    userId: session.user.id,
    name: fileName,
    type: fileType,
    description: fileName, // placeholder — updated async below
    keywords: "[]",
    originalUrl,
    contentLength: rawContent.length,
    content: rawContent,
    mimeType,
    assetPath,
    createdAt: new Date().toISOString(),
  });

  // Update index.md (with placeholder description — will be refreshed after AI)
  await regenerateIndex(baseId, session.user.id);

  // Fire-and-forget: generate AI description + keywords in background
  const bgUserId = session.user.id;
  if (rawContent.length >= 20) {
    Promise.resolve().then(async () => {
      try {
        const { description, keywords } = await generateFileDescription(fileName, fileType, rawContent.slice(0, 3000), bgUserId);
        await db.update(knowledgeFiles)
          .set({ description, keywords: JSON.stringify(keywords) })
          .where(eq(knowledgeFiles.id, fileId));
        await regenerateIndex(baseId, bgUserId);
      } catch { /* non-fatal */ }
    });
  }

  // Background PDF processing — for scanned/large PDFs, MinerU OCR can take minutes.
  // The record was saved above with content="" so the API responds instantly.
  if (pendingPdfBuffer) {
    const pdfBuf = pendingPdfBuffer;
    const pdfId = fileId;
    const pdfBase = baseId;
    const pdfUser = bgUserId;
    const pdfName = fileName;
    Promise.resolve().then(async () => {
      try {
        console.log(`[kb-upload] Background PDF processing started: ${pdfName}`);
        const content = await parsePdfContent(pdfBuf, pdfName, pdfUser);
        await db.update(knowledgeFiles)
          .set({ content, contentLength: content.length })
          .where(eq(knowledgeFiles.id, pdfId));
        // Generate AI description for the parsed content
        if (content.length >= 20) {
          try {
            const desc = await generateFileDescription(pdfName, "pdf", content.slice(0, 3000), pdfUser);
            await db.update(knowledgeFiles)
              .set({ description: desc.description, keywords: JSON.stringify(desc.keywords) })
              .where(eq(knowledgeFiles.id, pdfId));
          } catch { /* non-fatal: content saved, just no AI description */ }
        }
        await regenerateIndex(pdfBase, pdfUser).catch(() => {});
        console.log(`[kb-upload] Background PDF complete: ${pdfName} (${content.length} chars)`);
      } catch (err) {
        console.error(`[kb-upload] Background PDF failed: ${pdfName}`, err);
        await db.update(knowledgeFiles)
          .set({
            description: `PDF解析失败: ${(err as Error).message?.slice(0, 200) || "unknown error"}`,
            contentLength: -1, // Negative = error indicator for frontend
          })
          .where(eq(knowledgeFiles.id, pdfId)).catch(() => {});
      }
    });
  }

  return NextResponse.json({
    fileId, name: fileName, description: fileName, keywords: [],
    contentLength: rawContent.length,
    processing: pendingPdfBuffer ? true : undefined,
  });
  } catch (err) {
    return internalError(err, "kb-upload", { clientMessage: "Upload failed" });
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
  userId?: string,
): Promise<{ description: string; keywords: string[] }> {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey || !contentPreview || contentPreview.length < 20) {
    return { description: fileName, keywords: [] };
  }

  const kbSystemPrompt = `You are a file analyzer. Given a file name and content preview, output a JSON object with:\n- "description": one sentence describing what this file contains (Chinese if content is Chinese)\n- "keywords": array of 3-8 keywords\n\nOutput ONLY valid JSON, no markdown.`;
  const kbUserPrompt = `File: ${fileName} (${fileType})\n\nContent preview:\n${contentPreview.slice(0, 2000)}`;

  const span = startTrace({
    traceId: crypto.randomUUID().slice(0, 8),
    phase: "kb-describe",
    userId: userId ?? undefined,
  });

  try {
    const res = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "Pro/zai-org/GLM-5",
        messages: [
          { role: "system", content: kbSystemPrompt },
          { role: "user", content: kbUserPrompt },
        ],
        temperature: 0.1,
        max_tokens: 256,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim() || "";
      const tokenUsage = data.usage;
      // Record token usage
      if (userId && tokenUsage) {
        import("@/lib/usage").then(({ recordUsage }) => {
          recordUsage(userId, {
            action: "llm_call",
            provider: "siliconflow",
            model: "Pro/zai-org/GLM-5",
            inputTokens: tokenUsage.prompt_tokens || 0,
            outputTokens: tokenUsage.completion_tokens || 0,
            totalTokens: tokenUsage.total_tokens || 0,
            label: "kb-describe",
          }).catch(() => {});
        });
      }

      span.end({
        provider: "siliconflow", model: "Pro/zai-org/GLM-5",
        systemPrompt: kbSystemPrompt, userPrompt: kbUserPrompt,
        rawResponse: text,
        inputTokens: tokenUsage?.prompt_tokens ?? 0,
        outputTokens: tokenUsage?.completion_tokens ?? 0,
        totalTokens: tokenUsage?.total_tokens ?? 0,
        temperature: 0.1, maxTokens: 256,
        outcome: "success",
      });

      const json = JSON.parse(text.replace(/```json\s*\n?|\n?```/g, ""));
      return {
        description: json.description || fileName,
        keywords: Array.isArray(json.keywords) ? json.keywords : [],
      };
    }

    span.error(new Error(`siliconflow ${res.status}`), {
      provider: "siliconflow", model: "Pro/zai-org/GLM-5",
      systemPrompt: kbSystemPrompt, userPrompt: kbUserPrompt,
      temperature: 0.1, maxTokens: 256,
    });
  } catch (err) {
    span.error(err, {
      provider: "siliconflow", model: "Pro/zai-org/GLM-5",
      systemPrompt: kbSystemPrompt, userPrompt: kbUserPrompt,
      temperature: 0.1, maxTokens: 256,
    });
  }

  return { description: fileName, keywords: [] };
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

