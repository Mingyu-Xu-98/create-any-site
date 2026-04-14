/**
 * Edit Agent — lightweight incremental code modifier.
 *
 * Unlike Code Agent (creates from scratch), Edit Agent receives
 * existing code + a specific instruction and makes minimal changes.
 */
import fs from "fs/promises";
import path from "path";
import { chatCompletion } from "./llm";
import { logger } from "./logger";
import { getRelevantHints } from "./error-collector";
import type { EditIntent } from "./edit-classifier";

const PROMPTS_DIR = path.join(process.cwd(), "src/prompts/agents");

export interface FileChange {
  path: string;       // e.g. "src/app/page.tsx"
  content: string;    // Full file content after edit
}

export interface EditAgentResult {
  changes: FileChange[];
  summary: string;       // Brief description of what changed
  valid: boolean;
}

export interface EditAgentInput {
  instruction: string;
  intent: EditIntent;
  currentFiles: Record<string, string>;  // Only the relevant files for this intent
  buildError?: string;                    // For "fix" intent — the error to fix
  userId?: string;
  siteId?: string;
}

/**
 * Run the Edit Agent to make incremental changes.
 *
 * Context is kept small (~8K tokens) by only passing files relevant
 * to the edit intent. This is much lighter than Code Agent's ~40K.
 */
export async function runEditAgent(input: EditAgentInput): Promise<EditAgentResult> {
  let prompt = await fs.readFile(path.join(PROMPTS_DIR, "edit-agent.md"), "utf-8");

  // Inject error hints
  const hints = getRelevantHints();
  prompt = prompt.replace("ERROR_HINTS_PLACEHOLDER", hints || "(none)");

  // Build user prompt with current files
  const fileSections = Object.entries(input.currentFiles)
    .map(([filePath, content]) => {
      const ext = filePath.split(".").pop() || "txt";
      return `### Current ${filePath}\n\`\`\`${ext}\n${content}\n\`\`\``;
    })
    .join("\n\n");

  let userPrompt = `## Edit Instruction
${input.instruction}

## Edit Intent: ${input.intent}

## Current Files
${fileSections}`;

  if (input.buildError) {
    userPrompt += `\n\n## Build Error\n\`\`\`\n${input.buildError.slice(0, 2000)}\n\`\`\``;
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  const result = await chatCompletion({
    requestId,
    systemPrompt: prompt,
    userPrompt,
    label: "edit-agent",
    userId: input.userId,
    siteId: input.siteId,
  });

  // Parse output — extract code blocks with file labels
  const changes = parseEditOutput(result.content);
  const summary = extractSummary(result.content, changes);

  logger.info("edit-agent", `Edit complete: ${changes.length} files changed, intent=${input.intent}`, {
    instruction: input.instruction.slice(0, 100),
  });

  return {
    changes,
    summary,
    valid: changes.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Output parsing
// ---------------------------------------------------------------------------

/**
 * Parse Edit Agent output to extract file changes.
 * Expects labeled code blocks: ```page.tsx ... ``` or ```globals.css ... ```
 */
function parseEditOutput(output: string): FileChange[] {
  const changes: FileChange[] = [];

  // Match labeled code blocks: ```label\n...content...\n```
  const blockRegex = /```(\S+)\s*\n([\s\S]*?)```/g;
  let match;

  while ((match = blockRegex.exec(output)) !== null) {
    const label = match[1];
    const content = match[2].trim();
    if (!content) continue;

    const filePath = labelToPath(label);
    if (filePath) {
      changes.push({ path: filePath, content });
    }
  }

  return changes;
}

/** Map code block labels to file paths */
function labelToPath(label: string): string | null {
  const MAP: Record<string, string> = {
    "page.tsx": "src/app/page.tsx",
    "tsx": "src/app/page.tsx",
    "globals.css": "src/app/globals.css",
    "css": "src/app/globals.css",
    "layout.tsx": "src/app/layout.tsx",
    "translations.ts": "src/i18n/translations.ts",
    "ts": "src/i18n/translations.ts",
  };

  // Direct match
  if (MAP[label]) return MAP[label];

  // Path-like label: src/app/page.tsx → use as-is
  if (label.startsWith("src/") || label.startsWith("public/")) return label;

  return null;
}

/** Extract summary text after code blocks */
function extractSummary(output: string, changes: FileChange[]): string {
  // Find text after the last code block
  const lastBlockEnd = output.lastIndexOf("```");
  if (lastBlockEnd === -1) return output.slice(0, 200);

  const afterBlocks = output.slice(lastBlockEnd + 3).trim();
  if (afterBlocks.length > 10) {
    return afterBlocks.slice(0, 500);
  }

  return `Modified ${changes.length} file(s): ${changes.map((c) => c.path.split("/").pop()).join(", ")}`;
}
