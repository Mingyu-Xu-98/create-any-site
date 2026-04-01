/**
 * ContentModel — the unified content schema for personal websites.
 *
 * Replaces the fragmented WorkspaceData + SiteSpec + CompositionPlan chain.
 * Knowledge items are directly mapped into this structure.
 *
 * Supports three site modes: profile, portfolio, blog.
 * All fields are optional — the template decides what to show.
 */

// ---- Site Mode ----

export type SiteMode = "profile" | "portfolio" | "blog";

// ---- Core Profile ----

export interface Profile {
  name: string;
  nameEn?: string;
  title?: string;
  titleEn?: string;
  subtitle?: string;
  summary?: string;
  summaryEn?: string;
  avatar?: string;
  location?: string;
  email?: string;
  phone?: string;
  contact: ContactLink[];
  links: SocialLink[];
  tags: string[];
}

export interface ContactLink {
  type: string;       // email, github, linkedin, twitter, website, wechat, etc.
  label: string;
  url: string;
  icon?: string;
}

export interface SocialLink {
  label: string;
  labelEn?: string;
  url: string;
  icon?: string;
}

// ---- Projects / Works ----

export interface Project {
  id: string;
  title: string;
  titleEn?: string;
  org?: string;
  description: string;
  descriptionEn?: string;
  /** Full detail content for project detail page */
  detail?: string;
  tags: string[];
  image?: string;
  images?: string[];
  link?: string;
  github?: string;
  demoUrl?: string;
  badge?: string;
  role?: string;
  period?: string;
  highlights?: string[];
  /** Related knowledge item IDs */
  knowledgeIds?: string[];
}

// ---- Blog Posts ----

export interface Post {
  id: string;
  title: string;
  titleEn?: string;
  slug: string;
  excerpt: string;
  content: string;
  category?: string;
  tags: string[];
  image?: string;
  publishedAt?: string;
  readingTime?: string;
  /** Related knowledge item IDs */
  knowledgeIds?: string[];
}

// ---- Experience ----

export interface Experience {
  id: string;
  title: string;
  titleEn?: string;
  org: string;
  orgEn?: string;
  period: string;
  description: string;
  descriptionEn?: string;
  highlights?: string[];
  current?: boolean;
  tags?: string[];
  knowledgeIds?: string[];
}

// ---- Education ----

export interface Education {
  school: string;
  schoolEn?: string;
  degree: string;
  degreeEn?: string;
  period?: string;
  highlights?: string[];
}

// ---- Skills ----

export interface SkillGroup {
  title: string;
  titleEn?: string;
  skills: string[];
  level?: "beginner" | "intermediate" | "advanced" | "expert";
}

// ---- Awards ----

export interface Award {
  title: string;
  org?: string;
  year?: string;
  description?: string;
}

// ---- Publications ----

export interface Publication {
  title: string;
  authors?: string;
  venue?: string;       // journal, conference, etc.
  year?: string;
  abstract?: string;
  url?: string;
  doi?: string;
  pdf?: string;
  tags?: string[];
}

// ---- Media ----

export interface MediaItem {
  type: "video" | "article" | "podcast" | "talk" | "interview" | "image" | "other";
  title: string;
  platform?: string;
  url: string;
  date?: string;
  thumbnail?: string;
  description?: string;
}

// ---- Demos ----

export interface Demo {
  title: string;
  description: string;
  url: string;           // live demo URL
  screenshot?: string;
  github?: string;
  techStack?: string[];
  tags?: string[];
}

// ---- Testimonials ----

export interface Testimonial {
  quote: string;
  author: string;
  role?: string;
  company?: string;
  avatar?: string;
}

// ---- Custom Block ----

export interface CustomBlock {
  id: string;
  type: "list" | "rich-text" | "links" | "gallery" | "stats";
  title: string;
  titleEn?: string;
  data: Record<string, unknown>;
}

// ---- The Full Content Model ----

export interface ContentModel {
  /** Site mode determines template selection and default layout */
  siteMode: SiteMode;

  /** Core profile — always present */
  profile: Profile;

  /** Content sections — all optional, template decides visibility */
  projects: Project[];
  posts: Post[];
  experience: Experience[];
  education: Education[];
  skills: SkillGroup[];
  awards: Award[];
  publications: Publication[];
  media: MediaItem[];
  demos: Demo[];
  testimonials: Testimonial[];

