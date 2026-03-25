import { NextRequest, NextResponse } from "next/server";
import type { KnowledgeItem } from "@/lib/knowledge";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { skills, sites } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

const CODE_CONTEXT_FILES = [
  "src/app/page.tsx", "src/app/globals.css", "src/app/layout.tsx",
  "src/i18n/translations.ts", "src/components/LanguageProvider.tsx",
];

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "SILICONFLOW_API_KEY not configured" }, { status: 500 });

  const { messages, knowledge, currentSelections, loadedSkills, siteId, phase } = await req.json();
  const selectedKnowledge = (knowledge as KnowledgeItem[]).filter(k => k.selected);

  // Load skill catalog
  const allSkills = await db.select({ id: skills.id, name: skills.name, description: skills.description, category: skills.category })
    .from(skills).where(eq(skills.enabled, 1));
  const skillCatalog = allSkills.map(s => `- ${s.name} (id:${s.id}) [${s.category}]: ${s.description}`).join("\n") || "No skills.";

  // Load activated skills
  const loadedSkillIds: string[] = Array.isArray(loadedSkills) ? loadedSkills : [];
  let activatedContext = "";
  if (loadedSkillIds.length > 0) {
    const loaded = await db.select({ id: skills.id, name: skills.name, indexContent: skills.indexContent })
      .from(skills).where(inArray(skills.id, loadedSkillIds));
    activatedContext = loaded.map(s => `### Skill: ${s.name}\n${s.indexContent}`).join("\n\n---\n\n");
  }

  // Load code context if site exists
  let codeContext = "";
  let hasSiteCode = false;
  let currentPrd = "";
  if (siteId) {
    const site = await db.select({ fileMap: sites.fileMap, prd: sites.prd }).from(sites).where(eq(sites.id, siteId)).get();
    if (site?.prd) currentPrd = site.prd;
    if (site?.fileMap) {
      try {
        const fileMap: Record<string, string> = JSON.parse(site.fileMap);
        const codeFiles: string[] = [];
        let totalChars = 0;
        for (const key of CODE_CONTEXT_FILES) {
          if (fileMap[key] && totalChars + fileMap[key].length < 40000) {
            codeFiles.push(`### ${key}\n\`\`\`\n${fileMap[key]}\n\`\`\``);
            totalChars += fileMap[key].length;
          }
        }
        for (const [key, content] of Object.entries(fileMap)) {
          if (CODE_CONTEXT_FILES.includes(key)) continue;
          if (!key.endsWith(".tsx") && !key.endsWith(".css") && !key.endsWith(".ts")) continue;
          if (totalChars + content.length < 40000) { codeFiles.push(`### ${key}\n\`\`\`\n${content}\n\`\`\``); totalChars += content.length; }
        }
        if (codeFiles.length > 0) { codeContext = codeFiles.join("\n\n"); hasSiteCode = true; }
      } catch {}
    }
  }

  // Knowledge summary
  const knowledgeContext = selectedKnowledge.map(k => `[${k.category}] ${k.title}: ${k.content}`).join("\n\n").slice(0, 30000);
  const knowledgeSummary = selectedKnowledge.length > 0
    ? `${selectedKnowledge.length} items: ${Object.entries(selectedKnowledge.reduce<Record<string, number>>((a, k) => { a[k.category] = (a[k.category] || 0) + 1; return a; }, {})).map(([c, n]) => `${c}:${n}`).join(", ")}`
    : "None";

  logger.info("chat-build", `[${requestId}] phase=${phase || "auto"}, ${messages.length} msgs, knowledge=${knowledgeSummary}, skills=${allSkills.length}, code=${hasSiteCode}`);

  // ─── Build system prompt based on phase ───
  const systemPrompt = buildSystemPrompt({
    phase: phase || "auto",
    knowledgeContext,
    knowledgeSummary,
    skillCatalog,
    activatedContext,
    codeContext,
    hasSiteCode,
    currentPrd,
    currentSelections,
  });

  const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "Pro/zai-org/GLM-5",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.5,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    logger.error("chat-build", `[${requestId}] AI error: ${response.status}`);
    return NextResponse.json({ error: `AI error: ${response.status} ${errText}` }, { status: 500 });
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "";
  logger.info("chat-build", `[${requestId}] Response: ${content.length} chars`, { tokens: result.usage });

  // Extract all action blocks
  let action = null;
  const actionMatch = content.match(/```action\s*([\s\S]*?)```/);
  if (actionMatch) {
    try {
      action = JSON.parse(actionMatch[1].trim());
      logger.info("chat-build", `[${requestId}] Action: ${action.type}`);
    } catch { logger.warn("chat-build", `[${requestId}] Invalid action JSON`); }
  }

  return NextResponse.json({ content, action });
}

