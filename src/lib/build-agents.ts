import fs from "fs/promises";
import path from "path";
import { logger } from "@/lib/logger";
import { loadStageSkillBundle } from "./project-skill-bundles";
import { chatCompletion } from "./llm";

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

function serializeCurrentPrd(currentPrd: string): string {
  if (!currentPrd) return "";
  return currentPrd;
}

export async function runBuildConversation(ctx: BuildConversationContext): Promise<AgentRunResult> {
  const latestUserMessage = getLatestUserMessage(ctx.messages);
  const currentPrd = serializeCurrentPrd(ctx.currentPrd);

  if (currentPrd && EXECUTION_CONFIRM_RE.test(latestUserMessage)) {
    return runExecutionAgent(ctx, latestUserMessage);
  }

  const conceptResult = await runIdeationAgent(ctx);
  if (conceptResult.action?.type === "handoff_to_planner") {
    return runPlanningAgent(ctx, conceptResult.content, conceptResult.action);
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
