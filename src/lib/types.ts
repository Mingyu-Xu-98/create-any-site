export interface WorkspaceData {
  name: string;
  nameEn: string;
  title: string;
  titleEn: string;
  email: string;
  location: string;
  locationEn: string;
  skills: SkillGroup[];
  skillsEn: SkillGroup[];
  projects: ProjectItem[];
  projectsEn: ProjectItem[];
  timeline: TimelineItem[];
  timelineEn: TimelineItem[];
  education: EducationItem[];
  educationEn: EducationItem[];
  tags: string[];
  tagsEn: string[];
  bio: string;
  bioEn: string;
  bioTags: string[];
  bioTagsEn: string[];
  github?: string;
  linkedin?: string;
  links: LinkItem[];
  visibleSections: string[];
  chatbotContext: string;
}

export interface LinkItem {
  label: string;
  labelEn: string;
  url: string;
  icon?: string;
}

export interface SkillGroup {
  title: string;
  skills: string[];
}

export interface ProjectItem {
  title: string;
  org: string;
  desc: string;
  tags: string[];
  image: string;
  link?: string;
  badge?: string;
}

export interface TimelineItem {
  date: string;
  title: string;
  desc: string;
  active?: boolean;
}

export interface EducationItem {
  school: string;
  degree: string;
  highlights: string[];
}

// ---- Selection types ----

/**
 * Site type — open string. Common values for reference:
 * portfolio, brand, blog, landing, saas, e-commerce, agency, event, docs, custom
 */
export type SiteType = string;

/**
 * Theme — kept as union for type-safe CSS/config mapping.
 * "custom" allows agent to use arbitrary style_keywords via customTheme.
 */
export type ThemeStyle = "cyberpunk" | "minimalist" | "ghibli" | "glassmorphism" | "retro" | "brutalist"
  | "cinematic" | "bold-creative" | "editorial" | "nature" | "gradient-mesh" | "neo-tokyo"
  | "watercolor" | "terminal-green" | "vaporwave" | "craft-paper" | "aurora" | "ink-wash"
  | "tpl-business" | "tpl-resume-bold" | "tpl-resume-dark" | "tpl-blog" | "custom";

/**
 * Layout — kept as union for legacy generator compatibility.
 * CompositionPlan.layout is open string and not limited to these.
 */
export type LayoutType = "two-column" | "split-screen" | "asymmetric" | "f-shape" | "z-shape"
  | "card-grid" | "hero-media" | "masonry" | "magazine" | "fixed-nav" | "hidden-nav"
  | "interactive" | "custom";

export interface QuestionOption<T extends string> {
  value: T;
  icon: string;
  label: string;
  labelEn: string;
  desc: string;
  descEn: string;
  preview?: string;
}

export interface DesignIntelligence {
  style?: { category?: string };
  typography?: { bodyFont?: string; headingFont?: string; cssImport?: string };
}

// ---- Design System (from ui-skill BM25 engine) ----

export interface DesignSystemData {
  query: string;
  pattern: {
    name: string;
    sections: string;
    ctaPlacement: string;
    colorStrategy: string;
    conversionFocus: string;
  };
  style: {
    name: string;
    keywords: string;
    bestFor: string;
    cssKeywords: string;
    designVars: string;
    effects: string;
    performance: string;
    accessibility: string;
  };
  colors: {
    primary: string;
    onPrimary: string;
    secondary: string;
    onSecondary: string;
    accent: string;
    onAccent: string;
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    muted: string;
    mutedForeground: string;
    border: string;
    destructive: string;
    onDestructive: string;
    ring: string;
  };
  typography: {
    pairingName: string;
    headingFont: string;
    bodyFont: string;
    mood: string;
    cssImport: string;
    tailwindConfig: string;
  };
  effects: string;
  antiPatterns: string[];
}

// ---- Feature Flags ----

export interface FeatureFlags {
  chatbot: boolean;
  i18n: boolean;
  animations: boolean;
  share: boolean;
}

// ---- User Selections ----

/** Generation mode: default (template-driven) vs advanced (AI-driven component assembly) */
export type GenerationMode = "default" | "advanced";

export interface UserSelections {
  siteType: SiteType | null;
  theme: ThemeStyle | null;
  layout: LayoutType | null;
  customSiteType: string;
  customTheme: string;
  customLayout: string;
  features: FeatureFlags;
  /** Generation mode: "default" = template-driven, "advanced" = AI component assembly */
  mode?: GenerationMode;
  /** Template ID for default mode */
  templateId?: string;
  /** Content model for default mode — template reads this directly */
  contentModel?: import("./content-model").ContentModel;
  /** Composition plan from AI agent — drives the component assembler (advanced mode) */
  compositionPlan?: import("./components/types").CompositionPlan;
  /** Full site spec from compile-spec (carries pages/design/interactions) */
  fullSpec?: import("./site-spec").SiteSpec;
}

export interface WizardStep {
  id: string;
  title: string;
  subtitle: string;
}

export const DEFAULT_FEATURES: FeatureFlags = {
  chatbot: true,
  i18n: true,
  animations: true,
  share: true,
};

export const INITIAL_SELECTIONS: UserSelections = {
  siteType: null,
  theme: null,
  layout: null,
  customSiteType: "",
  customTheme: "",
  customLayout: "",
  features: { ...DEFAULT_FEATURES },
};

export const WIZARD_STEPS: WizardStep[] = [
  { id: "upload",   title: "上传工作区",   subtitle: "上传你的工作区压缩包" },
  { id: "siteType", title: "网站类型",     subtitle: "选择要构建的网站类型" },
  { id: "theme",    title: "视觉风格",     subtitle: "选择一种独特的设计风格" },
  { id: "generate", title: "生成网站",     subtitle: "预览你的网站" },
];

