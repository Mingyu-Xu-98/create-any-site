/**
 * Builds a fallback CompositionPlan from theme/layout selections.
 * Used ONLY when the execution agent doesn't provide a compositionPlan.
 * The agent path is preferred — this is the legacy compatibility bridge.
 */
import type { ThemeStyle, LayoutType } from "../types";
import type { CompositionPlan, SectionKind } from "./types";
import { LAYOUT_FAMILY } from "../generator-config";

/** Helper to create a section entry with kind */
function s(id: string, kind: SectionKind, variant: string, type?: string): CompositionPlan["sections"][0] {
  return { id, kind, variant, type: type || id };
}

/**
 * Build a fallback composition plan for a given theme + layout combination.
 * For dedicated themes, returns a fixed plan matching the original page generator.
 * For layout-family themes, maps dynamically.
 */
export function buildCompositionPlan(
  theme: ThemeStyle,
  layout: LayoutType,
  availableSections?: string[],
): CompositionPlan {
  const sections = availableSections || ["about", "projects", "timeline", "skills", "education", "contact"];

  const dedicatedPlan = DEDICATED_THEME_PLANS[theme];
  if (dedicatedPlan) {
    return filterSections(dedicatedPlan, sections);
  }

  const family = LAYOUT_FAMILY[layout] || "single";
  const familyPlan = LAYOUT_FAMILY_PLANS[family](theme, layout);
  return filterSections(familyPlan, sections);
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
