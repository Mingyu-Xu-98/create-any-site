/**
 * Content Model utilities:
 * - Knowledge relation resolution (link projects to skills, etc.)
 * - Deduplication
 * - Incremental diff (what's new vs what already exists)
 */
import type { ContentModel, Project, Experience } from "./content-model";
import type { KnowledgeItem, KnowledgeRelation } from "./knowledge";

// ---- Relation Resolution ----

interface ResolvedRelations {
  /** project ID → related skill names */
  projectSkills: Record<string, string[]>;
  /** project ID → produced outputs (papers, awards, etc.) */
  projectOutputs: Record<string, Array<{ title: string; type: string }>>;
  /** experience ID → related project IDs */
  experienceProjects: Record<string, string[]>;
  /** experience ID → led-to experience IDs (career progression) */
  careerPath: Array<{ from: string; to: string }>;
}

/**
 * Resolve knowledge relations into display-ready links.
 * Called after building ContentModel, enriches it with cross-references.
 */
export function resolveRelations(
  model: ContentModel,
  items: KnowledgeItem[],
  relations: KnowledgeRelation[],
): ResolvedRelations {
  const result: ResolvedRelations = {
    projectSkills: {},
    projectOutputs: {},
    experienceProjects: {},
    careerPath: [],
  };

  const itemMap = new Map(items.map(i => [i.id, i]));

  for (const rel of relations) {
    const fromItem = itemMap.get(rel.fromId);
    const toItem = itemMap.get(rel.toId);
    if (!fromItem || !toItem) continue;

    switch (rel.relationType) {
      case "used_in": {
        // skill used_in project → project gets skill tag
        const project = model.projects.find(p => p.knowledgeIds?.includes(rel.toId));
        if (project) {
          if (!result.projectSkills[project.id]) result.projectSkills[project.id] = [];
          result.projectSkills[project.id].push(fromItem.title);
        }
        break;
      }
      case "produced": {
        // experience produced output
        const project = model.projects.find(p => p.knowledgeIds?.includes(rel.fromId));
        const exp = model.experience.find(e => e.knowledgeIds?.includes(rel.fromId));
        const target = project || exp;
        if (target) {
          const id = "id" in target ? target.id : "";
          if (!result.projectOutputs[id]) result.projectOutputs[id] = [];
          result.projectOutputs[id].push({ title: toItem.title, type: toItem.category });
        }
        break;
      }
      case "belongs_to": {
        // experience belongs_to org — enrich org field
        const exp = model.experience.find(e => e.knowledgeIds?.includes(rel.fromId));
        if (exp && !exp.org) {
          exp.org = toItem.title;
        }
        break;
      }
      case "led_to": {
        // career progression
        result.careerPath.push({ from: rel.fromId, to: rel.toId });
        break;
      }
      case "part_of": {
        // group related items
        const project = model.projects.find(p => p.knowledgeIds?.includes(rel.toId));
        if (project && !project.knowledgeIds?.includes(rel.fromId)) {
          // fromItem is part of this project — append its content
          if (fromItem.content && !project.detail) {
            project.detail = fromItem.content;
          }
        }
        break;
      }
    }
  }

  return result;
}

/**
 * Enrich ContentModel with resolved relations.
 * Adds "使用技术" tags to projects, "产出" links to experiences, etc.
 */
export function enrichModelWithRelations(
  model: ContentModel,
  resolved: ResolvedRelations,
): ContentModel {
  // Enrich project tags with related skills
  for (const project of model.projects) {
    const relatedSkills = resolved.projectSkills[project.id] || [];
    if (relatedSkills.length > 0) {
      const existing = new Set(project.tags.map(t => t.toLowerCase()));
      for (const skill of relatedSkills) {
        if (!existing.has(skill.toLowerCase())) {
          project.tags.push(skill);
        }
      }
    }
    // Add highlights from produced outputs
    const outputs = resolved.projectOutputs[project.id] || [];
    if (outputs.length > 0 && !project.highlights) {
      project.highlights = outputs.map(o => `${o.type === "publication" ? "📄" : "🏆"} ${o.title}`);
    }
  }

  // Enrich experience with related project highlights
  for (const exp of model.experience) {
    const outputs = resolved.projectOutputs[exp.id] || [];
    if (outputs.length > 0 && !exp.highlights) {
      exp.highlights = outputs.map(o => o.title);
    }
  }

  return model;
}

