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

/** Primary knowledge type: factual (what) vs procedural (how) */
export type KnowledgeType = "fact" | "skill";

/**
 * Fine-grained category for knowledge routing.
 * Kept backwards-compatible: old 7 categories still valid, new ones added.
 */
export type KnowledgeCategory =
  // Factual subtypes
  | "factual"       // 事实性知识: name, dates, locations, numbers, events
  | "experience"    // 经历性知识: work history, education, projects
  | "relational"    // 关联性知识: connections between concepts, cause-effect
  | "media"         // 媒体资源: images, videos, links
  | "opinion"       // 观点性知识: views, reviews, preferences
  | "meta"          // 元信息: summary, tags, keywords
  // Procedural subtypes
  | "skills"        // 技能性知识: abilities, tools, languages, certifications
  | "workflow"      // 工作流程: step-by-step processes, methodologies
  | "framework";    // 分析框架: decision models, evaluation criteria

/** Infer primary type from category */
export function knowledgeTypeOf(category: KnowledgeCategory): KnowledgeType {
  return (category === "skills" || category === "workflow" || category === "framework") ? "skill" : "fact";
}

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
  /** When should this knowledge be used? (from mapping/routing) */
  useCase?: string;
  /** Confidence: how structured/reliable is this item (0-1) */
  confidence?: number;
  /** Data format: "narrative" for markdown text, "structured" for JSON data */
  format?: "narrative" | "structured";
}

/** Relation types between knowledge items */
export type RelationType =
  | "used_in"           // 技能/工具 → 项目/经历 (Python used in Data Pipeline)
  | "belongs_to"        // 经历 → 组织 (Engineer role belongs to TechCorp)
  | "requires"          // 技能 → 技能 (React requires JavaScript)
  | "produced"          // 经历 → 成果 (Project produced paper/award)
  | "collaborated_with" // 人 → 人/组织 (Collaborated with Team X)
  | "led_to"            // 经历 → 经历 (Internship led to full-time)
  | "part_of";          // 条目 → 条目 (Chapter part of Book)

export interface KnowledgeRelation {
  id: string;
  fromId: string;
  toId: string;
  relationType: RelationType;
  label?: string;
  strength?: number; // 1-3
}

export const RELATION_META: Record<RelationType, { label: string; labelCn: string; icon: string }> = {
  used_in:           { label: "Used in",          labelCn: "应用于",   icon: "→" },
  belongs_to:        { label: "Belongs to",       labelCn: "属于",     icon: "⊂" },
  requires:          { label: "Requires",         labelCn: "依赖",     icon: "←" },
  produced:          { label: "Produced",         labelCn: "产出",     icon: "★" },
  collaborated_with: { label: "Collaborated with",labelCn: "协作",     icon: "⇄" },
  led_to:            { label: "Led to",           labelCn: "发展为",   icon: "⇒" },
  part_of:           { label: "Part of",          labelCn: "属于",     icon: "∈" },
};

export interface KnowledgeBase {
  sources: Source[];
  items: KnowledgeItem[];
  relations?: KnowledgeRelation[];
}

export const CATEGORY_META: Record<KnowledgeCategory, { label: string; labelCn: string; icon: string; color: string; type: KnowledgeType }> = {
  // Factual types
  factual:    { label: "Facts",        labelCn: "事实信息", icon: "📋", color: "bg-blue-500/20 text-blue-400", type: "fact" },
  experience: { label: "Experience",   labelCn: "经历成果", icon: "📁", color: "bg-green-500/20 text-green-400", type: "fact" },
  relational: { label: "Relations",    labelCn: "关联关系", icon: "🔗", color: "bg-purple-500/20 text-purple-400", type: "fact" },
  media:      { label: "Media",        labelCn: "媒体资源", icon: "🖼️", color: "bg-pink-500/20 text-pink-400", type: "fact" },
  opinion:    { label: "Opinions",     labelCn: "观点偏好", icon: "💬", color: "bg-orange-500/20 text-orange-400", type: "fact" },
  meta:       { label: "Meta",         labelCn: "元信息",   icon: "🏷️", color: "bg-cyan-500/20 text-cyan-400", type: "fact" },
  // Procedural types
  skills:     { label: "Skills",       labelCn: "技能能力", icon: "⚡", color: "bg-yellow-500/20 text-yellow-400", type: "skill" },
  workflow:   { label: "Workflow",     labelCn: "工作流程", icon: "🔄", color: "bg-emerald-500/20 text-emerald-400", type: "skill" },
  framework:  { label: "Framework",   labelCn: "分析框架", icon: "🧩", color: "bg-indigo-500/20 text-indigo-400", type: "skill" },
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
