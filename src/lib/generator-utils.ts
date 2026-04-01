/**
 * Utility functions for the generator system.
 * Extracted from generator.ts — Phase 1 refactor.
 */
import type { WorkspaceData, ThemeStyle, LayoutType, UserSelections } from "./types";
import type { SiteSpec, SiteSpecSection } from "./site-spec";

export function resolveSelections(selections: UserSelections): { theme: ThemeStyle; layout: LayoutType } {
  const theme: ThemeStyle = selections.theme === "custom" ? "minimalist" : (selections.theme || "cyberpunk");
  const layout: LayoutType = selections.layout === "custom" ? "card-grid" : (selections.layout || "card-grid");
  return { theme, layout };
}

export function getStyleBgMarkup(theme: ThemeStyle): string {
  switch (theme) {
    case "cyberpunk": return `<div className="cyber-grid" /><div className="scanlines" /><ParticleBackground />`;
    case "glassmorphism": return `<div className="glass-bg"><div className="blob blob-1" /><div className="blob blob-2" /><div className="blob blob-3" /><div className="blob blob-4" /></div>`;
    case "ghibli": return `<div className="ghibli-clouds" />`;
    case "retro": return `<GrainOverlay />`;
    case "cinematic": return `<div className="cinematic-bg" /><div className="letterbox-top" /><div className="letterbox-bottom" />`;
    case "bold-creative": return `<div className="bold-bg"><div className="shape shape-1" /><div className="shape shape-2" /><div className="shape shape-3" /></div>`;
    case "gradient-mesh": return `<div className="mesh-bg"><div className="blob blob-1" /><div className="blob blob-2" /><div className="blob blob-3" /></div>`;
    case "neo-tokyo": return `<div className="neotokyo-bg" />`;
    case "tpl-resume-bold": return `<div className="bold-resume-bg"><div className="shape shape-1" /><div className="shape shape-2" /><div className="shape shape-3" /></div>`;
    case "tpl-resume-dark": return `<div className="dark-resume-bg"><div className="blob blob-1" /><div className="blob blob-2" /><div className="blob blob-3" /></div>`;
    case "tpl-blog": return `<div className="blog-grain" />`;
    case "nature": return "";
    case "editorial": return "";
    default: return "";
  }
}

export function readSpecValue(input: unknown): string {
  if (!input) return "";
  if (typeof input === "string") return input;
  if (typeof input === "object" && input !== null && "value" in input && typeof (input as { value?: unknown }).value === "string") {
    return (input as { value: string }).value;
  }
  return "";
}

export function getSpecTitle(spec?: SiteSpec | null): string {
  return readSpecValue(spec?.identity?.title) || "";
}

export function getSpecName(spec?: SiteSpec | null): string {
  return readSpecValue(spec?.identity?.name) || "";
}

export function getSectionTitles(spec?: SiteSpec | null): Partial<Record<string, string>> {
  const map: Partial<Record<string, string>> = {};
  // Read from pages[] if available, else sections[]
  const allSections = spec?.pages?.flatMap(p => p.sections) || spec?.sections || [];
  for (const section of allSections) {
    const key = section.id || section.type;
    if (!key) continue;
    const data = section.data || {};
    const title = typeof data.heading === "string"
      ? data.heading
      : typeof data.title === "string"
        ? data.title
        : "";
    if (title) map[key] = title;
  }
  return map;
}

/**
 * Get available sections. No longer filters by a hardcoded whitelist.
 * When using CompositionPlan, sections are defined by the plan itself.
 * This function is only used for legacy path and nav rendering.
 */
