import type { KnowledgeItem } from "@/lib/knowledge";
import type { WorkspaceData, UserSelections, SiteType, ThemeStyle, LayoutType } from "@/lib/types";
import { getAutoLayout } from "./questions";

type SpecValue = { value?: string | null } | string | null | undefined;

export interface SiteSpecSection {
  id?: string;
  type?: string;
  enabled?: boolean;
  data?: Record<string, unknown>;
}

export interface SiteSpec {
  product?: {
    siteType?: string;
    targetAudience?: string;
    purpose?: string;
  };
  identity?: {
    name?: SpecValue;
    nameEn?: SpecValue;
    title?: SpecValue;
    bio?: SpecValue;
    bioEn?: SpecValue;
    contact?: {
      email?: SpecValue;
      github?: SpecValue;
      linkedin?: SpecValue;
    };
  };
  sections?: SiteSpecSection[];
  designSystem?: {
    theme?: string;
    customDescription?: string;
  };
}

function readSpecValue(input: SpecValue): string {
  if (!input) return "";
  if (typeof input === "string") return input;
  return typeof input.value === "string" ? input.value : "";
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
    projects: experience.filter(e => /project|项目/i.test(e.title)).map(e => ({ title: e.title, org: "", desc: e.content.slice(0, 200), tags: e.tags, image: "", link: "" })),
    projectsEn: experience.filter(e => /project|项目/i.test(e.title)).map(e => ({ title: e.title, org: "", desc: e.content.slice(0, 200), tags: e.tags, image: "", link: "" })),
    timeline: experience.filter(e => !/project|项目/i.test(e.title)).map((e, i) => ({ date: "", title: e.title, desc: e.content.slice(0, 200), active: i === 0 })),
    timelineEn: experience.filter(e => !/project|项目/i.test(e.title)).map((e, i) => ({ date: "", title: e.title, desc: e.content.slice(0, 200), active: i === 0 })),
    education: [],
    educationEn: [],
    tags: skills.map(s => s.title).slice(0, 6),
    tagsEn: skills.map(s => s.title).slice(0, 6),
    links: media.map(m => ({ label: m.title, labelEn: m.title, url: m.content, icon: "website" })),
    visibleSections: ["about", ...(skills.length > 0 ? ["skills"] : []), ...(experience.length > 0 ? ["projects", "timeline"] : []), ...(media.length > 0 ? ["links"] : [])],
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
  const sections = Array.isArray(spec.sections) ? spec.sections.filter(section => section.enabled !== false) : [];
  const skillsSection = sections.find(section => (section.id || section.type) === "skills");
  const projectsSection = sections.find(section => (section.id || section.type) === "projects");
  const timelineSection = sections.find(section => (section.id || section.type) === "timeline");
  const aboutSection = sections.find(section => (section.id || section.type) === "about");
  const contactSection = sections.find(section => (section.id || section.type) === "contact");

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
  const theme = (spec.designSystem?.theme as ThemeStyle | undefined) || fallback.theme;
  const customTheme = spec.designSystem?.customDescription || fallback.customTheme;
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
