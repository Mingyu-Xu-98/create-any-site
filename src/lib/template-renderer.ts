/**
 * Template Renderer — the new default generation path.
 *
 * Input:  ContentModel (unified content schema)
 * Output: Record<string, string> (file map, same as generateFileMap)
 *
 * Templates are fixed page structures that read ContentModel fields.
 * AI only fills the content, the system controls the structure.
 */
import type { ContentModel, SiteMode, Project, Post, Experience, SkillGroup } from "./content-model";
import { getInstalledNextVersion } from "./next-version";

// ---- Template Registry ----

export interface Template {
  id: string;
  name: string;
  nameCn: string;
  mode: SiteMode;
  description: string;
  /** Function that generates all site files from content */
  render: (content: ContentModel) => Record<string, string>;
}

const templates: Record<string, Template> = {};

export function registerTemplate(template: Template) {
  templates[template.id] = template;
}

export function getTemplate(id: string): Template | undefined {
  return templates[id];
}

export function getTemplatesForMode(mode: SiteMode): Template[] {
  return Object.values(templates).filter(t => t.mode === mode);
}

export function listTemplateIds(): string[] {
  return Object.keys(templates);
}

/** Auto-select the best template for a content model */
export function autoSelectTemplate(content: ContentModel): string {
  const modeTemplates = getTemplatesForMode(content.siteMode);
  if (content.design?.templateId && templates[content.design.templateId]) {
    return content.design.templateId;
  }
  // Pick first available for the mode
  return modeTemplates[0]?.id || "profile-minimal";
}

// ---- Shared Generation Helpers ----

