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
  kbContext?: string;                     // Knowledge base content (when user asks to add KB info)
  imageContext?: string;                  // Available user images metadata
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

  if (input.kbContext) {
    userPrompt += `\n\n## Knowledge Base Content\nUse this data to update the page content as instructed:\n${input.kbContext.slice(0, 15000)}`;
  }

  if (input.imageContext) {
    userPrompt += `\n\n${input.imageContext}`;
  }

  if (input.buildError) {
    userPrompt += `\n\n## Build Error\n\`\`\`\n${input.buildError.slice(0, 2000)}\n\`\`\``;
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  const result = await chatCompletion({
    requestId,
    systemPrompt: prompt,
    userPrompt,
    label: "edit-agent",
    maxTokens: 16384, // Edit Agent outputs complete files — need enough room for large page.tsx
    userId: input.userId,
    siteId: input.siteId,
  });

  // Parse output — extract code blocks with file labels
  const changes = parseEditOutput(result.content);
  const summary = extractSummary(result.content, changes);

  logger.info("edit-agent", `Edit complete: ${changes.length} files changed, intent=${input.intent}`, {
    instruction: input.instruction.slice(0, 100),
  });

  // Debug: log raw LLM output snippet when no changes extracted (helps diagnose parsing issues)
  if (changes.length === 0) {
    const preview = result.content.slice(0, 500).replace(/\n/g, "\\n");
    logger.warn("edit-agent", `No changes parsed from LLM output (${result.content.length} chars). Preview: ${preview}`);
  }

  // Validate changes: reject placeholder/abbreviated outputs that would break the build
  const validated = validateChanges(changes, input.currentFiles);

  return {
    changes: validated.changes,
    summary,
    valid: validated.valid,
  };
}

// ---------------------------------------------------------------------------
// Output parsing
// ---------------------------------------------------------------------------

/**
 * Parse Edit Agent output to extract file changes.
 *
 * Uses a **line-by-line state machine** instead of a single regex.
 * The old regex approach (`/```(\S+)\s*\n([\s\S]*?)```/g`) broke on
 * large outputs (22K+) because the lazy `[\s\S]*?` would either
 * mis-anchor on backticks inside the content or hit engine limits.
 *
 * Handles:
 * - Standard labels: ```page.tsx, ```globals.css
 * - Language markers: ```typescript, ```jsx, ```css
 * - Extended fences: ````, ````` (any ≥3 backticks)
 * - File path comments: // src/app/page.tsx at top of block
 * - Truncated output (no closing fence — accepts if content > 10 lines)
 */
