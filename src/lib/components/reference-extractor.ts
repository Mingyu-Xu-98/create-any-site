/**
 * Component Reference Extractor
 *
 * Given a CompositionPlan from Design Agent, extracts the source code of
 * selected component variants as reference material for Code Agent.
 *
 * These are NOT copy-paste templates — they are design pattern references
 * that Code Agent studies to understand the structure, then writes customized
 * implementations based on the user's actual content and style.
 */
import fs from "fs/promises";
import path from "path";
import type { CompositionPlan, SectionKind } from "./types";

export interface ComponentReference {
  kind: string;         // "hero", "showcase", "skills", etc.
  variant: string;      // "split", "bento", "bars", etc.
  description: string;  // From variant metadata
  sourceCode: string;   // The variant function source code
}

/**
 * Map from SectionKind to filesystem directory name.
 * Most kinds map directly, but some have special naming.
 */
const KIND_TO_DIR: Record<string, string> = {
  hero: "hero",
  showcase: "projects",
  skills: "skills",
  timeline: "timeline",
  content: "education",   // content:education-xxx → education/xxx
  cta: "contact",
  proof: "proof",
  gallery: "gallery",
  pricing: "pricing",
  faq: "faq",
  custom: "",             // no fixed directory
};

const COMPONENTS_DIR = path.join(process.cwd(), "src/lib/components");

/** Max references to inject (hero + sections + nav + footer) */
const MAX_REFERENCES = 8;

/** Max characters per single variant source */
const MAX_SOURCE_CHARS = 3000;

/**
 * Extract component variant source code based on a composition plan.
 *
 * Returns references in priority order:
 * 1. Hero (most visually impactful)
 * 2. Sections (in plan order)
 * 3. Nav + Footer (lowest priority, cut first if over limit)
 *
 * Average variant is ~35 lines / ~1200 chars → 8 refs ≈ 2400 tokens.
 */
export async function extractComponentReferences(
  plan: CompositionPlan,
): Promise<ComponentReference[]> {
  const refs: ComponentReference[] = [];

  // 1. Hero
  if (plan.hero) {
    const ref = await loadVariantSource("hero", plan.hero);
    if (ref) refs.push(ref);
  }

  // 2. Sections (in plan order)
  if (plan.sections) {
    for (const section of plan.sections) {
      if (refs.length >= MAX_REFERENCES - 1) break; // reserve 1 slot for footer
      if (!section.variant) continue;

      const ref = await loadVariantSource(section.kind, section.variant);
      if (ref) refs.push(ref);
    }
  }

  // 3. Nav (low priority)
  if (plan.nav && refs.length < MAX_REFERENCES) {
    const ref = await loadVariantSource("nav", plan.nav);
    if (ref) refs.push(ref);
  }

  // 4. Footer (lowest priority)
  if (plan.footer && refs.length < MAX_REFERENCES) {
    const ref = await loadVariantSource("footer", plan.footer);
    if (ref) refs.push(ref);
  }

  return refs;
}

/**
 * Format extracted references as a markdown block for Code Agent prompt injection.
 */
export function formatReferencesForPrompt(
  refs: ComponentReference[],
  designReasoning?: string,
  sectionRationale?: Record<string, string>,
): string {
  if (refs.length === 0) return "";

  const parts: string[] = [
    "## Component Design References",
    "",
    "Design Agent selected these components for your implementation.",
    "Study each reference to understand the design pattern, then write",
    "your own version adapted to the user's actual content and style.",
    "Do NOT copy-paste — use these as structural inspiration.",
    "",
  ];

  for (const ref of refs) {
    const rationale = sectionRationale?.[`${ref.kind}/${ref.variant}`] || "";
    parts.push(`### ${ref.kind}/${ref.variant} — ${ref.description}`);
    if (rationale) {
      parts.push(`> Rationale: ${rationale}`);
    }
    parts.push("```tsx");
    parts.push(ref.sourceCode);
    parts.push("```");
    parts.push("");
  }

  if (designReasoning) {
    parts.push("### Design Agent's Reasoning");
    parts.push(`"${designReasoning}"`);
    parts.push("");
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Internal: load variant source from disk
// ---------------------------------------------------------------------------

async function loadVariantSource(
  kind: string,
  variant: string,
): Promise<ComponentReference | null> {
  try {
    const filePath = resolveVariantPath(kind, variant);
    if (!filePath) return null;

    const source = await fs.readFile(filePath, "utf-8");
    const cleaned = cleanSource(source);

    if (cleaned.length < 20) return null; // skip empty/trivial

    return {
      kind,
      variant,
      description: extractDescription(source),
      sourceCode: cleaned.slice(0, MAX_SOURCE_CHARS),
    };
  } catch {
    // File not found or read error — skip silently
    // File not found — variant may not have a standalone file
    return null;
  }
}

/**
 * Resolve variant name to filesystem path.
 *
 * Handles special cases:
 * - content:education-xxx → education/xxx.ts
 * - Nav/footer have their own directories
 * - Hyphenated names map to hyphenated files
 */
function resolveVariantPath(kind: string, variant: string): string | null {
  let dir: string;
  let fileName: string;

  if (kind === "content" && variant.startsWith("education-")) {
    // education variants: content:education-cards → education/cards.ts
    dir = "education";
    fileName = variant.replace("education-", "");
  } else if (kind === "nav") {
    dir = "nav";
    fileName = variant;
  } else if (kind === "footer") {
    dir = "footer";
    fileName = variant;
  } else {
    dir = KIND_TO_DIR[kind];
    if (!dir) return null;
    fileName = variant;
  }

  return path.join(COMPONENTS_DIR, dir, `${fileName}.ts`);
}

/**
 * Clean source code for prompt injection:
 * - Remove file-level JSDoc comments
 * - Remove import statements (Code Agent uses different imports)
 * - Keep the core function body
 */
function cleanSource(source: string): string {
  const lines = source.split("\n");
  const cleaned: string[] = [];
  let inBlockComment = false;

  for (const line of lines) {
    // Skip block comments at file start
    if (line.trimStart().startsWith("/**") && cleaned.length === 0) {
      inBlockComment = true;
      continue;
    }
    if (inBlockComment) {
      if (line.includes("*/")) {
        inBlockComment = false;
      }
      continue;
    }

    // Skip import lines
    if (line.trimStart().startsWith("import ")) continue;

    cleaned.push(line);
  }

  // Remove leading blank lines
  while (cleaned.length > 0 && cleaned[0].trim() === "") cleaned.shift();

  return cleaned.join("\n").trim();
}

/**
 * Extract a description from source — first line comment or export name.
 */
function extractDescription(source: string): string {
  // Try to find JSDoc description
  const jsdocMatch = source.match(/\/\*\*\s*\n?\s*\*\s*(.+)/);
  if (jsdocMatch) return jsdocMatch[1].trim();

  // Fallback: use export const name
  const exportMatch = source.match(/export const (\w+)/);
  if (exportMatch) return exportMatch[1];

  return "(component variant)";
}