export function genSharedFiles(content: ContentModel): Record<string, string> {
  const files: Record<string, string> = {};
  const nextVersion = getInstalledNextVersion();

  // package.json
  files["package.json"] = JSON.stringify({
    name: "my-site",
    version: "1.0.0",
    type: "module",
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: {
      "@tailwindcss/postcss": "^4.2.1",
      "@types/node": "^25.4.0",
      "@types/react": "^19.2.14",
      dijkstrajs: "^1.0.3",
      next: nextVersion,
      postcss: "^8.5.8",
      pngjs: "^7.0.0",
      react: "^19.2.4",
      "react-dom": "^19.2.4",
      qrcode: "^1.5.4",
      "@types/qrcode": "^1.5.5",
      tailwindcss: "^4.2.1",
      typescript: "^5.9.3",
    },
  }, null, 2);

  // tsconfig
  files["tsconfig.json"] = JSON.stringify({
    compilerOptions: {
      target: "ES2017", lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true, skipLibCheck: true, strict: true, noEmit: true,
      esModuleInterop: true, module: "esnext", moduleResolution: "bundler",
      resolveJsonModule: true, isolatedModules: true, jsx: "preserve",
      incremental: true, plugins: [{ name: "next" }],
      paths: { "@/*": ["./src/*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  }, null, 2);

  // next config
  files["next.config.ts"] = `import type { NextConfig } from "next";\nconst nextConfig: NextConfig = {};\nexport default nextConfig;\n`;
  files["postcss.config.mjs"] = `const config = { plugins: { "@tailwindcss/postcss": {} } };\nexport default config;\n`;
  files[".gitignore"] = "node_modules/\n.next/\n.env.local\n.DS_Store\n";

  // not-found page
  files["src/app/not-found.tsx"] = `export default function NotFound() {\n  return (\n    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>\n      <h1>404 - Page Not Found</h1>\n    </div>\n  );\n}\n`;

  // knowledge.json for chatbot
  const chunks: Array<{ topic: string; content: string }> = [];
  if (content.profile.summary) chunks.push({ topic: "personal", content: `${content.profile.name}: ${content.profile.summary}` });
  for (const p of content.projects.slice(0, 10)) chunks.push({ topic: "projects", content: `${p.title}: ${p.description}` });
  for (const e of content.experience.slice(0, 10)) chunks.push({ topic: "experience", content: `${e.title} @ ${e.org}: ${e.description}` });
  for (const g of content.skills) chunks.push({ topic: "skills", content: `${g.title}: ${g.skills.join(", ")}` });
  if (content.chatbot?.knowledgeContext) {
    const ctxChunks = content.chatbot.knowledgeContext.split("\n## ").filter(Boolean);
    for (const chunk of ctxChunks.slice(0, 20)) {
      const lines = chunk.split("\n");
      chunks.push({ topic: lines[0]?.trim() || "general", content: chunk });
    }
  }
  files["src/data/knowledge.json"] = JSON.stringify({ chunks }, null, 2);

  // .env.local
  files[".env.local"] = `SILICONFLOW_API_KEY=sk-tiucfyagykltjzwgnkyzgxkrzkomwwfrauhvepzserdjtupv\n`;

  files["public/images/README.txt"] = "Place your project images and avatar.png here.\n";

  return files;
}

// ---- Content serialization for translations ----

export function serializeTranslations(content: ContentModel): string {
  const p = content.profile;
  const zh = {
    nav: { projects: "项目", experience: "经历", skills: "技能", education: "教育", contact: "联系", posts: "文章", awards: "荣誉", publications: "论文" },
    hero: { name: p.name, title: p.title || "", subtitle: p.subtitle || "", tags: p.tags.slice(0, 6) },
    about: { text: p.summary || "", tags: p.tags },
    projects: content.projects.map(pr => ({ title: pr.title, org: pr.org || "", desc: pr.description, tags: pr.tags, image: pr.image || "", link: pr.link || "", badge: pr.badge || "", detail: pr.detail || "", highlights: pr.highlights || [], role: pr.role || "", period: pr.period || "" })),
    posts: content.posts.map(po => ({ title: po.title, slug: po.slug, excerpt: po.excerpt, content: po.content, category: po.category || "", tags: po.tags, image: po.image || "", publishedAt: po.publishedAt || "", readingTime: po.readingTime || "" })),
    experience: content.experience.map(e => ({ title: e.title, org: e.org, period: e.period, desc: e.description, highlights: e.highlights || [], current: e.current || false })),
    education: content.education.map(e => ({ school: e.school, degree: e.degree, period: e.period || "", highlights: e.highlights || [] })),
    skills: content.skills.map(g => ({ title: g.title, skills: g.skills })),
    awards: content.awards.map(a => ({ title: a.title, org: a.org || "", year: a.year || "", description: a.description || "" })),
    publications: content.publications.map(pub => ({ title: pub.title, authors: pub.authors || "", venue: pub.venue || "", year: pub.year || "", abstract: pub.abstract || "", url: pub.url || "" })),
    media: content.media.map(m => ({ type: m.type, title: m.title, platform: m.platform || "", url: m.url, date: m.date || "", description: m.description || "" })),
    testimonials: content.testimonials.map(t => ({ quote: t.quote, author: t.author, role: t.role || "", company: t.company || "" })),
    demos: content.demos.map(d => ({ title: d.title, description: d.description, url: d.url, screenshot: d.screenshot || "", techStack: d.techStack || [] })),
    footer: `© ${new Date().getFullYear()} ${p.name}`,
    contact: { email: p.email || "", links: p.contact },
    chatbot: { title: `${p.name} AI`, subtitle: "有什么想问的？", welcome: `你好！可以问我关于${p.name}的经历和技能。`, placeholder: "输入你的问题...", send: "发送", tooltip: "AI 对话", suggestions: buildSuggestions(content, false) },
    share: { button: "分享", title: "邀请好友", invite: `欢迎来和 ${p.name} 的 AI 分身聊天`, desc: `这里有完整的简历资料`, save: "保存海报", copy: "复制链接", copied: "已复制！" },
    availableSections: getAvailableSections(content),
  };

  // English version (simplified — same data, English keys)
  const en = {
    ...zh,
    nav: { projects: "Projects", experience: "Experience", skills: "Skills", education: "Education", contact: "Contact", posts: "Posts", awards: "Awards", publications: "Publications" },
    footer: `© ${new Date().getFullYear()} ${p.nameEn || p.name}`,
    chatbot: { ...zh.chatbot, subtitle: "Ask me anything", welcome: `Hi! Ask me about ${p.nameEn || p.name}'s experience.`, placeholder: "Type your question...", send: "Send", tooltip: "AI Chat", suggestions: buildSuggestions(content, true) },
    share: { ...zh.share, button: "Share", title: "Invite", invite: `Chat with ${p.nameEn || p.name}'s AI`, desc: "Full resume and portfolio here", save: "Save poster", copy: "Copy link", copied: "Copied!" },
  };

  return `/* eslint-disable @typescript-eslint/no-explicit-any */
interface TProject { title: string; org: string; desc: string; tags: string[]; image: string; link: string; badge: string; detail: string; highlights: string[]; role: string; period: string; }
interface TPost { title: string; slug: string; excerpt: string; content: string; category: string; tags: string[]; image: string; publishedAt: string; readingTime: string; }
interface TExp { title: string; org: string; period: string; desc: string; highlights: string[]; current: boolean; }
interface TEdu { school: string; degree: string; period: string; highlights: string[]; }
interface TSkill { title: string; skills: string[]; }
interface TAward { title: string; org: string; year: string; description: string; }
interface TPub { title: string; authors: string; venue: string; year: string; abstract: string; url: string; }
interface TMedia { type: string; title: string; platform: string; url: string; date: string; description: string; }
interface TTest { quote: string; author: string; role: string; company: string; }
interface TDemo { title: string; description: string; url: string; screenshot: string; techStack: string[]; }
interface TData {
  nav: Record<string, string>;
  hero: { name: string; title: string; subtitle: string; tags: string[] };
  about: { text: string; tags: string[] };
  projects: TProject[];
  posts: TPost[];
  experience: TExp[];
  education: TEdu[];
  skills: TSkill[];
  awards: TAward[];
  publications: TPub[];
  media: TMedia[];
  testimonials: TTest[];
  demos: TDemo[];
  footer: string;
  contact: { email: string; links: Array<{ type: string; label: string; url: string; icon?: string }> };
  chatbot: { title: string; subtitle: string; welcome: string; placeholder: string; send: string; tooltip: string; suggestions: string[] };
  share: { button: string; title: string; invite: string; desc: string; save: string; copy: string; copied: string };
  availableSections: string[];
  [key: string]: any;
}

export const translations: { zh: TData; en: TData } = { zh: ${JSON.stringify(zh, null, 2)} as TData, en: ${JSON.stringify(en, null, 2)} as TData };
export type Lang = keyof typeof translations;
export type Translations = TData;
`;
}

function buildSuggestions(content: ContentModel, isEn: boolean): string[] {
  const suggestions: string[] = [];
  if (content.projects.length > 0) {
    const p = content.projects[0];
    suggestions.push(isEn ? `Tell me about "${p.title}"` : `介绍一下「${p.title}」`);
  }
  if (content.skills.length > 0) {
    suggestions.push(isEn ? `What are your main skills?` : `你有哪些核心技能？`);
  }
  if (content.experience.length > 0) {
    suggestions.push(isEn ? `Describe your work experience` : `介绍一下你的工作经历`);
  }
  if (suggestions.length < 3) {
    suggestions.push(isEn ? `Are you available for collaboration?` : `你现在接受合作吗？`);
  }
  return suggestions.slice(0, 3);
}

function getAvailableSections(content: ContentModel): string[] {
  const sections: string[] = ["about"];
  if (content.projects.length > 0) sections.push("projects");
  if (content.posts.length > 0) sections.push("posts");
  if (content.experience.length > 0) sections.push("experience");
  if (content.skills.length > 0) sections.push("skills");
  if (content.education.length > 0) sections.push("education");
  if (content.awards.length > 0) sections.push("awards");
  if (content.publications.length > 0) sections.push("publications");
  if (content.media.length > 0) sections.push("media");
  if (content.demos.length > 0) sections.push("demos");
  if (content.testimonials.length > 0) sections.push("testimonials");
  sections.push("contact");
  return sections;
}

// ---- Main render function ----

/**
 * Render a complete site from ContentModel using a template.
 * Returns the same Record<string, string> as generateFileMap.
 */
export function renderFromContentModel(
  content: ContentModel,
  templateId?: string,
): Record<string, string> {
  const tid = templateId || autoSelectTemplate(content);
  const template = templates[tid];

  if (!template) {
    // Fallback: use first available template for the mode
    const fallback = getTemplatesForMode(content.siteMode)[0];
    if (fallback) return fallback.render(content);
    throw new Error(`No template found for mode ${content.siteMode}`);
  }

  return template.render(content);
}
