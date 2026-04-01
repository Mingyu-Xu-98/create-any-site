import type { KnowledgeItem } from "@/lib/knowledge";
import type { WorkspaceData, UserSelections, SiteType, ThemeStyle, LayoutType } from "@/lib/types";
import { getAutoLayout } from "./questions";

type SpecValue = { value?: string | null } | string | null | undefined;

export interface SiteSpecSection {
  id?: string;
  type?: string;
  /** Rendering category — matches SectionKind from component library */
  kind?: string;
  /** Specific component variant to use (optional — runtime auto-selects if missing) */
  variant?: string;
  enabled?: boolean;
  /** Content depth: how much of this section to show */
  depth?: "teaser" | "summary" | "full" | "interactive";
  /** Knowledge routing: which knowledge items power this section */
  content_source?: string;
  data?: Record<string, unknown>;
}

export interface SiteSpecPage {
  id: string;
  route: string;
  purpose?: string;
  priority?: number;
  sections: SiteSpecSection[];
}

export interface SiteSpec {
  product?: {
    siteType?: string;         // Free-form: "portfolio", "saas-landing", "agency", etc.
    targetAudience?: string;
    purpose?: string;
    tone?: string;             // "professional", "playful", "luxurious", etc.
  };
  identity?: {
    name?: SpecValue;
    nameEn?: SpecValue;
    title?: SpecValue;
    bio?: SpecValue;
    bioEn?: SpecValue;
    logo?: string;
    contact?: {
      email?: SpecValue;
      github?: SpecValue;
      linkedin?: SpecValue;
      [key: string]: SpecValue;
    };
  };
  /** Legacy flat sections (backwards compatible) */
  sections?: SiteSpecSection[];
  /** New: multi-page structure (takes priority over sections when present) */
  pages?: SiteSpecPage[];
  /** Navigation structure */
  navigation?: {
    style?: string;
    items?: Array<{ label: string; target: string; children?: Array<{ label: string; target: string }> }>;
  };
  /** Design system — open-ended, not locked to preset themes */
  design?: {
    preset_theme?: string;      // Optional: use a preset as starting point
    colors?: Record<string, string>;
    typography?: { heading?: string; body?: string; mono?: string };
    style_keywords?: string[];  // "glassmorphism", "brutalist", "organic", etc.
    border_radius?: string;
    motion_level?: "none" | "subtle" | "moderate" | "rich";
  };
  /** Legacy design system (backwards compatible) */
  designSystem?: {
    theme?: string;
    customDescription?: string;
  };
  /** Interaction plan */
  interactions?: {
    chatbot?: { enabled: boolean; persona?: string };
    forms?: Array<{ id: string; purpose: string; fields?: string[] }>;
    animations?: string[];
    embeds?: Array<{ type: string; config: Record<string, unknown> }>;
  };
  /** Knowledge routing map: section_id → knowledge_item_ids[] */
  knowledge_routing?: Record<string, string[]>;
}

function readSpecValue(input: SpecValue): string {
  if (!input) return "";
  if (typeof input === "string") return input;
  return typeof input.value === "string" ? input.value : "";
}

/**
 * Classify whether an experience knowledge item is a standalone "project" vs "work experience".
 * Negative signals (work/employment markers) take priority over positive signals.
 */
function isProjectItem(e: KnowledgeItem): boolean {
  const title = e.title;
  // Negative: titles describing work roles / employment — NOT a standalone project
  if (/工作经历|工作经验|任职|在职|就职|实习经历|work\s*experience|employment|position\s*at|role\s*at/i.test(title)) {
    return false;
  }
  // Positive: title starts with "项目：" / "项目:" or "Project:"
  if (/^(?:项目|project)\s*[：:]/i.test(title)) {
    return true;
  }
  // Positive: title contains standalone project keywords (not as part of compound role names)
  if (/(?:项目|project|作品|portfolio|case\s*study|案例)/i.test(title)) {
    return true;
  }
  // Positive: tags explicitly mark it as a project
  if (e.tags?.some(tag => /project|项目|作品|案例/i.test(tag))) {
    return true;
  }
  return false;
}

