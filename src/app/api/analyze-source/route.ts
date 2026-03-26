import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import mammoth from "mammoth";
import type { KnowledgeItem, KnowledgeCategory } from "@/lib/knowledge";
import { logger } from "@/lib/logger";

const MINERU_BASE = "https://mineru.net/api/v4";

// ─── MinerU PDF Parsing ───
async function parsePdfWithMinerU(buffer: ArrayBuffer, filename: string): Promise<string> {
  const apiKey = process.env.MINERU_API_KEY;
  if (!apiKey) {
    logger.warn("mineru", "MINERU_API_KEY not set, falling back to basic extraction");
    return basicPdfExtract(buffer);
  }

  logger.info("mineru", `Starting PDF parse for: ${filename}`, { size: buffer.byteLength });

  // Step 1: Request upload URL
  logger.info("mineru", "Requesting upload URL...");
  const batchRes = await fetch(`${MINERU_BASE}/file-urls/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      enable_formula: true,
      enable_table: true,
      language: "ch",
      files: [{ name: filename, is_ocr: true }],
    }),
  });

  if (!batchRes.ok) {
    const errText = await batchRes.text();
    logger.error("mineru", `Failed to get upload URL: ${batchRes.status}`, { response: errText });
    throw new Error(`MinerU upload URL failed: ${batchRes.status}`);
  }

  const batchData = await batchRes.json();
  logger.info("mineru", "Upload URL response", { code: batchData.code, msg: batchData.msg });

  if (batchData.code !== 0) {
    logger.error("mineru", `MinerU API error: ${batchData.msg}`, { code: batchData.code });
    throw new Error(`MinerU error: ${batchData.msg}`);
  }

  const batchId = batchData.data?.batch_id;
  const uploadUrl = batchData.data?.file_urls?.[0];

  if (!uploadUrl || !batchId) {
    logger.error("mineru", "No upload URL or batch_id returned", { data: batchData.data });
    throw new Error("MinerU: no upload URL returned");
  }

  logger.info("mineru", `Got upload URL, batch_id: ${batchId}`);

  // Step 2: Upload file via PUT
  logger.info("mineru", `Uploading file (${(buffer.byteLength / 1024).toFixed(1)}KB)...`);
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    body: buffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    logger.error("mineru", `File upload failed: ${uploadRes.status}`, { response: errText.slice(0, 500) });
    throw new Error(`MinerU upload failed: ${uploadRes.status}`);
  }

  logger.info("mineru", "File uploaded successfully");

  // Step 3: Poll for results
  logger.info("mineru", `Polling batch results: ${batchId}`);
  const maxWait = 120_000; // 2 min
  const pollInterval = 3_000;
  const startTime = Date.now();
  let resultUrl: string | null = null;

  while (Date.now() - startTime < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));

    const pollRes = await fetch(`${MINERU_BASE}/extract-results/batch/${batchId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!pollRes.ok) {
      logger.warn("mineru", `Poll request failed: ${pollRes.status}`);
      continue;
    }

    const pollData = await pollRes.json();
    const results = pollData.data?.extract_result || [];
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (results.length > 0) {
      const r = results[0];
      logger.info("mineru", `Poll state: ${r.state}, elapsed: ${elapsed}s`, {
        pages: r.extract_progress?.extracted_pages,
        total: r.extract_progress?.total_pages,
      });

      if (r.state === "done" && r.full_zip_url) {
        resultUrl = r.full_zip_url;
        logger.info("mineru", `Parse complete! Elapsed: ${elapsed}s`, { url: resultUrl });
        break;
      } else if (r.state === "failed") {
        logger.error("mineru", `Parse failed: ${r.err_msg}`, { elapsed });
        throw new Error(`MinerU parse failed: ${r.err_msg}`);
      }
    }
  }

  if (!resultUrl) {
    logger.error("mineru", "Timeout waiting for parse result", { maxWait });
    throw new Error("MinerU: timeout waiting for result");
  }

  // Step 4: Download and extract result
  logger.info("mineru", "Downloading result ZIP...");
  const zipRes = await fetch(resultUrl);
  if (!zipRes.ok) {
    logger.error("mineru", `Result download failed: ${zipRes.status}`);
    throw new Error(`MinerU result download failed: ${zipRes.status}`);
  }

  const zipBuffer = await zipRes.arrayBuffer();
  logger.info("mineru", `Result ZIP downloaded: ${(zipBuffer.byteLength / 1024).toFixed(1)}KB`);

  const zip = await JSZip.loadAsync(zipBuffer);
  const markdownFiles: string[] = [];

  for (const [filePath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const ext = filePath.split(".").pop()?.toLowerCase();
    if (ext === "md" || ext === "txt" || ext === "json") {
      try {
        const content = await entry.async("string");
        if (content.length > 0) {
          markdownFiles.push(`=== ${filePath} ===\n${content}`);
          logger.info("mineru", `Extracted: ${filePath} (${content.length} chars)`);
        }
      } catch { /* skip */ }
    }
  }

  const result = markdownFiles.join("\n\n");
  logger.info("mineru", `PDF parse complete. Total content: ${result.length} chars from ${markdownFiles.length} files`);
  return result;
}

// ─── Basic PDF text extraction (fallback) ───
function basicPdfExtract(buffer: ArrayBuffer): string {
  logger.info("pdf-basic", "Using basic PDF text extraction");
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

  const segments: string[] = [];
  const matches = text.match(/\(([^)]+)\)/g);
  if (matches) {
    for (const m of matches) {
      const inner = m.slice(1, -1);
      if (inner.length > 2 && /[\w\u4e00-\u9fff]/.test(inner)) {
        segments.push(inner);
      }
    }
  }

  const result = segments.length > 0 ? segments.join(" ") : "[PDF - limited text extraction]";
  logger.info("pdf-basic", `Extracted ${segments.length} segments, ${result.length} chars`);
  return result;
}

