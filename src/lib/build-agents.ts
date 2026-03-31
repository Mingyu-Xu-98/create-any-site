import fs from "fs/promises";
import path from "path";
import { logger } from "@/lib/logger";
import { loadStageSkillBundle } from "./project-skill-bundles";
import { chatCompletion } from "./llm";
import { getCapabilityManifest } from "./capability-registry";

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
}

interface AgentRunResult {
  content: string;
  action: Record<string, unknown> | null;
}

const PROMPTS_DIR = path.join(process.cwd(), "src/prompts/agents");
const EXECUTION_CONFIRM_RE = /\b(confirm build|build it|go ahead|ship it|start build|开始构建|确认构建|开始生成|确认生成|开始开发)\b/i;
const MAX_IDEATION_USER_TURNS = 3;

function extractAction(content: string): Record<string, unknown> | null {
  const patterns = [
    /```action\s*([\s\S]*?)```/,
    /```json\s*(\{[\s\S]*?"type"\s*:\s*"(?:options|prd|generate|modify|activate_skills|update_prd|handoff_to_planner)"[\s\S]*?\})\s*```/,
    /```\s*(\{[\s\S]*?"type"\s*:\s*"(?:options|prd|generate|modify|activate_skills|update_prd|handoff_to_planner)"[\s\S]*?\})\s*```/,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (!match) continue;

    try {
      return JSON.parse(match[1].trim()) as Record<string, unknown>;
    } catch {
      continue;
    }
  }

  const fallback = content.match(/\{[\s\S]*?"type"\s*:\s*"(options|prd|generate|modify|activate_skills|update_prd|handoff_to_planner)"[\s\S]*?\}/);
  if (!fallback) return null;

  try {
    return JSON.parse(fallback[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
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
): Promise<AgentRunResult> {
  logger.info("build-agents", `[${requestId}] ${label}: prompt ${systemPrompt.length + userPrompt.length} chars`);

  const result = await chatCompletion({
    requestId,
    label,
    systemPrompt,
    userPrompt,
    history,
    temperature: 0.35,
    maxTokens: 8192,
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

function countMeaningfulUserTurns(messages: BuildChatMessage[]): number {
  return messages.filter((message) => {
    if (message.role !== "user") return false;
    const trimmed = message.content.trim();
    if (!trimmed) return false;
    if (/^\[.*\]\s*/.test(trimmed)) return true;
    return trimmed.length >= 4;
  }).length;
}

function buildForcedPlanningHandoff(ctx: BuildConversationContext, conceptOutput: string): Record<string, unknown> {
  const currentPrd = ctx.currentPrd.trim();
  const parsedSiteType = currentPrd.match(/"siteType"\s*:\s*"([^"]+)"/)?.[1] || currentPrd.match(/siteType[:\s]+([a-zA-Z-]+)/i)?.[1] || "portfolio";
  const THEME_POOL = ["cyberpunk", "ghibli", "glassmorphism", "retro", "brutalist", "cinematic", "bold-creative", "editorial", "nature", "gradient-mesh", "neo-tokyo", "minimalist"];
  const randomTheme = THEME_POOL[Math.floor(Math.random() * THEME_POOL.length)];
  const parsedTheme = currentPrd.match(/"theme"\s*:\s*"([^"]+)"/)?.[1] || currentPrd.match(/theme[:\s]+([a-zA-Z-]+)/i)?.[1] || randomTheme;
  const parsedLayout = currentPrd.match(/"layout"\s*:\s*"([^"]+)"/)?.[1] || currentPrd.match(/layout[:\s]+([a-zA-Z-]+)/i)?.[1] || "card-grid";
  const latestUserMessage = getLatestUserMessage(ctx.messages);

  return {
    type: "handoff_to_planner",
    siteType: parsedSiteType,
    targetAudience: "Use the conversation and knowledge context to infer the target audience if still ambiguous.",
    coreGoal: latestUserMessage || "Create a strong first website preview with the information already provided.",
    brandPersonality: [],
    storyNeeds: [],
    themeDirection: parsedTheme,
    layoutDirection: parsedLayout,
    featurePriorities: ["hero", "about", "projects", "contact"],
    constraints: ["Question limit reached. Produce a strong first PRD and preview without asking more questions."],
    reasoning: `The conversation has already reached the hard question cap of ${MAX_IDEATION_USER_TURNS} user turns. Stop interviewing and create the best possible PRD from available information.`,
    skillHints: ["storytelling", "ui-skill", "style-skills"],
    conceptSummary: conceptOutput.slice(0, 4000),
  };
}

function serializeCurrentPrd(currentPrd: string): string {
  if (!currentPrd) return "";
  return currentPrd;
}

export async function runBuildConversation(ctx: BuildConversationContext): Promise<AgentRunResult> {
  const latestUserMessage = getLatestUserMessage(ctx.messages);
  const currentPrd = serializeCurrentPrd(ctx.currentPrd);
  const userTurnCount = countMeaningfulUserTurns(ctx.messages);

  // Inject capability manifest into context for agent awareness
  const capabilityManifest = getCapabilityManifest();
  const enrichedCtx = {
    ...ctx,
    activatedContext: [
      ctx.activatedContext,
      "\n\n## Available Capabilities\n" + capabilityManifest,
    ].filter(Boolean).join(""),
  };

  // Fast path: if site already has code and user is requesting a modification
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

  // Normal path: new site generation
  if (currentPrd && EXECUTION_CONFIRM_RE.test(latestUserMessage)) {
    return runExecutionAgent(enrichedCtx, latestUserMessage);
  }

  const conceptResult = await runIdeationAgent(enrichedCtx);
  if (conceptResult.action?.type === "handoff_to_planner") {
    return runPlanningAgent(enrichedCtx, conceptResult.content, conceptResult.action);
  }

  if (conceptResult.action?.type === "options" && userTurnCount >= MAX_IDEATION_USER_TURNS) {
    return runPlanningAgent(enrichedCtx, conceptResult.content, buildForcedPlanningHandoff(enrichedCtx, conceptResult.content));
  }

  return conceptResult;
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

  return callSiliconFlow(ctx.requestId, "ideation-agent", prompt, userPrompt);
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

  return callSiliconFlow(ctx.requestId, "planning-agent", prompt, userPrompt);
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

  return callSiliconFlow(ctx.requestId, "execution-agent", prompt, userPrompt);
}
