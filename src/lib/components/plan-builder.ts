/**
 * Builds a CompositionPlan. Tries multiple strategies:
 * 1. From SiteSpec sections with kind info (best — spec-driven)
 * 2. From theme/layout dedicated plans (legacy theme matching)
 * 3. From layout family defaults (generic fallback)
 */
import type { ThemeStyle, LayoutType } from "../types";
import type { SiteSpec, SiteSpecSection } from "../site-spec";
import type { CompositionPlan, SectionKind } from "./types";
import { LAYOUT_FAMILY } from "../generator-config";

/** Helper to create a section entry with kind */
function s(id: string, kind: SectionKind, variant: string, type?: string): CompositionPlan["sections"][0] {
  return { id, kind, variant, type: type || id };
}

/** Infer kind from section id/type when kind is not explicitly set */
function inferKind(id: string): SectionKind {
  const map: Record<string, SectionKind> = {
    hero: "hero", about: "content", services: "content", features: "content",
    "how-it-works": "content", team: "content", story: "content",
    projects: "showcase", portfolio: "showcase", "case-studies": "showcase", work: "showcase",
    skills: "skills", "tech-stack": "skills",
    timeline: "timeline", experience: "timeline", milestones: "timeline",
    testimonials: "proof", reviews: "proof", clients: "proof", stats: "proof",
    gallery: "gallery", photos: "gallery", media: "gallery",
    contact: "cta", "get-started": "cta", newsletter: "cta", "hire-me": "cta",
    pricing: "pricing", plans: "pricing",
    faq: "faq",
    education: "content",
  };
  return map[id] || "content";
}

/**
 * Build a composition plan. Prefers spec-driven approach.
 */
export function buildCompositionPlan(
  theme: ThemeStyle,
  layout: LayoutType,
  availableSections?: string[],
  spec?: SiteSpec | null,
): CompositionPlan {
  // Strategy 1: Build from spec sections with kind info
  if (spec) {
    const allSections = spec.pages?.flatMap(p => p.sections) || spec.sections || [];
    const enabled = allSections.filter(sec => sec.enabled !== false && sec.id);
    if (enabled.length > 0 && enabled.some(sec => sec.kind)) {
      return buildFromSpecSections(enabled, spec.navigation?.style);
    }
    // Even without kind, if spec has sections, use them with inferred kinds
    if (enabled.length > 0) {
      return buildFromSpecSections(enabled.map(sec => ({ ...sec, kind: sec.kind || inferKind(sec.id || sec.type || "") })), spec.navigation?.style);
    }
  }

  // Strategy 2: Dedicated theme plans
  const sections = availableSections || ["about", "projects", "timeline", "skills", "education", "contact"];
  const dedicatedPlan = DEDICATED_THEME_PLANS[theme];
  if (dedicatedPlan) {
    return filterSections(dedicatedPlan, sections);
  }

  // Strategy 3: Layout family fallback
  const family = LAYOUT_FAMILY[layout] || "single";
  const familyPlan = LAYOUT_FAMILY_PLANS[family](theme, layout);
  return filterSections(familyPlan, sections);
}

/** Build a plan directly from spec sections — no hardcoded skeleton */
function buildFromSpecSections(sections: SiteSpecSection[], navStyle?: string): CompositionPlan {
  const heroSection = sections.find(sec => sec.kind === "hero");
  const nonHero = sections.filter(sec => sec.kind !== "hero");

  return {
    layout: "single",
    nav: navStyle || "sticky",
    hero: heroSection?.variant || "centered",
    sections: nonHero.map(sec => ({
      id: sec.id || sec.type || "section",
      kind: (sec.kind || "content") as SectionKind,
      type: sec.type,
      variant: sec.variant,
      data: sec.data,
    })),
    effects: [],
    footer: "standard",
  };
}

function filterSections(plan: CompositionPlan, available: string[]): CompositionPlan {
  const availableSet = new Set(available);
  return {
    ...plan,
    sections: plan.sections.filter(sec => {
      if (sec.id === "about") return true;
      return availableSet.has(sec.id);
    }),
  };
}

// ---- Dedicated theme plans ----

