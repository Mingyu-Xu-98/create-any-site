import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import mammoth from "mammoth";
import type { KnowledgeItem, KnowledgeCategory } from "@/lib/knowledge";
import { logger } from "@/lib/logger";
import { saveUserImage, isImageFile } from "@/lib/asset-store";
import { auth } from "@/lib/auth";
import { parsePdfWithMinerU as sharedParsePdfWithMinerU, basicPdfExtract as sharedBasicPdfExtract, parsePdfSafe as sharedParsePdfSafe } from "@/lib/pdf-parser";

// ─── PDF Parsing (delegates to shared module @/lib/pdf-parser) ───

async function parsePdfWithMinerU(buffer: ArrayBuffer, filename: string): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  return sharedParsePdfWithMinerU(buffer, filename, userId ? {
    saveImage: (fn, buf, src) => saveUserImage(userId, fn, buf, src),
  } : undefined);
}

function basicPdfExtract(buffer: ArrayBuffer): string {
  return sharedBasicPdfExtract(buffer);
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
const VALID_CATEGORIES = ["factual", "skills", "experience", "relational", "media", "opinion", "meta", "workflow", "framework"];

interface ParsedRelation {
  fromTitle: string;
  relationType: string;
  toTitle: string;
}

interface ParseResult {
  items: KnowledgeItem[];
  relations: ParsedRelation[];
}

function parseRelationsFromContent(content: string): ParsedRelation[] {
  const relations: ParsedRelation[] = [];
  const validTypes = ["used_in", "belongs_to", "requires", "produced", "collaborated_with", "led_to", "part_of"];
  const lines = content.split("\n");
  for (const line of lines) {
    // Match: - FROM -> TYPE -> TO
    const match = line.match(/^-\s*(.+?)\s*->\s*(\w+)\s*->\s*(.+)$/);
    if (match) {
      const [, fromTitle, relationType, toTitle] = match;
      if (validTypes.includes(relationType)) {
        relations.push({ fromTitle: fromTitle.trim(), relationType, toTitle: toTitle.trim() });
      }
    }
  }
  return relations;
}

function parseMarkdownToItemsAndRelations(markdown: string): ParseResult {
  const result = parseMarkdownToItems(markdown);
  // Extract relations from the Knowledge Relations meta item
  const relationsItem = result.find(item => item.title === "Knowledge Relations");
  const relations = relationsItem ? parseRelationsFromContent(relationsItem.content) : [];
  return { items: result, relations };
}

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

    // Extract content, Tags, and UseCase lines
    const contentLines: string[] = [];
    let tags: string[] = [];
    let useCase = "";

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const tagMatch = line.match(/^Tags:\s*(.+)$/i);
      const useCaseMatch = line.match(/^UseCase:\s*(.+)$/i);
      if (tagMatch) {
        tags = tagMatch[1].split(",").map((t) => t.trim()).filter(Boolean);
      } else if (useCaseMatch) {
        useCase = useCaseMatch[1].trim();
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
      useCase: useCase || undefined,
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
): Promise<{ items: KnowledgeItem[]; relations: ParsedRelation[] }> {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) throw new Error("SILICONFLOW_API_KEY not configured");

  logger.info("ai", `Starting knowledge extraction for "${sourceName}" (${sourceType})`, {
    contentLength: sourceContent.length,
  });

  const systemPrompt = `You are a knowledge extraction AI using the Ontology method. Given content from a ${sourceType} source, extract ALL knowledge into structured units following MECE principle (Mutually Exclusive, Collectively Exhaustive).

## Knowledge Types

### Factual knowledge (things that ARE):
- factual: Basic facts, definitions, data points, statistics, names, dates, locations, numbers
- experience: Work history, education, projects, achievements, career events, milestones
- relational: Connections between concepts, cause-effect, dependencies, collaborations
- media: Images, videos, links, references to external resources, portfolios
- opinion: Views, reviews, preferences, recommendations, personal takes
- meta: Summary, tags, keywords, overall themes

### Procedural knowledge (things you DO):
- skills: Abilities, tools, programming languages, certifications, techniques
- workflow: Step-by-step processes, methodologies, standard operating procedures
- framework: Analysis frameworks, decision models, evaluation criteria

## Output Format

Each knowledge unit is an H2 section with category tag, followed by content and metadata:

\`\`\`
## [category] Title
Content here (keep original detail, don't over-summarize)
Tags: tag1, tag2, tag3
UseCase: When to use this knowledge (one sentence describing the retrieval scenario)
\`\`\`

## MECE Rules (IMPORTANT):
- Each unit should be self-contained and understandable on its own
- Units must NOT overlap — don't repeat the same information in different units
- Together they must cover ALL information in the source
- Structured data (tables, lists, JSON arrays) must stay as ONE unit — never split rows of the same table
- When unsure, prefer fewer larger units over many tiny ones
- Keep original detail and accuracy
- Aim for 10-30 units depending on content richness
- Always include at least one "meta" unit summarizing the overall source

## UseCase examples:
- "When user asks about work experience at company X"
- "When building the projects section of a portfolio"
- "When the chatbot needs to answer questions about technical skills"
- "When generating the hero section headline and tagline"

## At the END, add TWO special sections:

### 1. Relations section — describe connections between extracted units:

## [meta] Knowledge Relations
Format each relation as: \`FROM_TITLE -> RELATION_TYPE -> TO_TITLE\`
Valid relation types: used_in, belongs_to, requires, produced, collaborated_with, led_to, part_of

Example:
- Python -> used_in -> Data Pipeline Project
- Senior Engineer Role -> belongs_to -> TechCorp
- React -> requires -> JavaScript
- ML Research -> produced -> Published Paper on NLP
- Internship at StartupX -> led_to -> Full-time at TechCorp

List ALL meaningful connections between the extracted units above.
Tags: relations, graph

### 2. Routing section — map units to website sections:

## [meta] Knowledge Routing Summary
A bullet list mapping each extracted unit to its best website section:
- hero: [list unit titles relevant to hero/headline]
- about: [list unit titles relevant to about/bio]
- projects: [list unit titles relevant to projects]
- skills: [list unit titles relevant to skills]
- timeline: [list unit titles relevant to work history]
- education: [list unit titles relevant to education]
- contact: [list unit titles relevant to contact info]
- chatbot: [list unit titles that enrich chatbot knowledge]
Tags: routing, mapping`;

  const userMessage = `Source: ${sourceName}\nType: ${sourceType}\n\nContent:\n${sourceContent.slice(0, 60000)}`;

  const MAX_RETRIES = 2;
  let response: Response | null = null;
  let lastError = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min per attempt

      response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
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
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (response.ok) {
        logger.info("ai", `AI request succeeded (attempt ${attempt + 1}, ${elapsed}s)`);
        break;
      }

      const errText = await response.text();
      lastError = `${response.status}: ${errText.slice(0, 200)}`;
      logger.warn("ai", `AI request failed (attempt ${attempt + 1}, ${elapsed}s): ${lastError}`);
      response = null;
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      lastError = err instanceof Error ? err.message : "fetch failed";
      logger.warn("ai", `AI request error (attempt ${attempt + 1}, ${elapsed}s): ${lastError}`);
      response = null;
    }

    // Wait before retry
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
    }
  }

  if (!response || !response.ok) {
    throw new Error(`AI analysis failed after ${MAX_RETRIES + 1} attempts: ${lastError}`);
  }

  const result = await response.json();
  const rawContent = result.choices?.[0]?.message?.content || "";
  const tokenUsage = result.usage;

  logger.info("ai", `AI response parsed`, {
    tokens: tokenUsage,
    responseLength: rawContent.length,
  });

  // Parse Markdown into knowledge items and relations
  const { items, relations } = parseMarkdownToItemsAndRelations(rawContent);

  logger.info("ai", `Extracted ${items.length} knowledge items, ${relations.length} relations`, {
    categories: items.reduce<Record<string, number>>((acc, i) => {
      acc[i.category] = (acc[i.category] || 0) + 1;
      return acc;
    }, {}),
    relations: relations.length,
  });

  return { items, relations };
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