export function buildWorkspaceDataFromKnowledge(items: KnowledgeItem[]): WorkspaceData {
  const get = (cat: string) => items.filter(i => i.category === cat);
  const factual = get("factual");
  const skills = get("skills");
  const experience = get("experience");
  const media = get("media");
  const meta = get("meta");

  const name = factual.find(i => /name|姓名/i.test(i.title))?.content || "Your Name";
  const title = factual.find(i => /title|职位|头衔|role/i.test(i.title))?.content || "";
  const email = factual.find(i => /email|邮箱/i.test(i.title))?.content || "";
  const bio = meta.find(i => /summary|简介|overview|bio/i.test(i.title))?.content || meta[0]?.content || "";

  const projectItems = experience.filter(e => isProjectItem(e));
  const timelineItems = experience.filter(e => !isProjectItem(e));

  return {
    name,
    nameEn: name,
    title,
    titleEn: title,
    email,
    location: "",
    locationEn: "",
    bio,
    bioEn: bio,
    bioTags: meta.flatMap(m => m.tags).slice(0, 6),
    bioTagsEn: meta.flatMap(m => m.tags).slice(0, 6),
    skills: skills.length > 0 ? [{ title: "Skills", skills: skills.map(s => s.title) }] : [],
    skillsEn: skills.length > 0 ? [{ title: "Skills", skills: skills.map(s => s.title) }] : [],
    projects: projectItems.map(e => ({ title: e.title, org: "", desc: e.content.slice(0, 800), tags: e.tags, image: "", link: "" })),
    projectsEn: projectItems.map(e => ({ title: e.title, org: "", desc: e.content.slice(0, 800), tags: e.tags, image: "", link: "" })),
    timeline: timelineItems.map((e, i) => ({ date: "", title: e.title, desc: e.content.slice(0, 800), active: i === 0 })),
    timelineEn: timelineItems.map((e, i) => ({ date: "", title: e.title, desc: e.content.slice(0, 800), active: i === 0 })),
    education: [],
    educationEn: [],
    tags: skills.map(s => s.title).slice(0, 6),
    tagsEn: skills.map(s => s.title).slice(0, 6),
    links: media.map(m => ({ label: m.title, labelEn: m.title, url: m.content, icon: "website" })),
    visibleSections: ["about", ...(skills.length > 0 ? ["skills"] : []), ...(projectItems.length > 0 ? ["projects"] : []), ...(timelineItems.length > 0 ? ["timeline"] : []), ...(media.length > 0 ? ["links"] : [])],
    chatbotContext: items.map(i => `${i.title}: ${i.content}`).join("\n"),
  };
}

function extractSectionSummary(section?: SiteSpecSection): string {
  const data = section?.data || {};
  const candidates = [
    typeof data.headline === "string" ? data.headline : "",
    typeof data.subheadline === "string" ? data.subheadline : "",
    typeof data.description === "string" ? data.description : "",
    typeof data.bio === "string" ? data.bio : "",
    typeof data.heading === "string" ? data.heading : "",
  ].filter(Boolean);
  return candidates.join(" ").trim();
}