const DEDICATED_THEME_PLANS: Partial<Record<ThemeStyle, CompositionPlan>> = {
  "tpl-resume-bold": {
    layout: "single", nav: "bold", hero: "split",
    sections: [
      s("about", "content", "education-cards", "about"),
      s("timeline", "timeline", "reveal", "work-history"),
      s("skills", "skills", "bars", "tech-stack"),
      s("projects", "showcase", "showcase", "project-highlights"),
      s("education", "content", "education-grouped", "education"),
      s("contact", "cta", "chips", "hire-me"),
    ],
    effects: ["reveal"], footer: "bold",
  },
  "tpl-blog": {
    layout: "single", nav: "blog", hero: "editorial",
    sections: [
      s("about", "content", "education-cards", "author-bio"),
      s("skills", "skills", "staggered", "topics"),
      s("projects", "showcase", "blog-grid", "featured-posts"),
      s("timeline", "timeline", "blog", "writing-journey"),
      s("education", "content", "education-blog", "background"),
      s("contact", "cta", "blog-center", "newsletter"),
    ],
    effects: ["reveal"], footer: "blog",
  },
  ghibli: {
    layout: "single", nav: "sticky", hero: "landscape",
    sections: [
      s("about", "content", "education-cards", "about"),
      s("projects", "showcase", "parchment", "works"),
      s("timeline", "timeline", "parchment", "journey"),
      s("skills", "skills", "parchment", "abilities"),
      s("education", "content", "education-parchment", "education"),
      s("contact", "cta", "center", "contact"),
    ],
    effects: [], footer: "standard",
  },
  minimalist: {
    layout: "single", nav: "mini", hero: "minimal",
    sections: [
      s("about", "content", "education-cards", "about"),
      s("timeline", "timeline", "minimal", "experience"),
      s("projects", "showcase", "grid", "projects"),
      s("skills", "skills", "mini-grid", "skills"),
      s("education", "content", "education-grid", "education"),
      s("contact", "cta", "card", "contact"),
    ],
    effects: [], footer: "standard",
  },
  brutalist: {
    layout: "single", nav: "minimal", hero: "brutalist",
    sections: [
      s("about", "content", "education-cards", "about"),
      s("projects", "showcase", "list", "work"),
      s("timeline", "timeline", "compact", "history"),
      s("skills", "skills", "flat", "tools"),
      s("education", "content", "education-list", "education"),
      s("contact", "cta", "minimal", "contact"),
    ],
    effects: [], footer: "minimal",
  },
  glassmorphism: {
    layout: "sidebar", nav: "sidebar", hero: "neon",
    sections: [
      s("about", "content", "education-cards", "about"),
      s("projects", "showcase", "glass-minimal", "portfolio"),
      s("skills", "skills", "chips", "abilities"),
      s("timeline", "timeline", "vertical", "experience"),
      s("education", "content", "education-cards", "education"),
      s("contact", "cta", "center", "contact"),
    ],
    effects: [], footer: "standard",
  },
};

// ---- Layout-family-based plan builders ----

type PlanBuilder = (theme: ThemeStyle, layout: LayoutType) => CompositionPlan;

const LAYOUT_FAMILY_PLANS: Record<string, PlanBuilder> = {
  single: (theme, layout) => ({
    layout: "single",
    nav: layout === "hidden-nav" ? "hamburger" : "sticky",
    hero: "centered",
    sections: [
      s("about", "content", "education-cards", "about"),
      s("projects", "showcase", layout === "z-shape" ? "zigzag" : "standard", "projects"),
      s("timeline", "timeline", "vertical", "experience"),
      s("skills", "skills", "grouped", "skills"),
      s("education", "content", "education-cards", "education"),
      s("contact", "cta", "center", "contact"),
    ],
    effects: theme === "cyberpunk" ? ["particles", "scanlines"] : [],
    footer: "standard",
  }),

  sidebar: () => ({
    layout: "sidebar", nav: "sidebar", hero: "sidebar-card",
    sections: [
      s("about", "content", "education-cards", "about"),
      s("projects", "showcase", "sidebar", "projects"),
      s("timeline", "timeline", "vertical", "experience"),
      s("skills", "skills", "grouped", "skills"),
      s("education", "content", "education-cards", "education"),
      s("contact", "cta", "center", "contact"),
    ],
    effects: [], footer: "standard",
  }),

  split: () => ({
    layout: "split", nav: "split-panel", hero: "split-panel",
    sections: [
      s("about", "content", "education-cards", "about"),
      s("projects", "showcase", "split", "projects"),
      s("timeline", "timeline", "vertical", "experience"),
      s("skills", "skills", "grouped", "skills"),
      s("education", "content", "education-cards", "education"),
      s("contact", "cta", "center", "contact"),
    ],
    effects: [], footer: "standard",
  }),

  grid: (_theme, layout) => ({
    layout: "grid", nav: "sticky", hero: "centered",
    sections: [
      s("about", "content", "education-cards", "about"),
      s("projects", "showcase", layout === "masonry" ? "masonry" : layout === "magazine" ? "magazine" : "bento", "projects"),
      s("timeline", "timeline", "vertical", "experience"),
      s("skills", "skills", "grouped", "skills"),
      s("education", "content", "education-cards", "education"),
      s("contact", "cta", "center", "contact"),
    ],
    effects: [], footer: "standard",
  }),
};