function parseEditOutput(output: string): FileChange[] {
  const changes: FileChange[] = [];
  const seenPaths = new Set<string>();
  const lines = output.split("\n");

  let currentLabel: string | null = null;
  let currentContent: string[] = [];
  let fenceLen = 0; // number of backticks in the opening fence
  let inBlock = false;

  for (const line of lines) {
    if (!inBlock) {
      // Look for opening fence: ``` + label (at least 3 backticks)
      const openMatch = line.match(/^(`{3,})(\S+)\s*$/);
      if (openMatch) {
        fenceLen = openMatch[1].length;
        currentLabel = openMatch[2];
        currentContent = [];
        inBlock = true;
      }
    } else {
      // Look for closing fence: same or more backticks, nothing else on the line
      const closeMatch = line.match(/^`{3,}\s*$/);
      if (closeMatch) {
        emitBlock(currentLabel!, currentContent, changes, seenPaths);
        currentLabel = null;
        currentContent = [];
        inBlock = false;
      } else {
        currentContent.push(line);
      }
    }
  }

  // Handle truncated output — LLM hit max_tokens before emitting closing fence
  if (inBlock && currentLabel && currentContent.length > 10) {
    logger.warn("edit-agent", `Accepting truncated code block (no closing fence): ${currentLabel}, ${currentContent.length} lines`);
    emitBlock(currentLabel, currentContent, changes, seenPaths);
  }

  return changes;
}

/** Resolve a code block (label + content lines) into a FileChange and push it. */
function emitBlock(
  label: string,
  contentLines: string[],
  changes: FileChange[],
  seenPaths: Set<string>,
) {
  const content = contentLines.join("\n").trim();
  if (!content) return;

  // 1. File path comment at top: // src/app/page.tsx
  let filePath = extractFilePathFromContent(content);
  // 2. Label mapping
  if (!filePath) filePath = labelToPath(label);
  // 3. Content-based inference
  if (!filePath) filePath = inferFileFromContent(content);

  if (!filePath) return;

  // Later blocks for the same path win (usually the corrected version)
  if (seenPaths.has(filePath)) {
    const idx = changes.findIndex(c => c.path === filePath);
    if (idx !== -1) changes.splice(idx, 1);
  }
  seenPaths.add(filePath);
  changes.push({ path: filePath, content });
}

/** Extract file path from comment at top of code block */
function extractFilePathFromContent(content: string): string | null {
  const firstLine = content.split("\n")[0].trim();
  // Match: // src/app/page.tsx or /* src/app/globals.css */ or # src/app/page.tsx
  const pathMatch = firstLine.match(/^(?:\/\/|\/\*|#)\s*(src\/\S+|public\/\S+)/);
  return pathMatch ? pathMatch[1].replace(/\s*\*\/\s*$/, "") : null;
}

/** Infer file type from content patterns when label is ambiguous */
function inferFileFromContent(content: string): string | null {
  // CSS content
  if (/^[.:@#\[]|{\s*[\w-]+\s*:/.test(content) && !content.includes("import ")) {
    return "src/app/globals.css";
  }
  // Layout patterns (metadata, RootLayout, html/body tags)
  if (/export\s+(const\s+metadata|default\s+function\s+RootLayout)|<html|<body/.test(content)) {
    return "src/app/layout.tsx";
  }
  // Translation patterns (object with zh/en keys)
  if (/\b(zh|en)\s*:\s*{/.test(content) && /translations|i18n/i.test(content)) {
    return "src/i18n/translations.ts";
  }
  // Default: if it looks like TSX with JSX, it's probably page.tsx
  if (/export\s+default\s+function|"use client"|<div|<section/.test(content)) {
    return "src/app/page.tsx";
  }
  return null;
}

/** Map code block labels to file paths */
function labelToPath(label: string): string | null {
  const MAP: Record<string, string> = {
    // Exact file names
    "page.tsx": "src/app/page.tsx",
    "globals.css": "src/app/globals.css",
    "layout.tsx": "src/app/layout.tsx",
    "translations.ts": "src/i18n/translations.ts",
    "LanguageProvider.tsx": "src/components/LanguageProvider.tsx",
    // Short extensions (keep backward compat)
    "tsx": "src/app/page.tsx",
    "css": "src/app/globals.css",
    "ts": "src/i18n/translations.ts",
    // Common language markers LLMs use instead of file names
    "typescript": "src/app/page.tsx",
    "typescriptreact": "src/app/page.tsx",
    "jsx": "src/app/page.tsx",
    "javascript": "src/app/page.tsx",
    "react": "src/app/page.tsx",
  };

  // Direct match (case-insensitive for common labels)
  const lower = label.toLowerCase();
  if (MAP[label]) return MAP[label];
  if (MAP[lower]) return MAP[lower];

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

// ---------------------------------------------------------------------------
// Validation — reject placeholder/abbreviated LLM output
// ---------------------------------------------------------------------------

/**
 * LLMs sometimes output abbreviated code with placeholder comments like:
 *   // ... imports remain the same ...
 *   // ... rest of the translations remain exactly the same ...
 *
 * This replaces real code with non-functional placeholders that break the build.
 * We detect and reject such outputs so the retry mechanism can request a proper response.
 */

/** Patterns that indicate placeholder/abbreviated output */
const PLACEHOLDER_PATTERNS = [
  /\/\/\s*\.{3}\s*(.*remain|.*same|.*rest of|.*省略|.*不变|.*existing)/i,
  /\/\*\s*\.{3}\s*(.*remain|.*same|.*rest of|.*省略|.*不变|.*existing)/i,
  /\/\/\s*(imports?|state|hooks?|styles?|content)\s*(remain|unchanged|same|省略|不变)/i,
  /{\s*\/\*\s*\.{3}\s*\*\/\s*}/,  // { /* ... */ }
];

function validateChanges(
  changes: FileChange[],
  originalFiles: Record<string, string>,
): { changes: FileChange[]; valid: boolean } {
  if (changes.length === 0) return { changes, valid: false };

  const validChanges: FileChange[] = [];
  let anyRejected = false;

  for (const change of changes) {
    const original = originalFiles[change.path];
    const rejection = checkForPlaceholder(change, original);
    if (rejection) {
      logger.warn("edit-agent", `Rejected ${change.path}: ${rejection}`);
      anyRejected = true;
      continue;
    }
    validChanges.push(change);
  }

  // If ALL changes were rejected, mark as invalid so retry kicks in
  if (validChanges.length === 0 && anyRejected) {
    return { changes: [], valid: false };
  }

  return { changes: validChanges, valid: validChanges.length > 0 };
}

function checkForPlaceholder(change: FileChange, original: string | undefined): string | null {
  const content = change.content;

  // 1. Check for placeholder comment patterns
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(content)) {
      return `contains placeholder: ${content.match(pattern)?.[0]?.slice(0, 60)}`;
    }
  }

  // 2. For page.tsx: must have real imports and useLanguage hook
  if (change.path === "src/app/page.tsx") {
    if (!content.includes("import ")) {
      return "page.tsx missing import statements";
    }
    if (!content.includes("useLanguage")) {
      return "page.tsx missing useLanguage hook";
    }
  }

  // 3. For translations.ts: must have actual translation content (not empty objects)
  if (change.path === "src/i18n/translations.ts") {
    // Count actual property lines (like `  hero:`, `  nav:`, etc.)
    const propertyLines = (content.match(/^\s{2,}\w+\s*:/gm) || []).length;
    if (propertyLines < 3) {
      return `translations.ts has only ${propertyLines} properties (expected 3+)`;
    }
  }

  // 4. Dramatic length reduction: if output is < 30% of original, likely truncated
  if (original && content.length < original.length * 0.3) {
    return `content is ${Math.round(content.length / original.length * 100)}% of original (${content.length} vs ${original.length} chars)`;
  }

  return null; // Passes validation
}
