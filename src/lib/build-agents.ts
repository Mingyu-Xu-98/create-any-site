import fs from "fs/promises";
import path from "path";
import { logger } from "@/lib/logger";
import { loadStageSkillBundle } from "./project-skill-bundles";
import { chatCompletion } from "./llm";
import { getCapabilityManifest } from "./capability-registry";
import { getAssetManifest } from "./assets";
import { getRecipeManifest } from "./recipes/loader";
import { getVariantCatalog } from "./components";
import { getRelevantHints } from "./error-collector";

type ChatRole = "system" | "user" | "assistant";

export interface BuildChatMessage {
  role: Exclude<ChatRole, "system">;
  content: string;
}

export interface BuildConversationContext {
  requestId: string;
  messages: BuildChatMessage[];
  knowledgeContext: string;
  knowledgeSummary: string;
  knowledgeGroupIndex: string;
  skillCatalog: string;
  activatedContext: string;
  codeContext: string;
  hasSiteCode: boolean;
  currentPrd: string;
  currentSelections: unknown;
  /** For usage tracking */
  userId?: string;
  siteId?: string;
}

interface AgentRunResult {
  content: string;
  action: Record<string, unknown> | null;
}

const PROMPTS_DIR = path.join(process.cwd(), "src/prompts/agents");
const EXECUTION_CONFIRM_RE = /\b(confirm build|build it|go ahead|ship it|start build|开始构建|确认构建|开始生成|确认生成|开始开发)\b/i;

/** All recognized action types */
const ACTION_TYPES = [
  "options", "prd", "generate", "modify", "activate_skills", "update_prd",
  "handoff_to_planner", "design_plan", "build_plan", "activate_capabilities",
].join("|");

const ACTION_RE = new RegExp(`"type"\\s*:\\s*"(?:${ACTION_TYPES})"`, "");

function extractAction(content: string): Record<string, unknown> | null {
  // Priority 1: ```action ... ```
  const actionBlock = content.match(/```action\s*([\s\S]*?)```/);
  if (actionBlock) {
    try { return JSON.parse(actionBlock[1].trim()) as Record<string, unknown>; } catch {}
  }

  // Priority 2: ```json { "type": "..." } ```
  const jsonBlock = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonBlock) {
    try {
      const parsed = JSON.parse(jsonBlock[1].trim()) as Record<string, unknown>;
      if (typeof parsed.type === "string" && ACTION_RE.test(JSON.stringify(parsed))) return parsed;
    } catch {}
  }

  // Priority 3: bare JSON object with type field
  const bare = content.match(new RegExp(`\\{[\\s\\S]*?${ACTION_RE.source}[\\s\\S]*?\\}`));
  if (bare) {
    try { return JSON.parse(bare[0]) as Record<string, unknown>; } catch {}
  }

  return null;
}

async function loadPrompt(name: string): Promise<string> {
  return fs.readFile(path.join(PROMPTS_DIR, name), "utf-8");
}

async function callSiliconFlow(
  requestId: string,
  label: string,
  systemPrompt: string,
  userPrompt: string,
  history: BuildChatMessage[] = [],
  useAdvancedModel = false,
  userId?: string,
  siteId?: string,
): Promise<AgentRunResult> {
  logger.info("build-agents", `[${requestId}] ${label}: prompt ${systemPrompt.length + userPrompt.length} chars${useAdvancedModel ? " (advanced model)" : ""}`);

  const result = await chatCompletion({
    requestId,
    label,
    systemPrompt,
    userPrompt,
    history,
    temperature: 0.35,
    maxTokens: useAdvancedModel ? 16384 : 8192,
    useAdvancedModel,
    userId,
    siteId,
  });
  const content = result.content;
  return { content, action: extractAction(content) };
}

function getLatestUserMessage(messages: BuildChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}

function serializeCurrentPrd(currentPrd: string): string {
  if (!currentPrd) return "";
  return currentPrd;
}

