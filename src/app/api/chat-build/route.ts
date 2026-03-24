import { NextRequest, NextResponse } from "next/server";
import type { KnowledgeItem } from "@/lib/knowledge";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "SILICONFLOW_API_KEY not configured" }, { status: 500 });
  }

  const { messages, knowledge, currentSelections, loadedSkills } = await req.json();
  const selectedKnowledge = (knowledge as KnowledgeItem[]).filter(k => k.selected);

  // ─── Level 0: Load all skill descriptions ───
  const allSkills = await db.select({
    id: skills.id,
    name: skills.name,
    description: skills.description,
    category: skills.category,
    siteTypes: skills.siteTypes,
  }).from(skills).where(eq(skills.enabled, 1));

  const skillCatalog = allSkills.length > 0
    ? allSkills.map(s => `- ${s.name} (id:${s.id}) [${s.category}]: ${s.description}`).join("\n")
    : "No skills available.";

  logger.info("chat-build", `[${requestId}] ${messages.length} msgs, ${selectedKnowledge.length} knowledge, ${allSkills.length} skills`);

  // ─── Level 1: Load full content for previously activated skills ───
  const loadedSkillIds: string[] = Array.isArray(loadedSkills) ? loadedSkills : [];
  let activatedContext = "";

  if (loadedSkillIds.length > 0) {
    const loaded = await db.select({
      id: skills.id,
      name: skills.name,
      indexContent: skills.indexContent,
    }).from(skills).where(inArray(skills.id, loadedSkillIds));

    activatedContext = loaded
      .map(s => `### Skill: ${s.name} (id:${s.id})\n${s.indexContent}`)
      .join("\n\n---\n\n");

    logger.info("chat-build", `[${requestId}] ${loaded.length} skills loaded at Level 1`);
  }

  // Build knowledge context (with token budget)
  const knowledgeContext = selectedKnowledge
    .map(k => `[${k.category}] ${k.title}: ${k.content}`)
    .join("\n\n")
    .slice(0, 30000);

  const systemPrompt = `You are a website building assistant. Help users create websites based on their knowledge base.

## User's Knowledge Base:
${knowledgeContext || "(No knowledge items selected)"}

## Current Site Configuration:
${JSON.stringify(currentSelections || {}, null, 2)}

## Available Skills — Read descriptions to decide relevance:
${skillCatalog}

${activatedContext ? `## Activated Skills — Follow these instructions when building:\n\n${activatedContext}` : ""}

## Your Role:
1. Help users decide what kind of website to build based on their knowledge
2. Suggest site type, theme, layout based on the content
3. If skills from the catalog match the user's needs, recommend activating them
4. When the user confirms, output a generate action with selected skillIds

## Action Formats:

**Activate skills** (loads full instructions for next turn):
\`\`\`action
{"type": "activate_skills", "skillIds": ["id1", "id2"], "reason": "why these skills are relevant"}
\`\`\`

**Generate the site** (include all relevant skill IDs):
\`\`\`action
{"type": "generate", "siteType": "...", "theme": "...", "layout": "...", "skillIds": ["id1", "id2"]}
\`\`\`

## Skill Usage (Progressive Disclosure):
- You see skill DESCRIPTIONS (Level 0). These tell you WHEN a skill should be used.
- To understand HOW a skill works, use the activate_skills action. Its full instructions will appear in the next turn.
- Only recommend skills whose descriptions clearly match the user's intent.
- When generating, include all activated skill IDs so the generator can apply them.
- Do NOT guess what a skill does from its name — only use activated skills.

## Guidelines:
- Be concise but helpful
- Proactively suggest skills that match the user's request
- Explain why you're recommending each skill
- Respond in the same language the user uses`;

  const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "Pro/zai-org/GLM-5",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.5,
      max_tokens: 4096,
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

  // Extract action
  let action = null;
  const actionMatch = content.match(/```action\s*([\s\S]*?)```/);
  if (actionMatch) {
    try {
      action = JSON.parse(actionMatch[1].trim());
      logger.info("chat-build", `[${requestId}] Action: ${action.type}`, action);
    } catch {
      logger.warn("chat-build", `[${requestId}] Invalid action JSON`);
    }
  }

  return NextResponse.json({ content, action });
}