// ---- Deduplication ----

/**
 * Check if two knowledge items are duplicates.
 * Uses title similarity + content overlap.
 */
function areDuplicates(a: KnowledgeItem, b: KnowledgeItem): boolean {
  if (a.id === b.id) return true;

  // Same category required
  if (a.category !== b.category) return false;

  // Title similarity (case-insensitive, trim)
  const titleA = a.title.toLowerCase().trim();
  const titleB = b.title.toLowerCase().trim();
  if (titleA === titleB) return true;

  // One title contains the other
  if (titleA.includes(titleB) || titleB.includes(titleA)) {
    // Also check content overlap
    const contentOverlap = calculateOverlap(a.content, b.content);
    return contentOverlap > 0.6;
  }

  return false;
}

function calculateOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.max(wordsA.size, wordsB.size);
}

/**
 * Deduplicate knowledge items. Keeps the richer version (longer content).
 */
export function deduplicateKnowledge(items: KnowledgeItem[]): KnowledgeItem[] {
  const result: KnowledgeItem[] = [];
  const consumed = new Set<string>();

  for (const item of items) {
    if (consumed.has(item.id)) continue;

    // Find duplicates
    const dupes = items.filter(other =>
      other.id !== item.id && !consumed.has(other.id) && areDuplicates(item, other)
    );

    // Keep the richest version
    let best = item;
    for (const dupe of dupes) {
      consumed.add(dupe.id);
      if (dupe.content.length > best.content.length) {
        best = { ...dupe, tags: [...new Set([...best.tags, ...dupe.tags])] };
      } else {
        best = { ...best, tags: [...new Set([...best.tags, ...dupe.tags])] };
      }
    }

    consumed.add(best.id);
    result.push(best);
  }

  return result;
}

// ---- Incremental Diff ----

export interface ContentDiff {
  /** New sections that didn't exist before */
  newSections: string[];
  /** Sections with added items */
  updatedSections: Array<{ section: string; addedCount: number }>;
  /** Total new items across all sections */
  totalNew: number;
  /** Summary for display */
  summary: string;
}

/**
 * Compare a new ContentModel against an existing one.
 * Returns what's new so the AI can decide how to update the site.
 */
export function diffContentModels(existing: ContentModel, updated: ContentModel): ContentDiff {
  const diff: ContentDiff = { newSections: [], updatedSections: [], totalNew: 0, summary: "" };

  const sections: Array<{ key: keyof ContentModel; label: string }> = [
    { key: "projects", label: "projects" },
    { key: "posts", label: "posts" },
    { key: "experience", label: "experience" },
    { key: "education", label: "education" },
    { key: "skills", label: "skills" },
    { key: "awards", label: "awards" },
    { key: "publications", label: "publications" },
    { key: "media", label: "media" },
    { key: "demos", label: "demos" },
    { key: "testimonials", label: "testimonials" },
  ];

  for (const { key, label } of sections) {
    const oldArr = existing[key] as unknown[];
    const newArr = updated[key] as unknown[];
    if (!Array.isArray(oldArr) || !Array.isArray(newArr)) continue;

    if (oldArr.length === 0 && newArr.length > 0) {
      diff.newSections.push(label);
      diff.totalNew += newArr.length;
    } else if (newArr.length > oldArr.length) {
      const added = newArr.length - oldArr.length;
      diff.updatedSections.push({ section: label, addedCount: added });
      diff.totalNew += added;
    }
  }

  const parts: string[] = [];
  if (diff.newSections.length > 0) {
    parts.push(`新增版块: ${diff.newSections.join(", ")}`);
  }
  if (diff.updatedSections.length > 0) {
    parts.push(diff.updatedSections.map(u => `${u.section} +${u.addedCount}`).join(", "));
  }
  diff.summary = parts.length > 0 ? `${diff.totalNew} 条新内容 (${parts.join("; ")})` : "无变更";

  return diff;
}