  /** Extensible custom blocks */
  customBlocks: CustomBlock[];

  /** Chatbot persona and knowledge context */
  chatbot?: {
    enabled: boolean;
    persona?: string;
    knowledgeContext?: string;
  };

  /** Design preferences (from user or AI) */
  design?: {
    templateId?: string;       // Which template to use
    primaryColor?: string;
    accentColor?: string;
    fontHeading?: string;
    fontBody?: string;
    darkMode?: boolean;
  };

  /** Metadata for SEO and sharing */
  meta?: {
    siteTitle?: string;
    description?: string;
    ogImage?: string;
    language?: string;
  };
}

// ---- Factory ----

export function createEmptyContentModel(mode: SiteMode = "profile"): ContentModel {
  return {
    siteMode: mode,
    profile: {
      name: "",
      title: "",
      summary: "",
      contact: [],
      links: [],
      tags: [],
    },
    projects: [],
    posts: [],
    experience: [],
    education: [],
    skills: [],
    awards: [],
    publications: [],
    media: [],
    demos: [],
    testimonials: [],
    customBlocks: [],
  };
}

// ---- Knowledge → ContentModel Mapper ----

import type { KnowledgeItem } from "./knowledge";

/**
 * Map knowledge items into a ContentModel.
 * This replaces the old buildWorkspaceDataFromKnowledge + buildWorkspaceDataFromSpec chain.
 */