export function getAvailableSections(data: WorkspaceData, spec?: SiteSpec | null): string[] {
  // If spec has sections, trust them all (agent decided these)
  const specSections = (spec?.sections || [])
    .filter((section: SiteSpecSection) => section.enabled !== false)
    .map((section: SiteSpecSection) => section.id || section.type)
    .filter((value): value is string => Boolean(value) && value !== "links");

  if (specSections.length > 0) return specSections;

  // Fallback: derive from data
  return data.visibleSections && data.visibleSections.length > 0
    ? data.visibleSections.filter(s => s !== "links")
    : [
      "about",
      ...(data.projects.length > 0 ? ["projects"] : []),
      ...(data.timeline.length > 0 ? ["timeline"] : []),
      ...(data.skills.length > 0 ? ["skills"] : []),
      ...(data.education.length > 0 ? ["education"] : []),
      "contact",
    ];
}

export function findSpecSection(spec: SiteSpec | null | undefined, id: string): SiteSpecSection | undefined {
  // Search pages[] first, then flat sections[]
  if (spec?.pages) {
    for (const page of spec.pages) {
      const found = page.sections.find(s => (s.id || s.type) === id || s.kind === id);
      if (found) return found;
    }
  }
  return spec?.sections?.find(section => (section.id || section.type) === id || section.kind === id);
}

export function readStringArray(input: unknown): string[] {
  return Array.isArray(input) ? input.filter((item): item is string => typeof item === "string") : [];
}

export function readProjectItems(input: unknown): WorkspaceData["projects"] | null {
  if (!Array.isArray(input)) return null;
  return input.map((item, index) => {
    const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
    return {
      title: typeof record.title === "string" ? record.title : `Project ${index + 1}`,
      org: typeof record.org === "string" ? record.org : "",
      desc: typeof record.description === "string"
        ? record.description
        : typeof record.desc === "string"
          ? record.desc
          : "",
      tags: readStringArray(record.tags),
      image: typeof record.image === "string" ? record.image : "",
      link: typeof record.link === "string" ? record.link : "",
      badge: typeof record.badge === "string" ? record.badge : "",
    };
  });
}

export function readTimelineItems(input: unknown): WorkspaceData["timeline"] | null {
  if (!Array.isArray(input)) return null;
  return input.map((item, index) => {
    const record = (item && typeof item === "object") ? item as Record<string, unknown> : {};
    return {
      date: typeof record.period === "string"
        ? record.period
        : typeof record.date === "string"
          ? record.date
          : "",
      title: typeof record.title === "string" ? record.title : `Experience ${index + 1}`,
      desc: typeof record.description === "string"
        ? record.description
        : typeof record.desc === "string"
          ? record.desc
          : "",
      active: Boolean(record.current ?? record.active),
    };
  });
}

export function buildHeroLines(data: WorkspaceData, spec?: SiteSpec | null, isEnglish = false): string[] {
  const heroSection = findSpecSection(spec, "hero");
  const headline = typeof heroSection?.data?.headline === "string" ? heroSection.data.headline : "";
  const subheadline = typeof heroSection?.data?.subheadline === "string" ? heroSection.data.subheadline : "";
  const ctaLabel = heroSection?.data && typeof heroSection.data === "object" && heroSection.data !== null && "cta" in heroSection.data
    ? typeof (heroSection.data.cta as Record<string, unknown>)?.label === "string"
      ? ((heroSection.data.cta as Record<string, unknown>).label as string)
      : ""
    : "";

  const fallback = isEnglish
    ? [`> Hello World`, `> ${data.nameEn || data.name}`, `> ${data.titleEn || data.title}`, `> ${data.locationEn || data.location} · ${data.email}`]
    : [`> Hello World`, `> ${data.name}`, `> ${data.title}`, `> ${data.location} · ${data.email}`];

  const lines = [
    `> ${headline || (isEnglish ? (data.nameEn || data.name) : data.name)}`,
    subheadline ? `> ${subheadline}` : `> ${isEnglish ? (data.titleEn || data.title) : data.title}`,
    ctaLabel ? `> ${ctaLabel}` : "",
    `> ${(isEnglish ? (data.locationEn || data.location) : data.location) || ""}${data.email ? ` · ${data.email}` : ""}`,
  ].filter(line => line !== "> " && line.trim() !== ">");

  return lines.length > 0 ? lines : fallback;
}