// ─── System prompt builder ───
function buildSystemPrompt(ctx: {
  phase: string; knowledgeContext: string; knowledgeSummary: string;
  skillCatalog: string; activatedContext: string;
  codeContext: string; hasSiteCode: boolean; currentPrd: string;
  currentSelections: unknown;
}): string {
  return `You are a professional website product manager and builder. You guide users through a structured process to create high-quality websites.

## Knowledge Base (${ctx.knowledgeSummary}):
${ctx.knowledgeContext || "(Empty)"}

## Available Skills:
${ctx.skillCatalog}
${ctx.activatedContext ? `\n## Activated Skills:\n${ctx.activatedContext}` : ""}
${ctx.currentPrd ? `\n## Current PRD:\n${ctx.currentPrd}` : ""}
${ctx.hasSiteCode ? `\n## Current Site Code:\n${ctx.codeContext}` : ""}

## Workflow: PRD-Driven Build Process

### Phase 1: Requirements Gathering
Ask the user 3-5 questions to understand their needs. Output questions as **option cards** using this format:

\`\`\`action
{
  "type": "options",
  "question": "Question text",
  "options": [
    {"id": "value1", "icon": "emoji", "label": "Label", "desc": "Short description"},
    {"id": "value2", "icon": "emoji", "label": "Label", "desc": "Short description"}
  ],
  "multiSelect": false
}
\`\`\`

Ask these in sequence (one per message):
1. Site type & goal
2. Target audience
3. Visual style preference
4. Core features (multiSelect: true)
5. Knowledge source selection (if knowledge base has data)

### Phase 2: PRD Generation
After gathering requirements, generate a complete PRD document. Output it as:

\`\`\`action
{
  "type": "prd",
  "prd": {
    "siteType": "portfolio|brand|blog|landing|custom",
    "targetAudience": "...",
    "coreGoal": "...",
    "contentSections": ["Hero", "About", "Skills", "Projects", "Timeline", "Contact"],
    "narrativeSkills": [{"skillName": "...", "purpose": "..."}],
    "theme": "cyberpunk|minimalist|...",
    "colorScheme": "description of colors",
    "typography": "font pairing description",
    "designSkills": [{"skillName": "...", "purpose": "..."}],
    "techStack": "Next.js 16 + React 19 + Tailwind CSS 4",
    "features": ["i18n", "chatbot", "animations", "share"],
    "pages": ["page structure list"],
    "knowledgeSources": ["source names"],
    "knowledgeCount": 18,
    "markdown": "# Full PRD in markdown format\\n\\n## 1. Project Overview\\n...(complete PRD document)"
  }
}
\`\`\`

The markdown field should be a complete, well-structured PRD document including:
- Project overview (type, audience, goal)
- Content planning with narrative logic (which storytelling skills to use and why)
- Visual design plan (theme, colors, typography, which design skills to use)
- Design system approach (which ui-skills to query)
- Technical implementation (stack, features)
- Page structure with section descriptions
- Knowledge data mapping

### Phase 3: Build Execution
After user confirms PRD, output a build action:

\`\`\`action
{
  "type": "generate",
  "siteType": "...",
  "theme": "...",
  "layout": "...",
  "customTheme": "detailed style description from PRD"
}
\`\`\`

Include a thinking process in your response:
\`\`\`thinking
[分析] Analyzing knowledge base: found 18 items...
[决策] Site type: portfolio based on resume data
[设计] Calling ui-skill for design system...
[构建] Generating page structure...
\`\`\`

### Phase 4: Modification (if site exists)
${ctx.hasSiteCode ? `The site already exists. For modifications, use:
\`\`\`action
{
  "type": "modify",
  "changes": [
    {"file": "path", "action": "replace", "content": "full new content"}
  ],
  "description": "what changed"
}
\`\`\`

Also update the PRD if the modification changes the spec:
\`\`\`action
{
  "type": "update_prd",
  "changes": "description of what changed in the spec",
  "prd": { ...updated PRD object }
}
\`\`\`` : "No site exists yet. Follow Phase 1-3."}

## Rules:
- Ask ONE question at a time using option cards
- After all questions answered, generate PRD
- After PRD confirmed, trigger build
- Always include thinking process during build decisions
- For modifications to existing sites, prefer "modify" over "generate"
- When updating PRD, increment version number
- Respond in the same language the user uses (Chinese or English)
- Be concise but thorough in PRD content
- If user says "确认构建" or "confirm build" or similar, proceed to Phase 3`;
}