/** Try MinerU first, fall back to basic PDF extraction on timeout/error */
async function parsePdfSafe(buffer: ArrayBuffer, name: string): Promise<string> {
  try {
    return await parsePdfWithMinerU(buffer, name);
  } catch (err) {
    logger.warn("pdf", `MinerU failed for ${name}: ${err instanceof Error ? err.message : "unknown"}, falling back to basic extraction`);
    return basicPdfExtract(buffer);
  }
}

// ─── Parse a single file buffer by type ───
async function parseFileContent(buffer: ArrayBuffer, name: string, type: string): Promise<string> {
  switch (type) {
    case "pdf": return await parsePdfSafe(buffer, name);
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

  // Extract images from ZIP
  const session = await auth();
  const userId = session?.user?.id;
  let imageCount = 0;
  for (const [filePath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const fileName = filePath.split("/").pop() || filePath;
    if (isImageFile(fileName) && userId) {
      try {
        const imgBuffer = await entry.async("nodebuffer");
        if (imgBuffer.byteLength > 500) {
          await saveUserImage(userId, fileName, imgBuffer, "zip-upload");
          imageCount++;
        }
      } catch { /* skip */ }
    }
  }
  if (imageCount > 0) logger.info("zip-per-file", `Extracted ${imageCount} images from ZIP`);

  // Collect files to process
  const filesToProcess: Array<{ filePath: string; fileName: string; ext: string; entry: JSZip.JSZipObject }> = [];
  for (const [filePath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const fileName = filePath.split("/").pop() || filePath;
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    if (!supportedExts.includes(ext)) continue;
    filesToProcess.push({ filePath, fileName, ext, entry });
  }

  // Process in parallel with concurrency limit (2 at a time to avoid API overload)
  const CONCURRENCY = 2;
  for (let i = 0; i < filesToProcess.length; i += CONCURRENCY) {
    const batch = filesToProcess.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(batch.map(async ({ fileName, ext, entry }) => {
      logger.info("zip-per-file", `Processing: ${fileName} (${ext})`);
      const fileBuffer = await entry.async("arraybuffer");
      const fileType = detectFileType(fileName);
      let content: string;

      if (fileType === "pdf") {
        content = await parsePdfSafe(fileBuffer, fileName);
      } else if (fileType === "docx") {
        content = await extractFromDocx(fileBuffer);
      } else {
        content = await entry.async("string");
      }

      if (!content || content.trim().length < 10) {
        logger.warn("zip-per-file", `Skipping ${fileName}: too short`);
        return null;
      }

      const { items } = await aiExtractKnowledge(content, fileName, ext);
      logger.info("zip-per-file", `${fileName}: ${items.length} items extracted`);
      return { name: fileName, type: ext, items };
    }));

    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value) {
        results.push(r.value);
      } else if (r.status === "rejected") {
        logger.warn("zip-per-file", `Batch file failed: ${r.reason instanceof Error ? r.reason.message : "error"}`);
      }
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

      // Direct image upload — save to asset store, return as media knowledge item
      if (isImageFile(sourceName)) {
        const imgSession = await auth();
        if (imgSession?.user?.id) {
          const savedName = await saveUserImage(imgSession.user.id, sourceName, Buffer.from(buffer), "direct-upload");
          logger.info("handler", `[${requestId}] Image saved: ${savedName}`);
          const item: KnowledgeItem = {
            id: crypto.randomUUID(),
            category: "media",
            title: sourceName,
            content: `Image: /images/${savedName}`,
            sourceId: "",
            selected: true,
            tags: ["image", sourceName.split(".").pop() || ""],
          };
          return NextResponse.json({ items: [item], images: [savedName], sourceType: "image" });
        }
      }

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
        const { items, relations: extractedRelations } = await aiExtractKnowledge(content, sourceName, fileType);
        logger.info("handler", `[${requestId}] Complete. ${items.length} items from "${sourceName}"`);

        return NextResponse.json({ items, relations: extractedRelations, sourceType: fileType });
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
      const { items, relations: extractedRelations } = await aiExtractKnowledge(content, body.url, body.type);
      logger.info("handler", `[${requestId}] Complete. ${items.length} items`);

      return NextResponse.json({ items, relations: extractedRelations, sourceType: body.type });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.error("handler", `[${requestId}] Error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