export async function runBuildConversation(ctx: BuildConversationContext): Promise<AgentRunResult> {
  const latestUserMessage = getLatestUserMessage(ctx.messages);
  const currentPrd = serializeCurrentPrd(ctx.currentPrd);

  // Inject capability manifest into context for agent awareness
  const capabilityManifest = getCapabilityManifest();
  const enrichedCtx = {
    ...ctx,
    activatedContext: [
      ctx.activatedContext,
      "\n\n## Available Capabilities\n" + capabilityManifest,
    ].filter(Boolean).join(""),
  };

  // ===== Edit existing site: ideation for modify =====
  if (enrichedCtx.hasSiteCode && currentPrd) {
    if (EXECUTION_CONFIRM_RE.test(latestUserMessage)) {
      return runExecutionAgent(enrichedCtx, latestUserMessage);
    }
    const result = await runIdeationAgent(enrichedCtx);
    if (result.action?.type === "modify") return result;
    if (result.action?.type === "handoff_to_planner") {
      return runPlanningAgent(enrichedCtx, result.content, result.action);
    }
    return result;
  }

  // ===== New build: one-step Design Agent =====
  const designResult = await runDesignAgent(enrichedCtx);

  // If Design Agent asks a question (rare: only when knowledge is empty)
  if (designResult.action?.type === "options") return designResult;

  // If Design Agent outputs a design_plan, convert to generate action format
  if (designResult.action?.type === "design_plan") {
    return {
      content: designResult.content,
      action: {
        type: "generate",
        siteType: designResult.action.siteMode || "portfolio",
        theme: designResult.action.theme || designResult.action.recipe || "minimalist",
        compositionPlan: designResult.action.compositionPlan || null,
        visualDirection: designResult.action.visualDirection || null,
        contentMapping: designResult.action.contentMapping || null,
        customTheme: designResult.action.customTheme || "",
        recipe: designResult.action.recipe || null,
        recipeLayers: designResult.action.layers || null,
        recipeOverrides: designResult.action.overrides || null,
      },
    };
  }

  // Fallback: treat as regular content
  return designResult;
}