// ─── Extract text from ZIP ───
async function extractFromZip(buffer: ArrayBuffer): Promise<string> {
  logger.info("zip", "Extracting text from ZIP...");
  const zip = await JSZip.loadAsync(buffer);
  const texts: string[] = [];
  const textExts = ["json", "md", "txt", "csv", "yaml", "yml", "toml", "html", "xml", "rst", "tex", "log"];

  for (const [filePath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    if (!textExts.includes(ext)) continue;
    try {
      const content = await entry.async("string");
      if (content.length > 0 && content.length < 100_000) {
        texts.push(`=== ${filePath} ===\n${content}`);
      }
    } catch { /* skip */ }
  }

  logger.info("zip", `Extracted ${texts.length} text files`);
  return texts.join("\n\n");
}

// ─── Fetch content from URL sources ───
async function fetchUrlContent(url: string, type: "git" | "bilibili" | "youtube"): Promise<string> {
  logger.info("url", `Fetching ${type} content from: ${url}`);

  if (type === "git") {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) {
      const [, owner, repo] = match;
      const repoName = repo.replace(/\.git$/, "");
      const parts: string[] = [];

      try {
        const infoRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
          headers: { "User-Agent": "CreateAnySite/1.0" },
        });
        if (infoRes.ok) {
          const info = await infoRes.json();
          parts.push(`Repository: ${info.full_name}`);
          parts.push(`Description: ${info.description || "No description"}`);
          parts.push(`Language: ${info.language || "Unknown"}`);
          parts.push(`Stars: ${info.stargazers_count}, Forks: ${info.forks_count}`);
          parts.push(`Topics: ${(info.topics || []).join(", ")}`);
          parts.push(`URL: ${info.html_url}`);
          logger.info("git", `Fetched repo info: ${info.full_name}`, { stars: info.stargazers_count });
        }
      } catch (e) {
        logger.warn("git", `Failed to fetch repo info: ${e}`);
      }

      try {
        const readmeRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/readme`, {
          headers: { "User-Agent": "CreateAnySite/1.0", Accept: "application/vnd.github.raw" },
        });
        if (readmeRes.ok) {
          const readme = await readmeRes.text();
          parts.push(`\n--- README ---\n${readme}`);
          logger.info("git", `Fetched README: ${readme.length} chars`);
        }
      } catch (e) {
        logger.warn("git", `Failed to fetch README: ${e}`);
      }

      try {
        const langRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/languages`, {
          headers: { "User-Agent": "CreateAnySite/1.0" },
        });
        if (langRes.ok) {
          const langs = await langRes.json();
          parts.push(`\nLanguages: ${Object.keys(langs).join(", ")}`);
        }
      } catch { /* skip */ }

      const result = parts.length > 0 ? parts.join("\n") : `Git repository URL: ${url}`;
      logger.info("git", `Total content: ${result.length} chars`);
      return result;
    }
    return `Git repository URL: ${url}`;
  }

  if (type === "bilibili") {
    const bvMatch = url.match(/BV[\w]+/);
    if (bvMatch) {
      try {
        const apiUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvMatch[0]}`;
        logger.info("bilibili", `Fetching video info: ${bvMatch[0]}`);
        const res = await fetch(apiUrl, { headers: { "User-Agent": "CreateAnySite/1.0" } });
        if (res.ok) {
          const data = await res.json();
          const v = data.data;
          if (v) {
            const result = [
              `Title: ${v.title}`,
              `Description: ${v.desc}`,
              `Author: ${v.owner?.name}`,
              `Views: ${v.stat?.view}, Likes: ${v.stat?.like}`,
              `Duration: ${Math.floor(v.duration / 60)}min`,
              `URL: ${url}`,
            ].join("\n");
            logger.info("bilibili", `Fetched video: "${v.title}"`, { views: v.stat?.view });
            return result;
          }
        }
      } catch (e) {
        logger.warn("bilibili", `Failed to fetch video info: ${e}`);
      }
    }
    return `Bilibili video: ${url}`;
  }

  if (type === "youtube") {
    const videoId = url.match(/(?:v=|youtu\.be\/)([^&?#]+)/)?.[1];
    logger.info("youtube", `Video ID: ${videoId}`);
    if (videoId) {
      return `YouTube video ID: ${videoId}\nURL: ${url}\n(Full metadata requires YouTube API key)`;
    }
    return `YouTube video: ${url}`;
  }

  return `URL: ${url}`;
}

// ─── Parse Markdown response into KnowledgeItems ───
const VALID_CATEGORIES = ["factual", "skills", "experience", "relational", "media", "opinion", "meta"];

function parseMarkdownToItems(markdown: string): KnowledgeItem[] {
  const items: KnowledgeItem[] = [];

  // Split by H2 headers: ## [category] title
  const sections = markdown.split(/^##\s+/m).filter((s) => s.trim());

  for (const section of sections) {
    const lines = section.split("\n");
    const headerLine = lines[0].trim();

    // Parse category from [category] prefix
    const catMatch = headerLine.match(/^\[(\w+)\]\s*(.+)$/);
    let category: KnowledgeCategory = "factual";
    let title = headerLine;

    if (catMatch) {
      const rawCat = catMatch[1].toLowerCase();
      if (VALID_CATEGORIES.includes(rawCat)) {
        category = rawCat as KnowledgeCategory;
      }
      title = catMatch[2].trim();
    }

    // Extract content (everything except header and Tags line)
    const contentLines: string[] = [];
    let tags: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const tagMatch = line.match(/^Tags:\s*(.+)$/i);
      if (tagMatch) {
        tags = tagMatch[1].split(",").map((t) => t.trim()).filter(Boolean);
      } else {
        contentLines.push(line);
      }
    }

    const content = contentLines.join("\n").trim();
    if (!title && !content) continue;

    items.push({
      id: crypto.randomUUID(),
      category,
      title: title || "Untitled",
      content,
      sourceId: "",
      selected: true,
      tags,
    });
  }

  // Fallback: if no H2 sections parsed, treat entire response as one meta item
  if (items.length === 0 && markdown.trim().length > 0) {
    logger.warn("ai", "No H2 sections found in AI response, creating single meta item");
    items.push({
      id: crypto.randomUUID(),
      category: "meta",
      title: "Source Summary",
      content: markdown.trim(),
      sourceId: "",
      selected: true,
      tags: [],
    });
  }

  return items;
}

// ─── AI: Extract knowledge items ───
async function aiExtractKnowledge(
  sourceContent: string,
  sourceName: string,
  sourceType: string,
): Promise<KnowledgeItem[]> {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) throw new Error("SILICONFLOW_API_KEY not configured");

  logger.info("ai", `Starting knowledge extraction for "${sourceName}" (${sourceType})`, {
    contentLength: sourceContent.length,
  });

  const systemPrompt = `You are a knowledge extraction AI. Given content from a ${sourceType} source, analyze it and extract structured knowledge items.

Use these categories:
- factual: Facts, dates, locations, numbers, events, definitions, names
- skills: Abilities, tools, programming languages, certifications, techniques
- experience: Work history, education, projects, achievements, career events
- relational: Connections between concepts, cause-effect, dependencies, workflows
- media: Images, videos, links, references to external resources
- opinion: Views, reviews, preferences, recommendations, personal takes
- meta: Summary, tags, keywords, overall themes, high-level categorization

Output in Markdown format. Each knowledge item is an H2 section with a category tag in square brackets at the start of the title. Include tags as a comma-separated list after "Tags:". Example:

## [factual] Person Name
John Smith, born 1990 in Beijing.
Tags: identity, personal-info

## [skills] Programming Languages
Proficient in Python, TypeScript, Go. 5+ years of experience with React.
Tags: programming, frontend, backend

## [experience] Senior Engineer at TechCorp
2020-2023. Led a team of 5 engineers building microservices architecture.
Tags: leadership, microservices

## [meta] Overall Summary
A senior full-stack engineer with strong backend skills and leadership experience.
Tags: summary, engineering

Rules:
- Extract ALL meaningful information, don't skip anything important
- Each item should be self-contained and understandable on its own
- Keep original detail and accuracy, don't summarize too aggressively
- For media items, include the URLs/references
- Include at least one "meta" item that summarizes the overall source
- Aim for 10-30 items depending on content richness`;

  const userMessage = `Source: ${sourceName}\nType: ${sourceType}\n\nContent:\n${sourceContent.slice(0, 60000)}`;

  const startTime = Date.now();
  const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "Pro/zai-org/GLM-5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 8192,
    }),
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (!response.ok) {
    const errText = await response.text();
    logger.error("ai", `AI request failed (${elapsed}s): ${response.status}`, { response: errText.slice(0, 500) });
    throw new Error(`AI analysis failed: ${response.status}`);
  }

  const result = await response.json();
  const rawContent = result.choices?.[0]?.message?.content || "";
  const tokenUsage = result.usage;

  logger.info("ai", `AI response received (${elapsed}s)`, {
    tokens: tokenUsage,
    responseLength: rawContent.length,
  });

  // Parse Markdown into knowledge items
  const items = parseMarkdownToItems(rawContent);

  logger.info("ai", `Extracted ${items.length} knowledge items`, {
    categories: items.reduce<Record<string, number>>((acc, i) => {
      acc[i.category] = (acc[i.category] || 0) + 1;
      return acc;
    }, {}),
  });

  return items;
}

// ─── DOCX extraction ───
async function extractFromDocx(buffer: ArrayBuffer): Promise<string> {
  logger.info("docx", "Extracting text from DOCX...");
  const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  logger.info("docx", `Extracted ${result.value.length} chars`);
  return result.value;
}

// ─── Detect file type from name ───
function detectFileType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "doc") return "docx";
  if (ext === "txt") return "txt";
  if (ext === "md") return "md";
  if (ext === "zip") return "zip";
  return "unknown";
}

// ─── Parse a single file buffer by type ───
async function parseFileContent(buffer: ArrayBuffer, name: string, type: string): Promise<string> {
  switch (type) {
    case "pdf": return await parsePdfWithMinerU(buffer, name);
    case "docx": return await extractFromDocx(buffer);
    case "txt":
    case "md": return new TextDecoder("utf-8").decode(new Uint8Array(buffer));
    default: return "";
  }
}

// ─── ZIP: parse each file individually ───
interface ZipFileResult {
  name: string;
  type: string;
  items: KnowledgeItem[];
}

async function parseZipPerFile(buffer: ArrayBuffer): Promise<ZipFileResult[]> {
  const zip = await JSZip.loadAsync(buffer);
  const results: ZipFileResult[] = [];
  const supportedExts = ["pdf", "docx", "doc", "txt", "md", "json", "csv", "yaml", "yml", "html"];

  for (const [filePath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const fileName = filePath.split("/").pop() || filePath;
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (!supportedExts.includes(ext)) continue;

    logger.info("zip-per-file", `Processing: ${fileName} (${ext})`);

    try {
      const fileBuffer = await entry.async("arraybuffer");
      const fileType = detectFileType(fileName);
      let content: string;

      if (fileType === "pdf") {
        content = await parsePdfWithMinerU(fileBuffer, fileName);
      } else if (fileType === "docx") {
        content = await extractFromDocx(fileBuffer);
      } else {
        // txt, md, json, csv, yaml, html — read as text
        content = await entry.async("string");
      }

      if (!content || content.trim().length < 10) {
        logger.warn("zip-per-file", `Skipping ${fileName}: too short`);
        continue;
      }

      const items = await aiExtractKnowledge(content, fileName, ext);
      results.push({ name: fileName, type: ext, items });
      logger.info("zip-per-file", `${fileName}: ${items.length} items extracted`);
    } catch (err) {
      logger.warn("zip-per-file", `Failed to process ${fileName}: ${err instanceof Error ? err.message : "error"}`);
    }
  }

  return results;
}

// ─── Main handler ───
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

      const sourceName = file.name;
      const buffer = await file.arrayBuffer();
      const fileType = detectFileType(sourceName);

      logger.info("handler", `[${requestId}] File upload: ${sourceName} (${(buffer.byteLength / 1024).toFixed(1)}KB), type: ${fileType}`);

      if (fileType === "zip") {
        // ZIP: parse each file individually
        const results = await parseZipPerFile(buffer);
        const allItems: KnowledgeItem[] = [];
        const fileResults: { name: string; type: string; itemCount: number }[] = [];

        for (const r of results) {
          allItems.push(...r.items);
          fileResults.push({ name: r.name, type: r.type, itemCount: r.items.length });
        }

        logger.info("handler", `[${requestId}] ZIP complete. ${results.length} files → ${allItems.length} items`);
        return NextResponse.json({ items: allItems, fileResults, sourceType: "zip" });

      } else if (["pdf", "docx", "txt", "md"].includes(fileType)) {
        // Single file
        const content = await parseFileContent(buffer, sourceName, fileType);

        if (!content || content.trim().length < 10) {
          return NextResponse.json({ error: "No readable content found in file" }, { status: 400 });
        }

        logger.info("handler", `[${requestId}] Content: ${content.length} chars, sending to AI...`);
        const items = await aiExtractKnowledge(content, sourceName, fileType);
        logger.info("handler", `[${requestId}] Complete. ${items.length} items from "${sourceName}"`);

        return NextResponse.json({ items, sourceType: fileType });
      } else {
        return NextResponse.json({ error: `Unsupported file type: ${fileType}` }, { status: 400 });
      }

    } else {
      // URL source (git, bilibili, youtube)
      const body = await req.json();
      if (!body.url || !body.type) return NextResponse.json({ error: "URL and type required" }, { status: 400 });

      logger.info("handler", `[${requestId}] URL source: ${body.url}, type: ${body.type}`);
      const content = await fetchUrlContent(body.url, body.type);

      logger.info("handler", `[${requestId}] Content: ${content.length} chars, sending to AI...`);
      const items = await aiExtractKnowledge(content, body.url, body.type);
      logger.info("handler", `[${requestId}] Complete. ${items.length} items`);

      return NextResponse.json({ items, sourceType: body.type });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("handler", `[${requestId}] Error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
