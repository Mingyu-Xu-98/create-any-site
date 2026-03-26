// Knowledge Base types for multi-source analysis

export type SourceType = "pdf" | "zip" | "docx" | "txt" | "md" | "git" | "bilibili" | "youtube";

export interface Source {
  id: string;
  type: SourceType;
  name: string;        // filename or URL
  status: "pending" | "analyzing" | "done" | "error";
  error?: string;
  addedAt: string;
}

export type KnowledgeCategory =
  | "factual"       // 事实性知识: name, dates, locations, numbers, events
  | "skills"        // 技能性知识: abilities, tools, languages, certifications
  | "experience"    // 经历性知识: work history, education, projects
  | "relational"    // 关联性知识: connections between concepts, cause-effect
  | "media"         // 媒体资源: images, videos, links
  | "opinion"       // 观点性知识: views, reviews, preferences
  | "meta";         // 元信息: summary, tags, keywords

export interface KnowledgeItem {
  id: string;
  category: KnowledgeCategory;
  title: string;
  content: string;
  sourceId: string;      // which source it came from
  sourceName?: string;   // source display name
  sourceType?: string;   // source type (pdf, zip, git, etc.)
  selected: boolean;     // whether to use in website building
  tags: string[];
}

export interface KnowledgeBase {
  sources: Source[];
  items: KnowledgeItem[];
}

export const CATEGORY_META: Record<KnowledgeCategory, { label: string; labelCn: string; icon: string; color: string }> = {
  factual:    { label: "Facts",        labelCn: "事实性知识", icon: "📋", color: "bg-blue-500/20 text-blue-400" },
  skills:     { label: "Skills",       labelCn: "技能性知识", icon: "⚡", color: "bg-yellow-500/20 text-yellow-400" },
  experience: { label: "Experience",   labelCn: "经历性知识", icon: "📁", color: "bg-green-500/20 text-green-400" },
  relational: { label: "Relations",    labelCn: "关联性知识", icon: "🔗", color: "bg-purple-500/20 text-purple-400" },
  media:      { label: "Media",        labelCn: "媒体资源",   icon: "🖼️", color: "bg-pink-500/20 text-pink-400" },
  opinion:    { label: "Opinions",     labelCn: "观点性知识", icon: "💬", color: "bg-orange-500/20 text-orange-400" },
  meta:       { label: "Meta",         labelCn: "元信息",     icon: "🏷️", color: "bg-cyan-500/20 text-cyan-400" },
};

export const SOURCE_TYPE_META: Record<SourceType, { label: string; icon: string; accept?: string; placeholder?: string }> = {
  pdf:      { label: "PDF",      icon: "📄", accept: ".pdf" },
  docx:     { label: "DOCX",     icon: "📝", accept: ".docx,.doc" },
  txt:      { label: "TXT",      icon: "📃", accept: ".txt" },
  md:       { label: "MD",       icon: "📋", accept: ".md" },
  zip:      { label: "ZIP",      icon: "📦", accept: ".zip" },
  git:      { label: "Git",      icon: "🔀", placeholder: "https://github.com/user/repo" },
  bilibili: { label: "B站",      icon: "📺", placeholder: "https://www.bilibili.com/video/BVxxxxxx" },
  youtube:  { label: "YouTube",  icon: "▶️",  placeholder: "https://www.youtube.com/watch?v=xxxxx" },
};

export function createEmptyKB(): KnowledgeBase {
  return { sources: [], items: [] };
}
