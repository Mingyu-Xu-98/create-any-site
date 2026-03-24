import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import JSZip from "jszip";
import { logger } from "@/lib/logger";

// POST /api/admin/skills/upload — Upload a skill package (ZIP with index.md + reference files)
export async function POST(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    logger.info("skill-upload", `Uploading: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);

    const buffer = await file.arrayBuffer();
    let indexContent = "";
    const referenceFiles: { name: string; content: string }[] = [];

    if (file.name.endsWith(".zip")) {
      const zip = await JSZip.loadAsync(buffer);
      for (const [filePath, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        const ext = filePath.split(".").pop()?.toLowerCase();
        if (!["md", "txt", "json", "yaml", "yml", "csv"].includes(ext || "")) continue;

        try {
          const content = await entry.async("string");
          if (content.length === 0 || content.length > 200_000) continue;

          const filename = filePath.split("/").pop()?.toLowerCase() || "";

          // index.md / SKILL.md / README.md → Level 1 (main instruction)
          if (filename === "index.md" || filename === "skill.md" || filename === "readme.md") {
            indexContent = content;
          } else {
            // Everything else → Level 2 (reference docs)
            referenceFiles.push({ name: filePath, content });
          }
        } catch { /* skip unreadable */ }
      }
    } else if (file.name.endsWith(".md")) {
      indexContent = new TextDecoder().decode(buffer);
    }

    // Fallback: use first .md file as index
    if (!indexContent && referenceFiles.length > 0) {
      const firstMd = referenceFiles.find(f => f.name.endsWith(".md"));
      if (firstMd) {
        indexContent = firstMd.content;
        referenceFiles.splice(referenceFiles.indexOf(firstMd), 1);
      }
    }

    if (!indexContent) {
      return NextResponse.json({ error: "No index.md or markdown file found in the package" }, { status: 400 });
    }

    logger.info("skill-upload", `Parsed: index ${indexContent.length} chars, ${referenceFiles.length} reference files`);

    // AI: read index.md → generate name + trigger description
    const { name: aiName, description: aiDescription, category: aiCategory, siteTypes: aiSiteTypes } =
      await generateSkillMeta(indexContent);

    // Save with progressive disclosure structure
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(skills).values({
      id,
      name: aiName || file.name.replace(/\.(zip|md)$/i, "").replace(/[-_]/g, " "),
      description: aiDescription,
      category: aiCategory,
      indexContent,
      references: referenceFiles.length > 0 ? JSON.stringify(referenceFiles) : null,
      siteTypes: JSON.stringify(aiSiteTypes),
      enabled: 1,
      createdAt: now,
      updatedAt: now,
    });

    logger.info("skill-upload", `Saved: ${id} "${aiName}" (${referenceFiles.length} refs)`);

    return NextResponse.json({
      id,
      name: aiName,
      description: aiDescription,
      category: aiCategory,
      siteTypes: aiSiteTypes,
      indexLength: indexContent.length,
      referenceCount: referenceFiles.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    logger.error("skill-upload", `Failed: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── AI: Generate skill metadata from index.md ───
async function generateSkillMeta(indexContent: string): Promise<{
  name: string;
  description: string;
  category: string;
  siteTypes: string[];
}> {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    return { name: "", description: "", category: "other", siteTypes: [] };
  }

  const systemPrompt = `You analyze a skill's index.md and generate metadata for an AI skill registry.

Return ONLY a JSON object:
{
  "name": "Human-readable skill name (e.g. 'Glassmorphism Design', 'Typography Optimization')",
  "description": "A concise trigger description (1-2 sentences) that tells a builder AI WHEN to activate this skill. Focus on the CONDITIONS and SIGNALS, not how the skill works internally. Examples: 'Activate when the site uses frosted glass effects or translucent layered cards.' / 'Use when the site has dense text content that needs typographic hierarchy and readability improvements.'",
  "category": "design|content|layout|interaction|seo|other",
  "siteTypes": ["portfolio", "brand", "blog", "landing"]
}

Rules for the description field:
- Write it as a TRIGGER CONDITION for another AI to read
- Focus on observable signals: user intent, site type, visual style, content characteristics
- Do NOT describe what the skill does internally
- Keep under 50 words`;

  try {
    const res = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "Pro/zai-org/GLM-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this skill:\n\n${indexContent.slice(0, 6000)}` },
        ],
        temperature: 0.2,
        max_tokens: 512,
      }),
    });

    if (!res.ok) return { name: "", description: "", category: "other", siteTypes: [] };

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";
    let jsonStr = raw;
    const codeMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) jsonStr = codeMatch[1];

    const parsed = JSON.parse(jsonStr.trim());
    return {
      name: parsed.name || "",
      description: parsed.description || "",
      category: parsed.category || "other",
      siteTypes: Array.isArray(parsed.siteTypes) ? parsed.siteTypes : [],
    };
  } catch {
    return { name: "", description: "", category: "other", siteTypes: [] };
  }
}