/**
 * Merge new knowledge into an existing ContentModel.
 * Deduplicates and preserves existing content.
 */
export function mergeContentModels(existing: ContentModel, newItems: ContentModel): ContentModel {
  // Helper: merge arrays by checking title similarity
  function mergeArray<T>(old: T[], fresh: T[]): T[] {
    const result = [...old];
    for (const item of fresh) {
      const a = item as Record<string, unknown>;
      const isDupe = old.some(o => {
        const b = o as Record<string, unknown>;
        if (a.id && b.id && a.id === b.id) return true;
        if (a.title && b.title && typeof a.title === "string" && typeof b.title === "string") {
          return a.title.toLowerCase().trim() === b.title.toLowerCase().trim();
        }
        if (a.school && b.school && typeof a.school === "string" && typeof b.school === "string") {
          return a.school.toLowerCase().trim() === b.school.toLowerCase().trim();
        }
        if (a.quote && b.quote && typeof a.quote === "string" && typeof b.quote === "string") {
          return a.quote.slice(0, 50).toLowerCase() === b.quote.slice(0, 50).toLowerCase();
        }
        return false;
      });
      if (!isDupe) result.push(item);
    }
    return result;
  }

  return {
    ...existing,
    projects: mergeArray(existing.projects, newItems.projects) as ContentModel["projects"],
    posts: mergeArray(existing.posts, newItems.posts) as ContentModel["posts"],
    experience: mergeArray(existing.experience, newItems.experience) as ContentModel["experience"],
    education: mergeArray(existing.education, newItems.education) as ContentModel["education"],
    skills: mergeSkillGroups(existing.skills, newItems.skills),
    awards: mergeArray(existing.awards, newItems.awards) as ContentModel["awards"],
    publications: mergeArray(existing.publications, newItems.publications) as ContentModel["publications"],
    media: mergeArray(existing.media, newItems.media) as ContentModel["media"],
    demos: mergeArray(existing.demos, newItems.demos) as ContentModel["demos"],
    testimonials: mergeArray(existing.testimonials, newItems.testimonials) as ContentModel["testimonials"],
    customBlocks: [...existing.customBlocks, ...newItems.customBlocks],
    // Update profile if new data is richer
    profile: {
      ...existing.profile,
      ...(newItems.profile.name && !existing.profile.name ? { name: newItems.profile.name } : {}),
      ...(newItems.profile.title && !existing.profile.title ? { title: newItems.profile.title } : {}),
      ...(newItems.profile.summary && newItems.profile.summary.length > (existing.profile.summary?.length || 0) ? { summary: newItems.profile.summary } : {}),
      ...(newItems.profile.email && !existing.profile.email ? { email: newItems.profile.email } : {}),
      tags: [...new Set([...existing.profile.tags, ...newItems.profile.tags])].slice(0, 10),
      links: [...existing.profile.links, ...newItems.profile.links.filter(l => !existing.profile.links.some(e => e.url === l.url))],
      contact: [...existing.profile.contact, ...newItems.profile.contact.filter(c => !existing.profile.contact.some(e => e.url === c.url))],
    },
    // Merge chatbot context
    chatbot: {
      enabled: existing.chatbot?.enabled ?? newItems.chatbot?.enabled ?? true,
      persona: existing.chatbot?.persona || newItems.chatbot?.persona,
      knowledgeContext: [existing.chatbot?.knowledgeContext, newItems.chatbot?.knowledgeContext].filter(Boolean).join("\n\n"),
    },
  };
}

function mergeSkillGroups(old: ContentModel["skills"], fresh: ContentModel["skills"]): ContentModel["skills"] {
  const result = [...old];
  for (const group of fresh) {
    const existing = result.find(g => g.title.toLowerCase() === group.title.toLowerCase());
    if (existing) {
      const existingSet = new Set(existing.skills.map(s => s.toLowerCase()));
      for (const skill of group.skills) {
        if (!existingSet.has(skill.toLowerCase())) {
          existing.skills.push(skill);
        }
      }
    } else {
      result.push(group);
    }
  }
  return result;
}
