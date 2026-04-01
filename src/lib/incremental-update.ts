/**
 * Incremental Update — when user uploads new files to knowledge base,
 * generate a diff and let AI update the existing site code.
 *
 * Flow:
 * 1. New knowledge items extracted
 * 2. Build new ContentModel from new items
 * 3. Diff against existing ContentModel
 * 4. Generate update instructions for AI agent
 * 5. AI reads current site code + diff → produces targeted file changes
 */
import type { ContentModel } from "./content-model";
import type { ContentDiff } from "./content-model-utils";

export interface UpdateInstruction {
  /** What changed (for the AI to understand) */
  diff: ContentDiff;
  /** Specific instructions per section */
  sectionInstructions: SectionInstruction[];
  /** Current site files the AI should read before modifying */
  filesToRead: string[];
  /** Overall strategy */
  strategy: string;
}

export interface SectionInstruction {
  section: string;
  action: "add-new-section" | "append-items" | "update-content" | "no-change";
  description: string;
  /** The new data to add (serialized for the AI prompt) */
  data?: string;
}

/**
 * Generate update instructions from a content diff.
 * These instructions are passed to the concept agent in modify mode.
 */
export function generateUpdateInstructions(
  diff: ContentDiff,
  existing: ContentModel,
  updated: ContentModel,
): UpdateInstruction {
  const instructions: SectionInstruction[] = [];
  const filesToRead = ["src/app/page.tsx", "src/i18n/translations.ts", "src/app/globals.css"];

  // New sections → need to add new section blocks to page.tsx
  for (const section of diff.newSections) {
    const data = getNewSectionData(section, updated);
    instructions.push({
      section,
      action: "add-new-section",
      description: `新增"${section}"版块到页面，包含 ${getItemCount(section, updated)} 条内容`,
      data,
    });
    // If the section has a detail page route
    if (section === "projects" || section === "posts") {
      filesToRead.push(`src/app/${section}/page.tsx`);
    }
  }

  // Updated sections → need to append items to existing sections
  for (const update of diff.updatedSections) {
    const newItems = getNewItems(update.section, existing, updated);
    instructions.push({
      section: update.section,
      action: "append-items",
      description: `在"${update.section}"版块追加 ${update.addedCount} 条新内容`,
      data: newItems,
    });
  }

  // Determine strategy
  let strategy: string;
  if (diff.newSections.length > 0) {
    strategy = "需要修改 page.tsx 添加新的 section 渲染代码，并在 translations.ts 中补充对应翻译。只修改必要的文件，不要重写整个页面。";
  } else if (diff.updatedSections.length > 0) {
    strategy = "只需要更新 translations.ts 中的数据数组（追加新条目），不需要修改页面结构代码。";
  } else {
    strategy = "无需修改，新知识已与现有内容重复。";
  }

  return { diff, sectionInstructions: instructions, filesToRead, strategy };
}

function getNewSectionData(section: string, model: ContentModel): string {
  switch (section) {
    case "projects": return JSON.stringify(model.projects.slice(0, 3), null, 2);
    case "posts": return JSON.stringify(model.posts.slice(0, 3), null, 2);
    case "experience": return JSON.stringify(model.experience.slice(0, 3), null, 2);
    case "skills": return JSON.stringify(model.skills, null, 2);
    case "awards": return JSON.stringify(model.awards, null, 2);
    case "publications": return JSON.stringify(model.publications, null, 2);
    case "media": return JSON.stringify(model.media, null, 2);
    case "demos": return JSON.stringify(model.demos, null, 2);
    case "testimonials": return JSON.stringify(model.testimonials, null, 2);
    default: return "[]";
  }
}

function getNewItems(section: string, existing: ContentModel, updated: ContentModel): string {
  // Return only items that are new (not in existing)
  const existingTitles = new Set(getArrayField(existing, section).map((i: { title?: string }) => i.title?.toLowerCase()));
  const newItems = getArrayField(updated, section).filter((i: { title?: string }) => !existingTitles.has(i.title?.toLowerCase()));
  return JSON.stringify(newItems, null, 2);
}

function getItemCount(section: string, model: ContentModel): number {
  return getArrayField(model, section).length;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getArrayField(model: ContentModel, section: string): any[] {
  return (model as unknown as Record<string, unknown>)[section] as unknown[] || [];
}

/**
 * Format update instructions as a prompt for the concept agent.
 * Used when the agent is in modify mode.
 */
export function formatUpdatePrompt(instructions: UpdateInstruction): string {
  if (instructions.sectionInstructions.length === 0) {
    return "新上传的知识与现有内容重复，无需修改网站。";
  }

  const parts = [
    `## 知识库更新摘要`,
    instructions.diff.summary,
    "",
    `## 更新策略`,
    instructions.strategy,
    "",
    `## 需要修改的文件`,
    instructions.filesToRead.map(f => `- ${f}`).join("\n"),
    "",
    `## 具体变更`,
  ];

  for (const inst of instructions.sectionInstructions) {
    parts.push(`### ${inst.section} (${inst.action})`);
    parts.push(inst.description);
    if (inst.data) {
      parts.push("```json");
      parts.push(inst.data);
      parts.push("```");
    }
    parts.push("");
  }

  parts.push("## 注意事项");
  parts.push("- 只修改需要变更的文件，不要重写整个页面");
  parts.push("- 新增 section 时参考现有 section 的代码风格");
  parts.push("- translations.ts 中追加新数据时保持数组结构一致");
  parts.push("- 不要删除或修改现有内容");

  return parts.join("\n");
}
