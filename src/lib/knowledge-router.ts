/**
 * Knowledge Router — maps knowledge items to site sections
 * based on useCase hints, category, and content matching.
 *
 * Used during build to ensure each section gets the right content
 * from the knowledge base, instead of dumping everything as flat text.
 */
import type { KnowledgeItem } from "./knowledge";
import type { SiteSpecSection } from "./site-spec";

export interface RoutedKnowledge {
  /** section id → matched knowledge items */
  sections: Record<string, KnowledgeItem[]>;
  /** Items that didn't match any section — go to chatbot context */
  unrouted: KnowledgeItem[];
  /** Summary for logging */
  summary: string;
}

/**
 * Route knowledge items to sections based on:
 * 1. Explicit useCase matching (highest priority)
 * 2. content_source field on spec sections
 * 3. Category-based defaults
 */
export function routeKnowledge(
  items: KnowledgeItem[],
  sections: SiteSpecSection[],
): RoutedKnowledge {
  const result: Record<string, KnowledgeItem[]> = {};
  const claimed = new Set<string>();

  // Initialize all section buckets
  for (const section of sections) {
    const id = section.id || section.type || "";
    if (id) result[id] = [];
  }

  // Pass 1: Match by useCase hint (highest priority)
  for (const item of items) {
    if (!item.useCase) continue;
    const uc = item.useCase.toLowerCase();
    for (const section of sections) {
      const id = section.id || section.type || "";
      const kind = section.kind || section.type || "";
      if (uc.includes(id) || uc.includes(kind)) {
        result[id]?.push(item);
        claimed.add(item.id);
        break;
      }
    }
  }

  // Pass 2: Match by content_source on spec sections
  for (const section of sections) {
    const id = section.id || section.type || "";
    const source = section.content_source;
    if (!source) continue;
    const sourceLower = source.toLowerCase();
    for (const item of items) {
      if (claimed.has(item.id)) continue;
      if (item.category && sourceLower.includes(item.category)) {
        result[id]?.push(item);
        claimed.add(item.id);
      } else if (sourceLower.includes(item.title.toLowerCase())) {
        result[id]?.push(item);
        claimed.add(item.id);
      }
    }
  }

  // Pass 3: Category-based defaults for unclaimed items
  const CATEGORY_SECTION_MAP: Record<string, string[]> = {
    factual: ["hero", "about"],
    experience: ["timeline", "projects", "showcase"],
    skills: ["skills"],
    workflow: ["skills", "services", "methodology"],
    framework: ["skills", "services"],
    media: ["gallery", "showcase", "projects"],
    opinion: ["proof", "testimonials"],
    meta: ["about", "hero"],
    relational: ["about"],
  };

  for (const item of items) {
    if (claimed.has(item.id)) continue;
    const targetSections = CATEGORY_SECTION_MAP[item.category] || [];
    for (const targetId of targetSections) {
      if (result[targetId]) {
        result[targetId].push(item);
        claimed.add(item.id);
        break;
      }
    }
  }

  // Unclaimed items go to chatbot context
  const unrouted = items.filter(i => !claimed.has(i.id));

  // Summary
  const sectionCounts = Object.entries(result)
    .filter(([, items]) => items.length > 0)
    .map(([id, items]) => `${id}:${items.length}`)
    .join(", ");

  return {
    sections: result,
    unrouted,
    summary: `Routed ${claimed.size}/${items.length} items (${sectionCounts}). ${unrouted.length} unrouted → chatbot.`,
  };
}

/**
 * Build a chatbot-optimized context string from routed knowledge.
 * Structured items get their section context preserved.
 */
export function buildRoutedChatbotContext(routing: RoutedKnowledge): string {
  const parts: string[] = [];

  // Section-routed items with context
  for (const [sectionId, items] of Object.entries(routing.sections)) {
    if (items.length === 0) continue;
    parts.push(`## ${sectionId}\n${items.map(i => `${i.title}: ${i.content}`).join("\n")}`);
  }

  // Unrouted items as general knowledge
  if (routing.unrouted.length > 0) {
    parts.push(`## General\n${routing.unrouted.map(i => `${i.title}: ${i.content}`).join("\n")}`);
  }

  return parts.join("\n\n");
}