export function buildContentModelFromKnowledge(
  items: KnowledgeItem[],
  mode: SiteMode = "profile",
): ContentModel {
  const model = createEmptyContentModel(mode);
  const selected = items.filter(i => i.selected);

  // Categorize items
  const factual = selected.filter(i => i.category === "factual");
  const experience = selected.filter(i => i.category === "experience");
  const skills = selected.filter(i => i.category === "skills");
  const workflow = selected.filter(i => i.category === "workflow");
  const framework = selected.filter(i => i.category === "framework");
  const media = selected.filter(i => i.category === "media");
  const opinion = selected.filter(i => i.category === "opinion");
  const meta = selected.filter(i => i.category === "meta");

  // Profile from factual items
  const nameItem = factual.find(i => /name|姓名|名字/i.test(i.title));
  const titleItem = factual.find(i => /title|职位|头衔|role|角色/i.test(i.title));
  const emailItem = factual.find(i => /email|邮箱|邮件/i.test(i.title));
  const bioItem = meta.find(i => /summary|简介|overview|bio|关于/i.test(i.title)) || meta[0];

  if (nameItem) model.profile.name = nameItem.content.trim().split("\n")[0];
  if (titleItem) model.profile.title = titleItem.content.trim().split("\n")[0];
  if (emailItem) model.profile.email = emailItem.content.trim();
  if (bioItem) model.profile.summary = bioItem.content;
  model.profile.tags = [...new Set(selected.flatMap(i => i.tags || []))].slice(0, 8);

  // Skills from skills + workflow + framework items
  const allSkillItems = [...skills, ...workflow, ...framework];
  if (allSkillItems.length > 0) {
    // Group by category for structured skill groups
    const skillMap: Record<string, string[]> = {};
    for (const item of allSkillItems) {
      const groupName = item.category === "workflow" ? "方法论" : item.category === "framework" ? "框架" : "技能";
      if (!skillMap[groupName]) skillMap[groupName] = [];
      // Try to extract individual skills from content
      const skillList = item.content.split(/[,，、;；\n]/).map(s => s.trim()).filter(s => s && s.length < 40);
      if (skillList.length > 1) {
        skillMap[groupName].push(...skillList);
      } else {
        skillMap[groupName].push(item.title);
      }
    }
    model.skills = Object.entries(skillMap).map(([title, skills]) => ({
      title,
      skills: [...new Set(skills)],
    }));
  }

  // Experience → projects + timeline
  for (const item of experience) {
    // Classify: work experience vs standalone project
    // Negative signals (work/employment markers) take priority
    const hasWorkMarker = /工作经历|工作经验|任职|在职|就职|实习经历|work\s*experience|employment|position\s*at|role\s*at/i.test(item.title);
    const hasProjectMarker = /(?:项目|project|作品|portfolio|case\s*study|案例)/i.test(item.title);
    const hasProjectTag = item.tags?.some(tag => /project|项目|作品|案例/i.test(tag));
    const isProject = !hasWorkMarker && (hasProjectMarker || hasProjectTag);
    if (isProject) {
      model.projects.push({
        id: item.id,
        title: item.title,
        description: item.content,
        tags: item.tags || [],
        knowledgeIds: [item.id],
      });
    } else {
      model.experience.push({
        id: item.id,
        title: item.title,
        org: "",
        period: "",
        description: item.content,
        tags: item.tags,
        current: false,
        knowledgeIds: [item.id],
      });
    }
  }

  // Media items → links and media
  for (const item of media) {
    const url = item.content.match(/https?:\/\/[^\s]+/)?.[0] || item.content;
    if (url.startsWith("http")) {
      model.media.push({
        type: "other",
        title: item.title,
        url,
        description: item.content,
      });
      model.profile.links.push({
        label: item.title,
        url,
        icon: "website",
      });
    }
  }

  // Opinion items → testimonials (if they look like quotes)
  for (const item of opinion) {
    if (item.content.length > 20) {
      model.testimonials.push({
        quote: item.content,
        author: item.title,
      });
    }
  }

  // Meta items → SEO, site narrative, section summaries
  for (const item of meta) {
    const titleLower = item.title.toLowerCase();
    // Site-level meta for SEO
    if (/routing|映射|mapping/i.test(titleLower)) {
      // Routing summary — skip, used internally not for display
      continue;
    }
    if (/summary|总结|overview|概述|bio|简介/i.test(titleLower)) {
      // Already captured as profile.summary above
      if (!model.meta) model.meta = {};
      model.meta.description = item.content.slice(0, 160);
      continue;
    }
    if (/tag|标签|keyword|关键词/i.test(titleLower)) {
      // Tags extracted for profile already, also use for SEO
      const moreTags = item.content.split(/[,，、;；\n]/).map(t => t.trim()).filter(t => t && t.length < 30);
      model.profile.tags = [...new Set([...model.profile.tags, ...moreTags])].slice(0, 12);
      continue;
    }
    // Other meta items → can be used as "about" sections or narrative blocks
    if (item.content.length > 50) {
      model.customBlocks.push({
        id: item.id,
        type: "rich-text",
        title: item.title,
        data: { content: item.content, source: "meta" },
      });
    }
  }

  // Relational items → informational blocks (cross-domain insights)
  const relational = selected.filter(i => i.category === "relational");
  for (const item of relational) {
    if (item.content.length > 30) {
      model.customBlocks.push({
        id: item.id,
        type: "rich-text",
        title: item.title,
        data: { content: item.content, source: "relational" },
      });
    }
  }

  // Set site meta
  if (!model.meta) model.meta = {};
  model.meta.siteTitle = model.profile.name ? `${model.profile.name}${model.profile.title ? ` — ${model.profile.title}` : ""}` : undefined;
  if (!model.meta.description && model.profile.summary) {
    model.meta.description = model.profile.summary.slice(0, 160);
  }

  // Chatbot context — structured by section, not flat dump
  const chatParts: string[] = [];
  if (model.profile.summary) chatParts.push(`## 关于\n${model.profile.summary}`);
  if (model.projects.length > 0) chatParts.push(`## 项目\n${model.projects.map(p => `- ${p.title}: ${p.description.slice(0, 100)}`).join("\n")}`);
  if (model.experience.length > 0) chatParts.push(`## 经历\n${model.experience.map(e => `- ${e.title} @ ${e.org}: ${e.description.slice(0, 100)}`).join("\n")}`);
  if (model.skills.length > 0) chatParts.push(`## 技能\n${model.skills.map(g => `${g.title}: ${g.skills.join(", ")}`).join("\n")}`);
  // Add all original items for comprehensive chatbot answers
  chatParts.push(`## 详细资料\n${selected.map(i => `### ${i.title}\n${i.content}`).join("\n\n")}`);

  model.chatbot = {
    enabled: true,
    knowledgeContext: chatParts.join("\n\n"),
  };

  return model;
}