export function buildWorkspaceDataFromSpec(spec: SiteSpec, items: KnowledgeItem[]): WorkspaceData {
  const fallback = buildWorkspaceDataFromKnowledge(items);
  const identity = spec.identity || {};
  // Flatten pages[] if present, else use sections[]
  const allSections = spec.pages?.flatMap(p => p.sections) || spec.sections || [];
  const sections = allSections.filter(section => section.enabled !== false);
  // Find sections by id/type OR by kind (new system)
  const findSection = (idOrKind: string) => sections.find(s =>
    (s.id || s.type) === idOrKind || s.kind === idOrKind
  );
  const skillsSection = findSection("skills");
  const projectsSection = findSection("projects") || findSection("showcase");
  const timelineSection = findSection("timeline");
  const aboutSection = findSection("about") || findSection("content");
  const contactSection = findSection("contact") || findSection("cta");

  const specSkills = Array.isArray(skillsSection?.data?.groups)
    ? (skillsSection?.data?.groups as Array<{ title?: string; items?: string[] }>).map(group => ({
        title: group.title || "Skills",
        skills: Array.isArray(group.items) ? group.items : [],
      }))
    : fallback.skills;

  const specProjects = Array.isArray(projectsSection?.data?.items)
    ? (projectsSection?.data?.items as Array<Record<string, unknown>>).map(item => ({
        title: typeof item.title === "string" ? item.title : "Project",
        org: typeof item.org === "string" ? item.org : "",
        desc: typeof item.description === "string" ? item.description : "",
        tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string") : [],
        image: typeof item.image === "string" ? item.image : "",
        link: typeof item.link === "string" ? item.link : "",
        badge: typeof item.badge === "string" ? item.badge : undefined,
      }))
    : fallback.projects;

  const specTimeline = Array.isArray(timelineSection?.data?.items)
    ? (timelineSection?.data?.items as Array<Record<string, unknown>>).map(item => ({
        date: typeof item.period === "string" ? item.period : "",
        title: typeof item.title === "string" ? item.title : "Experience",
        desc: typeof item.description === "string" ? item.description : "",
        active: Boolean(item.current),
      }))
    : fallback.timeline;

  const links = [
    readSpecValue(identity.contact?.github) ? { label: "GitHub", labelEn: "GitHub", url: readSpecValue(identity.contact?.github), icon: "github" } : null,
    readSpecValue(identity.contact?.linkedin) ? { label: "LinkedIn", labelEn: "LinkedIn", url: readSpecValue(identity.contact?.linkedin), icon: "linkedin" } : null,
    ...fallback.links,
  ].filter((link): link is NonNullable<typeof link> => Boolean(link));

  const sectionIds = sections
    .map(section => section.id || section.type)
    .filter((value): value is string => Boolean(value));

  const chatbotContextSections = sections
    .map(section => `${section.id || section.type}: ${extractSectionSummary(section)}`)
    .filter(Boolean);

  const bio = readSpecValue(identity.bio) || extractSectionSummary(aboutSection) || fallback.bio;
  const title = readSpecValue(identity.title) || fallback.title;
  const name = readSpecValue(identity.name) || fallback.name;

  return {
    ...fallback,
    name,
    nameEn: readSpecValue(identity.nameEn) || name,
    title,
    titleEn: readSpecValue(identity.title) || title,
    email: readSpecValue(identity.contact?.email) || fallback.email,
    bio,
    bioEn: readSpecValue(identity.bioEn) || bio,
    bioTags: fallback.bioTags,
    bioTagsEn: fallback.bioTagsEn,
    skills: specSkills,
    skillsEn: specSkills,
    projects: specProjects,
    projectsEn: specProjects,
    timeline: specTimeline,
    timelineEn: specTimeline,
    links,
    visibleSections: sectionIds.length > 0 ? sectionIds : fallback.visibleSections,
    chatbotContext: [...chatbotContextSections, fallback.chatbotContext].filter(Boolean).join("\n"),
    tags: [...new Set(specSkills.flatMap(group => group.skills))].slice(0, 6),
    tagsEn: [...new Set(specSkills.flatMap(group => group.skills))].slice(0, 6),
    education: fallback.education,
    educationEn: fallback.educationEn,
    location: fallback.location,
    locationEn: fallback.locationEn,
  };
}

export function deriveSelectionsFromSpec(
  spec: SiteSpec,
  fallback: Pick<UserSelections, "siteType" | "theme" | "layout" | "customSiteType" | "customTheme" | "customLayout" | "features">,
): UserSelections {
  const siteType = (spec.product?.siteType as SiteType | undefined) || fallback.siteType;
  // Read theme from new design.preset_theme or legacy designSystem.theme
  const theme = (spec.design?.preset_theme as ThemeStyle | undefined)
    || (spec.designSystem?.theme as ThemeStyle | undefined)
    || fallback.theme;
  const customTheme = spec.design?.style_keywords?.join(", ")
    || spec.designSystem?.customDescription
    || fallback.customTheme;
  const layout = (fallback.layout as LayoutType | null) || getAutoLayout((theme || "minimalist"), (siteType || "portfolio"));

  return {
    siteType,
    theme,
    layout,
    customSiteType: fallback.customSiteType,
    customTheme,
    customLayout: fallback.customLayout,
    features: fallback.features,
  };
}

/** Get flat sections list — from pages[0].sections if available, else legacy sections[] */
export function getSpecSections(spec: SiteSpec): SiteSpecSection[] {
  if (spec.pages && spec.pages.length > 0) {
    // For now, flatten all pages' sections (multi-page rendering is P5)
    return spec.pages.flatMap(p => p.sections).filter(s => s.enabled !== false);
  }
  return (spec.sections || []).filter(s => s.enabled !== false);
}
