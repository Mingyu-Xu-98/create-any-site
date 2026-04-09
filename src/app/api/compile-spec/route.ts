import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { skills } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { logger } from "@/lib/logger";
import type { KnowledgeItem } from "@/lib/knowledge";
import fs from "fs/promises";
import path from "path";
import { chatCompletion, getChatProviderSummary, hasChatProvider } from "@/lib/llm";
import { requireAuth, unauthorized } from "@/lib/require-auth";

const SPEC_PROMPT_PATH = path.join(process.cwd(), "src/prompts/compile-spec.md");

/**
 * POST /api/compile-spec
 *
 * Compiles a Site Spec from knowledge + user intent + skills.
 *
 * Input:
 *   - knowledge: KnowledgeItem[] (selected items from knowledge base)
 *   - intent: { siteType, theme, layout, customTheme, conversation summary }
 *   - skillIds: string[] (skills activated during chat, already at Level 1)
 *
 * Output:
 *   - spec: SiteSpec JSON
 *   - gaps: missing information list
 */
export async function POST(req: NextRequest) {
  const userId = await requireAuth();
  if (!userId) return unauthorized();

  const requestId = crypto.randomUUID().slice(0, 8);
  if (!hasChatProvider()) {
    return NextResponse.json({ error: "No LLM provider configured. Set OPENROUTER_API_KEY or SILICONFLOW_API_KEY." }, { status: 500 });
  }

  const { knowledge, intent, skillIds } = await req.json();
  const selectedKnowledge = (knowledge as KnowledgeItem[]).filter(k => k.selected);

  logger.info("compile-spec", `[${requestId}] Starting spec compilation`, {
    knowledgeCount: selectedKnowledge.length,
    siteType: intent?.siteType,
    theme: intent?.theme,
    skillCount: skillIds?.length || 0,
  });

  // ─── Load the compile-spec orchestration prompt ───
  let specPrompt: string;
  try {
    specPrompt = await fs.readFile(SPEC_PROMPT_PATH, "utf-8");
  } catch {
    logger.error("compile-spec", `[${requestId}] Failed to load compile-spec.md`);
    return NextResponse.json({ error: "Spec compilation prompt not found" }, { status: 500 });
  }

  // ─── Level 0: Load all skill descriptions for the AI to select from ───
  const allSkills = await db.select({
    id: skills.id,
    name: skills.name,
    description: skills.description,
    category: skills.category,
    siteTypes: skills.siteTypes,
  }).from(skills).where(eq(skills.enabled, 1));

  const skillCatalog = allSkills.map(s =>
    `- **${s.name}** (id:${s.id}) [${s.category}]: ${s.description}`
  ).join("\n");

  // ─── Level 1: Load full instructions for pre-activated skills ───
  let activatedSkillContext = "";
  const preActivatedIds: string[] = Array.isArray(skillIds) ? skillIds : [];

  if (preActivatedIds.length > 0) {
    const loaded = await db.select({
      id: skills.id,
      name: skills.name,
      indexContent: skills.indexContent,
    }).from(skills).where(inArray(skills.id, preActivatedIds));

    activatedSkillContext = loaded
      .map(s => `### Activated Skill: ${s.name} (id:${s.id})\n\n${s.indexContent}`)
      .join("\n\n---\n\n");

    logger.info("compile-spec", `[${requestId}] Loaded ${loaded.length} pre-activated skills`);
  }

  // ─── Build knowledge summary by category ───
  const knowledgeByCategory: Record<string, string[]> = {};
  for (const item of selectedKnowledge) {
    const cat = item.category || "meta";
    if (!knowledgeByCategory[cat]) knowledgeByCategory[cat] = [];
    knowledgeByCategory[cat].push(`[${item.title}] ${item.content}`);
  }

  const knowledgeSummary = Object.entries(knowledgeByCategory)
    .map(([cat, items]) => `## ${cat} (${items.length} items)\n${items.join("\n\n")}`)
    .join("\n\n---\n\n");

  // ─── Compose the final prompt ───
  const systemPrompt = specPrompt;

  const userMessage = `请根据以下输入编译 Site Spec。

## 用户意图
- 网站类型: ${intent?.siteType || "未指定"}
- 视觉风格: ${intent?.theme || "未指定"}
- 布局偏好: ${intent?.layout || "自动"}
- 自定义风格描述: ${intent?.customTheme || "无"}
- 用户对话摘要: ${intent?.conversationSummary || "无"}
 - 技术栈增强建议: ${Array.isArray(intent?.techStackHints) ? intent.techStackHints.join(", ") : (intent?.techStackHints || "无")}
 - 资产/图片/渲染建议: ${Array.isArray(intent?.assetIdeas) ? intent.assetIdeas.join(", ") : (intent?.assetIdeas || "无")}

## 知识库内容 (${selectedKnowledge.length} 条)
${knowledgeSummary}

## 可用 Skill 目录 (Level 0 — 仅描述)
${skillCatalog || "无可用 skill"}

${activatedSkillContext ? `## 已激活的 Skill (Level 1 — 完整指令)\n\n${activatedSkillContext}` : ""}

请严格按照编译指南输出 Site Spec JSON。`;

  logger.info("compile-spec", `[${requestId}] Sending to AI (prompt: ${systemPrompt.length + userMessage.length} chars, llm=${getChatProviderSummary()})`);

  const startTime = Date.now();
  let completion;
  try {
    const session = await (await import("@/lib/auth")).auth();
    completion = await chatCompletion({
      requestId,
      label: "compile-spec",
      systemPrompt,
      userPrompt: userMessage,
      temperature: 0.3,
      maxTokens: 16384,
      userId: session?.user?.id,
    });
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const message = err instanceof Error ? err.message : "Unknown AI error";
    logger.error("compile-spec", `[${requestId}] AI error (${elapsed}s): ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const rawContent = completion.content || "";

  logger.info("compile-spec", `[${requestId}] AI response (${elapsed}s): ${rawContent.length} chars`, {
    tokens: completion.usage,
  });

  // ─── Parse the Spec JSON ───
  let spec;
  try {
    let jsonStr = rawContent;
    const codeMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) jsonStr = codeMatch[1];
    spec = JSON.parse(jsonStr.trim());
  } catch (parseErr) {
    logger.error("compile-spec", `[${requestId}] Failed to parse spec JSON`, {
      error: parseErr instanceof Error ? parseErr.message : "parse error",
      raw: rawContent.slice(0, 500),
    });
    return NextResponse.json({
      error: "Failed to parse spec JSON",
      rawContent,
    }, { status: 500 });
  }

  logger.info("compile-spec", `[${requestId}] Spec compiled successfully`, {
    siteType: spec.product?.siteType,
    sectionsCount: spec.sections?.length,
    gapsCount: spec.meta?.gaps?.length,
    skillsActivated: spec.skillPlan?.activated?.length,
  });

  return NextResponse.json({ spec });
}
