/**
 * Core types for the component library.
 * Every section variant function receives a SectionContext and returns a JSX string.
 */
import type { WorkspaceData, ThemeStyle, LayoutType, FeatureFlags } from "../types";
import type { SiteSpec } from "../site-spec";
import type { ResolvedStyle } from "../generator-config";

/** Context passed to every section variant function */
export interface SectionContext {
  data: WorkspaceData;
  spec?: SiteSpec | null;
  theme: ThemeStyle;
  layout: LayoutType;
  styleConfig: ResolvedStyle;
  features: FeatureFlags;
  /** Per-section data from the plan (agent can pass arbitrary config) */
  sectionData?: Record<string, unknown>;
}

/** A section variant function — returns JSX string fragment */
export type SectionVariantFn = (ctx: SectionContext) => string;

/** A layout wrapper function — wraps assembled section content into a page structure */
export type LayoutWrapperFn = (ctx: SectionContext, parts: PageParts) => string;

/** An effect function — returns JSX, CSS, and any extra imports needed */
export type EffectFn = (ctx: SectionContext) => EffectOutput;

export interface EffectOutput {
  jsx: string;
  css: string;
  imports: string[];
}

/** Assembled page parts passed to layout wrappers */
export interface PageParts {
  nav: string;
  hero: string;
  sections: Array<{ id: string; content: string }>;
  footer: string;
  effects: EffectOutput[];
}

/**
 * Section kinds — stable rendering categories.
 * Agent picks `kind` to tell runtime which renderer family to use.
 * Agent picks `type` (free-form string) to describe the semantic purpose.
 * Agent picks `variant` (optional) to select a specific component.
 */
export type SectionKind =
  | "hero"       // 首屏/头图
  | "content"    // 通用内容块（关于、服务介绍、功能描述等）
  | "proof"      // 社会证明（客户评价、数据统计、合作伙伴 logo）
  | "showcase"   // 作品/项目展示
  | "skills"     // 技能/能力展示
  | "timeline"   // 时间线/经历
  | "gallery"    // 图片/媒体展示
  | "cta"        // 行动号召/联系
  | "pricing"    // 定价方案
  | "faq"        // 常见问题
  | "custom";    // 兜底：agent 自定义

/** Composition plan — the JSON that drives page assembly */
export interface CompositionPlan {
  layout: string;           // layout wrapper name (open string, not enum)
  nav: string;              // nav variant name
  hero: string;             // hero variant name
  sections: Array<{
    id: string;             // unique section id (e.g. "about", "services", "case-studies")
    kind: SectionKind;      // rendering category — tells runtime which renderer family
    type?: string;          // semantic label (free-form, e.g. "client-testimonials", "founder-letter")
    variant?: string;       // specific component variant (optional — runtime auto-selects if missing)
    data?: Record<string, unknown>; // arbitrary data the agent wants to pass to the renderer
  }>;
  effects: string[];
  footer: string;           // footer variant name
  /** Optional extension slots */
  extensions?: Array<{
    slot: string;
    position: "before" | "after";
    sectionId: string;
    config: Record<string, unknown>;
  }>;
}