async function runIdeationAgent(ctx: BuildConversationContext): Promise<AgentRunResult> {
  const [prompt, skillBundle] = await Promise.all([
    loadPrompt("concept-agent.md"),
    loadStageSkillBundle("ideation"),
  ]);

  const userPrompt = `## Selected Knowledge (${ctx.knowledgeSummary})
${ctx.knowledgeContext || "(Empty)"}

${ctx.knowledgeGroupIndex ? `## Knowledge Group Indexes\n${ctx.knowledgeGroupIndex}\n` : ""}
## Available DB Skills
${ctx.skillCatalog || "No database skills."}

${ctx.activatedContext ? `## Activated DB Skill Context\n${ctx.activatedContext}\n` : ""}
## Project Skill Bundle For Ideation
${skillBundle}

## Current PRD
${ctx.currentPrd || "(None yet)"}

## Current Site Code
${ctx.hasSiteCode ? ctx.codeContext : "(No site code yet)"}

## Current Selections
${JSON.stringify(ctx.currentSelections ?? {}, null, 2)}

## Conversation
${ctx.messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n")}`;

  // Edit mode (existing site): use advanced model for higher quality code modifications
  const isEditMode = Boolean(ctx.hasSiteCode && ctx.currentPrd);
  return callSiliconFlow(ctx.requestId, "ideation-agent", prompt, userPrompt, [], isEditMode, ctx.userId, ctx.siteId);
}

async function runPlanningAgent(
  ctx: BuildConversationContext,
  conceptOutput: string,
  handoffAction: Record<string, unknown>,
): Promise<AgentRunResult> {
  const [prompt, skillBundle] = await Promise.all([
    loadPrompt("planning-agent.md"),
    loadStageSkillBundle("planning"),
  ]);

  const userPrompt = `## Concept Agent Output
${conceptOutput}

## Structured Handoff
${JSON.stringify(handoffAction, null, 2)}

## Selected Knowledge (${ctx.knowledgeSummary})
${ctx.knowledgeContext || "(Empty)"}

${ctx.knowledgeGroupIndex ? `## Knowledge Group Indexes\n${ctx.knowledgeGroupIndex}\n` : ""}
## Project Skill Bundle For Planning
${skillBundle}

## Available DB Skills
${ctx.skillCatalog || "No database skills."}

${ctx.activatedContext ? `## Activated DB Skill Context\n${ctx.activatedContext}\n` : ""}
## Current Selections
${JSON.stringify(ctx.currentSelections ?? {}, null, 2)}`;

  return callSiliconFlow(ctx.requestId, "planning-agent", prompt, userPrompt, [], false, ctx.userId, ctx.siteId);
}

async function runExecutionAgent(
  ctx: BuildConversationContext,
  latestUserMessage: string,
): Promise<AgentRunResult> {
  const [prompt, skillBundle] = await Promise.all([
    loadPrompt("execution-agent.md"),
    loadStageSkillBundle("execution"),
  ]);

  const userPrompt = `## Approved PRD
${ctx.currentPrd}

## Latest User Confirmation
${latestUserMessage}

## Selected Knowledge (${ctx.knowledgeSummary})
${ctx.knowledgeContext || "(Empty)"}

## Project Skill Bundle For Execution
${skillBundle}

## Current Selections
${JSON.stringify(ctx.currentSelections ?? {}, null, 2)}

## Generator Constraints
- siteType: portfolio | brand | blog | landing | custom
- theme: cyberpunk | minimalist | ghibli | glassmorphism | retro | brutalist | cinematic | bold-creative | editorial | nature | gradient-mesh | neo-tokyo | tpl-business | tpl-resume-bold | tpl-resume-dark | tpl-blog | custom
- layout: two-column | split-screen | asymmetric | f-shape | z-shape | card-grid | hero-media | masonry | magazine | fixed-nav | hidden-nav | interactive | custom
- prefer values supported by the generator
- use customTheme to preserve nuanced brand guidance from the PRD`;

  return callSiliconFlow(ctx.requestId, "execution-agent", prompt, userPrompt, [], false, ctx.userId, ctx.siteId);
}

// ---- Design Agent (streamlined advanced mode: one-step design) ----

export async function runDesignAgent(ctx: BuildConversationContext): Promise<AgentRunResult> {
  let prompt = await loadPrompt("design-agent.md");

  // Inject dynamic catalogs into prompt
  const assetManifest = getAssetManifest();
  prompt = prompt.replace("ASSET_MANIFEST_PLACEHOLDER", assetManifest);

  // Inject recipe manifest (base themes + layers) and component variant catalog
  const recipeManifest = getRecipeManifest();
  const variantCatalog = getVariantCatalog();
  prompt = prompt.replace("RECIPE_MANIFEST_PLACEHOLDER", recipeManifest);
  prompt = prompt.replace("VARIANT_CATALOG_PLACEHOLDER", variantCatalog);

  // Inject composition patterns catalog
  const { getPatternCatalog } = await import("./components/composition-patterns");
  prompt = prompt.replace("PATTERN_CATALOG_PLACEHOLDER", getPatternCatalog());

  const userPrompt = `## User Request
${getLatestUserMessage(ctx.messages)}

## Knowledge Summary
${ctx.knowledgeSummary || "None"}

## Knowledge Content
${ctx.knowledgeContext || "(Empty)"}

## Current Selections
${JSON.stringify(ctx.currentSelections ?? {}, null, 2)}

## Conversation History
${ctx.messages.slice(-4).map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n")}`;

  return callSiliconFlow(ctx.requestId, "design-agent", prompt, userPrompt, [], true, ctx.userId, ctx.siteId);
}

// ---- Code Agent (writes actual page code from DesignPlan) ----

export interface CodeAgentResult {
  pageTsx: string;
  globalsCssExtra: string;
  valid: boolean;
  errors: string[];
}

/**
 * Repair hint passed on retry when a previous Code Agent output failed
 * `next build`. Gives the model the broken code + the build error output
 * so it can produce a fix instead of starting from scratch.
 */
export interface CodeAgentRepairHint {
  previousPageTsx: string;
  previousGlobalsCss?: string;
  buildError: string;
  attempt: number; // 1-indexed, how many repair attempts so far (1 = first repair)
}

export async function runCodeAgent(
  ctx: BuildConversationContext,
  designPlan: Record<string, unknown>,
  assetCss: string,
  repairHint?: CodeAgentRepairHint,
  /** Formatted component reference block from reference-extractor */
  componentReferences?: string,
): Promise<CodeAgentResult> {
  const prompt = await loadPrompt("code-agent.md");

  let userPrompt = `## Design Plan
${JSON.stringify(designPlan, null, 2)}

## Content Data (translations object structure)
The site data is accessed via \`t.*\` from useLanguage(). Here's what's available:
ALL text content MUST come from \`t.*\`, never hardcoded. Key fields:
- \`t.hero.name\` — the person's REAL name (MUST display prominently in hero)
- \`t.hero.title\` — professional title / tagline
- \`t.hero.tags[]\` — skill/role tags
- \`t.about.text\` — bio / introduction
- \`t.projects[]\` — each with: title, org, desc, tags[], highlights[], detail, link, role, period
- \`t.experience[]\` — each with: title, org, period, desc, highlights[]
- \`t.skills[]\` — each with: title, skills[]
- \`t.education[]\`, \`t.awards[]\`, \`t.publications[]\`, \`t.demos[]\`
- \`t.contact.email\`, \`t.contact.links[]\`

## Knowledge Content (the user's ACTUAL data — read this to understand what the site is about)
${ctx.knowledgeContext?.slice(0, 40000) || "(Empty — generate a creative placeholder site)"}

## Asset CSS (already resolved, use these classes)
${assetCss || "(No asset CSS)"}

## Available CSS Variables
--color-bg, --color-text, --color-accent, --color-text-muted, --color-bg-card, --color-bg-card-solid, --color-line, --color-accent-soft, --color-green

## Pre-generated Components (just import, do NOT rewrite)
- \`@/components/LanguageProvider\` — useLanguage() hook
- \`@/components/CartoonAssistant\` — animated SVG character + chat (use when chatMode is "cartoon" or unspecified)
- \`@/components/ChatBot\` — classic floating chat bubble (use when chatMode is "classic")
- \`@/components/SharePoster\` — share feature
- \`@/components/ProjectDemo\` — embed Bilibili/YouTube/GitHub/StackBlitz (props: url, title?, type?)

${componentReferences || ""}

${getRelevantHints({ theme: (designPlan as any).theme, siteType: (designPlan as any).siteType })}

## Instructions
1. Write the complete page.tsx and additional globals.css based on the Design Plan above.
2. Make it visually distinctive — this should NOT look like a generic template.
3. Check the Design Plan's compositionPlan.chatMode to decide which chat component to use.
4. The hero MUST display \`t.hero.name\` prominently. Do NOT skip the user's name.
5. If the Knowledge Content has projects/skills/experience, ensure the page has sections for them.
6. Do NOT put SVG illustrations inside each project card. Instead, create ONE themed SVG animation in the hero or about section.
7. For project cards with \`t.projects[].detail\` or \`highlights\`, add a modal/overlay detail view (use useState to toggle).`;

  if (repairHint) {
    // Append a repair section. Keep the original instructions above so the
    // model still knows the design intent, but make it crystal-clear that
    // this is a fix request, not a fresh generation.
    const errSlice = repairHint.buildError.slice(0, 2000);
    const pageSlice = repairHint.previousPageTsx.slice(0, 20000);
    const cssSlice = repairHint.previousGlobalsCss
      ? repairHint.previousGlobalsCss.slice(0, 4000)
      : "";
    userPrompt += `

## ⚠️ REPAIR MODE — Previous Attempt Failed to Build (attempt ${repairHint.attempt})
Your previous generation produced code that did NOT compile with \`next build\`.
Do NOT start from scratch. Study the failing code and the error output below,
identify the bug, and produce a CORRECTED version. Preserve the design intent
and layout — change only what is necessary to make it compile.

### Build Error Output (last relevant lines)
\`\`\`
${errSlice}
\`\`\`

### Previous page.tsx (the one that failed)
\`\`\`tsx
${pageSlice}
\`\`\`
${cssSlice ? `\n### Previous globals.css extras\n\`\`\`css\n${cssSlice}\n\`\`\`\n` : ""}
Output a COMPLETE corrected \`page.tsx\` (and \`globals.css\` if needed) in the
same code-block format as a normal response. Do NOT output a diff or just
describe the fix — output the full corrected file(s).`;
  }

  const result = await callSiliconFlow(ctx.requestId, repairHint ? `code-agent-repair-${repairHint.attempt}` : "code-agent", prompt, userPrompt, [], true, ctx.userId, ctx.siteId);

  // Parse code blocks from response
  const pageTsx = extractCodeBlock(result.content, "page.tsx") || extractCodeBlock(result.content, "tsx") || "";
  const globalsCssExtra = extractCodeBlock(result.content, "globals.css") || extractCodeBlock(result.content, "css") || "";

  logger.info("code-agent", `[${ctx.requestId}] Response: ${result.content.length} chars, page.tsx: ${pageTsx.length} chars, css: ${globalsCssExtra.length} chars`);
  if (!pageTsx) {
    // Log first 500 chars to debug parsing failure
    logger.warn("code-agent", `[${ctx.requestId}] Could not extract code block. Response preview: ${result.content.slice(0, 500)}`);
  }

  // Validate the generated code
  const errors = validateGeneratedCode(pageTsx);

  return {
    pageTsx,
    globalsCssExtra,
    valid: errors.length === 0 && pageTsx.length > 100,
    errors,
  };
}

function extractCodeBlock(content: string, label: string): string | null {
  const normalized = content.replace(/\r\n/g, "\n");

  // Strategy 1: Find all properly closed code blocks
  const allBlocks: Array<{ lang: string; code: string }> = [];
  const blockRegex = /```(\S*)\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = blockRegex.exec(normalized)) !== null) {
    allBlocks.push({ lang: match[1] || "", code: match[2].trim() });
  }

  // Strategy 2: Find UNCLOSED code blocks (truncated by token limit)
  // Look for ```label\n...content... without a closing ```
  const unclosedBlocks: Array<{ lang: string; code: string }> = [];
  const unclosedRegex = /```(\S*)\s*\n([\s\S]+)$/g;
  let um;
  while ((um = unclosedRegex.exec(normalized)) !== null) {
    const code = um[2].trim();
    // Only use if it's substantial and not already captured as a closed block
    if (code.length > 200 && !allBlocks.some(b => code.startsWith(b.code.slice(0, 100)))) {
      unclosedBlocks.push({ lang: um[1] || "", code });
    }
  }

  const allCandidates = [...allBlocks, ...unclosedBlocks];

  if (label === "page.tsx" || label === "tsx") {
    const exact = allCandidates.find(b => b.lang === "page.tsx" || b.lang === "page");
    if (exact && exact.code.length > 50) return autoRepairTruncation(exact.code);

    const tsxBlock = allCandidates.find(b => /^(tsx|typescript|jsx|ts)$/i.test(b.lang));
    if (tsxBlock && tsxBlock.code.length > 50) return autoRepairTruncation(tsxBlock.code);

    const reactBlock = allCandidates
      .filter(b => b.code.includes("export default function") || b.code.includes('"use client"'))
      .sort((a, b) => b.code.length - a.code.length)[0];
    if (reactBlock) return autoRepairTruncation(reactBlock.code);
  }

  if (label === "globals.css" || label === "css") {
    const exact = allCandidates.find(b => b.lang === "globals.css" || b.lang === "css" || b.lang === "scss");
    if (exact) return exact.code;

    const cssBlock = allCandidates
      .filter(b => b.code.includes("{") && b.code.includes("}") && !b.code.includes("export default"))
      .sort((a, b) => b.code.length - a.code.length)[0];
    if (cssBlock) return cssBlock.code;
  }

  return null;
}

/**
 * Auto-repair truncated React component code.
 * Closes unclosed braces, JSX tags, and component function.
 */
function autoRepairTruncation(code: string): string {
  let repaired = code;

  // Count braces
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const missingBraces = openBraces - closeBraces;

  // Count JSX divs
  const openDivs = (repaired.match(/<div[\s>]/g) || []).length;
  const closeDivs = (repaired.match(/<\/div>/g) || []).length;
  const missingDivs = openDivs - closeDivs;

  // Count parens
  const openParens = (repaired.match(/\(/g) || []).length;
  const closeParens = (repaired.match(/\)/g) || []).length;
  const missingParens = openParens - closeParens;

  if (missingDivs > 0 || missingBraces > 0 || missingParens > 0) {
    // Add closing tags
    repaired += "\n";
    for (let i = 0; i < missingDivs; i++) repaired += "      </div>\n";
    for (let i = 0; i < missingParens; i++) repaired += "    )";
    // Ensure component function closes properly
    if (!repaired.trimEnd().endsWith("}")) {
      for (let i = 0; i < Math.min(missingBraces, 3); i++) repaired += "\n}";
    }
  }

  // Ensure the component has a proper ending
  if (repaired.includes("export default function") && !repaired.match(/\}\s*$/)) {
    repaired += "\n}\n";
  }

  return repaired;
}

function validateGeneratedCode(code: string): string[] {
  const errors: string[] = [];
  if (!code) { errors.push("No code generated"); return errors; }

  // Must have "use client"
  if (!code.includes('"use client"') && !code.includes("'use client'")) {
    errors.push('Missing "use client" directive');
  }

  // Must have useLanguage
  if (!code.includes("useLanguage")) {
    errors.push("Missing useLanguage import/usage");
  }

  // Must export default function
  if (!code.includes("export default function")) {
    errors.push("Missing default export function");
  }

  // Check for unclosed JSX tags (simple heuristic)
  const openDivs = (code.match(/<div[\s>]/g) || []).length;
  const closeDivs = (code.match(/<\/div>/g) || []).length;
  if (Math.abs(openDivs - closeDivs) > 2) {
    errors.push(`Unbalanced div tags: ${openDivs} open, ${closeDivs} close`);
  }

  // Check for common JSX errors
  if (code.includes('className="') && code.includes("className={`")) {
    // Mixed is fine
  }

  // Must have return statement with JSX
  if (!code.includes("return (") && !code.includes("return(")) {
    errors.push("Missing return statement with JSX");
  }

  return errors;
}
