import { NextRequest, NextResponse } from "next/server";
import type { KnowledgeItem } from "@/lib/knowledge";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { skills, sites, knowledgeGroups } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { runBuildConversation } from "@/lib/build-agents";
import { getChatProviderSummary, hasChatProvider } from "@/lib/llm";

const CODE_CONTEXT_FILES = [
  "src/app/page.tsx", "src/app/globals.css", "src/app/layout.tsx",
  "src/i18n/translations.ts", "src/components/LanguageProvider.tsx",
  "public/game.js", "public/main.js", "package.json", "next.config.mjs",
];

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  if (!hasChatProvider()) return NextResponse.json({ error: "No LLM provider configured. Set OPENROUTER_API_KEY or SILICONFLOW_API_KEY." }, { status: 500 });

  const { messages, knowledge, currentSelections, loadedSkills, siteId, phase, currentPrd: requestPrd } = await req.json();
  const selectedKnowledge = (knowledge as KnowledgeItem[]).filter(k => k.selected);
  const session = await (await import("@/lib/auth")).auth();

  // Load knowledge group indexes (Level 0: index.md summaries)
  let knowledgeGroupIndex = "";
  if (session?.user?.id) {
    const groups = await db.select({ name: knowledgeGroups.name, indexMd: knowledgeGroups.indexMd, sourceType: knowledgeGroups.sourceType })
      .from(knowledgeGroups).where(eq(knowledgeGroups.userId, session.user.id));
    if (groups.length > 0) {
      knowledgeGroupIndex = groups.map(g => g.indexMd ? `### ${g.name} (${g.sourceType})\n${g.indexMd.slice(0, 500)}` : `### ${g.name} (${g.sourceType})`).join("\n\n");
    }
  }

  // Load skill catalog
  const allSkills = await db.select({ id: skills.id, name: skills.name, description: skills.description, category: skills.category })
    .from(skills).where(eq(skills.enabled, 1));
  const skillCatalog = allSkills.map(s => `- ${s.name} (id:${s.id}) [${s.category}]: ${s.description}`).join("\n") || "No skills.";

  // Load activated skills (Level 1 + Level 2)
  const loadedSkillIds: string[] = Array.isArray(loadedSkills) ? loadedSkills : [];
  let activatedContext = "";
  if (loadedSkillIds.length > 0) {
    const loaded = await db.select({ id: skills.id, name: skills.name, indexContent: skills.indexContent, references: skills.references })
      .from(skills).where(inArray(skills.id, loadedSkillIds));
    activatedContext = loaded.map(s => {
      let context = `### Skill: ${s.name}\n${s.indexContent}`;
      if (s.references) {
        try {
          const refs: { name: string; content: string }[] = JSON.parse(s.references);
          if (refs.length > 0) {
            context += "\n\n#### References:\n" + refs.map(ref => `**${ref.name}:**\n${ref.content}`).join("\n\n");
          }
        } catch { /* ignore invalid JSON */ }
      }
      return context;
    }).join("\n\n---\n\n");
  }

  // Load code context if site exists
  let codeContext = "";
  let hasSiteCode = false;
  let persistedPrd = "";
  if (siteId) {
    const site = await db.select({ fileMap: sites.fileMap, prd: sites.prd }).from(sites).where(eq(sites.id, siteId)).get();
    if (site?.prd) persistedPrd = site.prd;
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
          if (
            !key.endsWith(".tsx") &&
            !key.endsWith(".css") &&
            !key.endsWith(".ts") &&
            !key.endsWith(".js") &&
            !key.endsWith(".mjs") &&
            !key.endsWith(".json")
          ) continue;
          if (!key.startsWith("src/") && !key.startsWith("public/") && key !== "package.json" && !key.startsWith("next.config")) continue;
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

  logger.info("chat-build", `[${requestId}] phase=${phase || "auto"}, ${messages.length} msgs, knowledge=${knowledgeSummary}, skills=${allSkills.length}, code=${hasSiteCode}, llm=${getChatProviderSummary()}`);
  try {
    const result = await runBuildConversation({
      requestId,
      messages,
      knowledgeContext,
      knowledgeSummary,
      knowledgeGroupIndex,
      skillCatalog,
      activatedContext,
      codeContext,
      hasSiteCode,
      currentPrd: typeof requestPrd === "string" && requestPrd.trim()
        ? requestPrd
        : requestPrd
          ? JSON.stringify(requestPrd, null, 2)
          : persistedPrd,
      currentSelections,
    });

    logger.info("chat-build", `[${requestId}] Response: ${result.content.length} chars`, {
      action: result.action?.type || null,
    });

    return NextResponse.json(result);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    logger.error("chat-build", `[${requestId}] AI error: ${errMsg}`);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
