/**
 * Composition Patterns — curated reference combinations for Design Agent.
 *
 * These are NOT constraints — they are "proven combinations" that Design Agent
 * can use as a starting point and then customize. The agent is free to mix
 * and match variants from different patterns or invent entirely new combos.
 *
 * Each pattern includes content signals that help the agent match user
 * profiles to appropriate compositions.
 */

export interface CompositionPattern {
  id: string;
  name: string;
  description: string;
  /** Content signals that suggest this pattern — used for matching */
  contentSignals: string[];
  /** Recommended component selections */
  components: {
    layout: string;
    nav: string;
    hero: string;
    sections: Array<{ kind: string; variant: string }>;
    effects: string[];
    footer: string;
  };
}

export const COMPOSITION_PATTERNS: CompositionPattern[] = [
  {
    id: "developer-portfolio",
    name: "Developer Portfolio",
    description: "Best for developers with multiple projects and a clear tech stack. Emphasizes projects with bento grid and grouped skills.",
    contentSignals: ["multiple projects", "GitHub", "tech stack", "code", "open source", "programming languages"],
    components: {
      layout: "single",
      nav: "sticky",
      hero: "split",
      sections: [
        { kind: "showcase", variant: "bento" },
        { kind: "skills", variant: "grouped" },
        { kind: "timeline", variant: "vertical" },
        { kind: "cta", variant: "center" },
      ],
      effects: ["reveal"],
      footer: "standard",
    },
  },
  {
    id: "designer-showcase",
    name: "Designer Showcase",
    description: "Visual-first layout for designers, photographers, and creatives. Large imagery with masonry grid and minimal text.",
    contentSignals: ["design", "portfolio", "visual", "photography", "illustration", "creative work", "artwork"],
    components: {
      layout: "single",
      nav: "minimal",
      hero: "landscape",
      sections: [
        { kind: "showcase", variant: "masonry" },
        { kind: "content", variant: "education-cards" },
        { kind: "cta", variant: "center" },
      ],
      effects: ["reveal"],
      footer: "minimal",
    },
  },
  {
    id: "academic-researcher",
    name: "Academic Researcher",
    description: "Structured layout for academics with publications, research, and teaching history. Clean typography with timeline emphasis.",
    contentSignals: ["publications", "research", "PhD", "professor", "university", "academic", "papers", "citations"],
    components: {
      layout: "sidebar",
      nav: "sidebar",
      hero: "sidebar-card",
      sections: [
        { kind: "content", variant: "education-cards" },
        { kind: "timeline", variant: "reveal" },
        { kind: "showcase", variant: "list" },
        { kind: "skills", variant: "chips" },
      ],
      effects: [],
      footer: "minimal",
    },
  },
  {
    id: "executive-resume",
    name: "Executive Resume",
    description: "Professional resume style for senior professionals. Bold hero with experience timeline and achievement highlights.",
    contentSignals: ["leadership", "management", "executive", "director", "VP", "years of experience", "enterprise"],
    components: {
      layout: "single",
      nav: "bold",
      hero: "split",
      sections: [
        { kind: "timeline", variant: "reveal" },
        { kind: "skills", variant: "bars" },
        { kind: "showcase", variant: "showcase" },
        { kind: "content", variant: "education-cards" },
        { kind: "cta", variant: "center" },
      ],
      effects: ["reveal"],
      footer: "bold",
    },
  },
  {
    id: "freelancer-services",
    name: "Freelancer Services",
    description: "Service-oriented layout for freelancers and consultants. Highlights services, testimonials, and contact.",
    contentSignals: ["freelance", "services", "consulting", "clients", "testimonials", "rates", "available for hire"],
    components: {
      layout: "single",
      nav: "sticky",
      hero: "centered",
      sections: [
        { kind: "content", variant: "education-cards" },
        { kind: "proof", variant: "staggered" },
        { kind: "showcase", variant: "grid" },
        { kind: "cta", variant: "flat" },
      ],
      effects: ["reveal"],
      footer: "standard",
    },
  },
  {
    id: "startup-founder",
    name: "Startup Founder",
    description: "Dynamic layout for entrepreneurs. Highlights ventures, achievements, and vision with energetic design.",
    contentSignals: ["startup", "founder", "CEO", "venture", "raised", "team", "product", "launch"],
    components: {
      layout: "single",
      nav: "bold",
      hero: "split-panel",
      sections: [
        { kind: "showcase", variant: "zigzag" },
        { kind: "timeline", variant: "vertical" },
        { kind: "skills", variant: "grouped" },
        { kind: "cta", variant: "center" },
      ],
      effects: ["particles"],
      footer: "bold",
    },
  },
  {
    id: "content-creator",
    name: "Content Creator",
    description: "Blog-style layout for writers, bloggers, and content creators. Readable, editorial typography.",
    contentSignals: ["blog", "writing", "articles", "content", "newsletter", "podcast", "YouTube", "creator"],
    components: {
      layout: "single",
      nav: "blog",
      hero: "editorial",
      sections: [
        { kind: "showcase", variant: "blog-grid" },
        { kind: "proof", variant: "staggered" },
        { kind: "cta", variant: "flat" },
      ],
      effects: [],
      footer: "blog",
    },
  },
  {
    id: "student-graduate",
    name: "Student / New Graduate",
    description: "Clean, energetic layout for students and fresh graduates. Emphasizes education, skills, and potential.",
    contentSignals: ["student", "graduate", "university", "internship", "GPA", "courses", "degree", "learning"],
    components: {
      layout: "single",
      nav: "minimal",
      hero: "minimal",
      sections: [
        { kind: "content", variant: "education-cards" },
        { kind: "skills", variant: "chips" },
        { kind: "showcase", variant: "grid" },
        { kind: "timeline", variant: "compact" },
        { kind: "cta", variant: "center" },
      ],
      effects: ["reveal"],
      footer: "minimal",
    },
  },
  {
    id: "creative-artist",
    name: "Creative Artist",
    description: "Expressive, non-conventional layout for artists. Asymmetric design with gallery focus and artistic flair.",
    contentSignals: ["art", "exhibition", "gallery", "painting", "sculpture", "installation", "museum", "studio"],
    components: {
      layout: "single",
      nav: "mini",
      hero: "landscape",
      sections: [
        { kind: "gallery", variant: "masonry" },
        { kind: "timeline", variant: "reveal" },
        { kind: "cta", variant: "center" },
      ],
      effects: ["reveal"],
      footer: "minimal",
    },
  },
];

/**
 * Format patterns as a concise catalog for Design Agent prompt injection.
 * Returns markdown with pattern names, descriptions, and content signals.
 */
export function getPatternCatalog(): string {
  const lines = COMPOSITION_PATTERNS.map((p) => {
    const sections = p.components.sections
      .map((s) => `${s.kind}/${s.variant}`)
      .join(", ");
    return `- **${p.name}** (${p.id}): ${p.description}\n  Layout: ${p.components.layout} | Hero: ${p.components.hero} | Sections: ${sections}\n  Content signals: ${p.contentSignals.join(", ")}`;
  });

  return `## Recommended Composition Patterns

These are proven component combinations. You may use one as a starting point
and customize, or create an entirely new composition. The key is to match
the user's content and goals — don't force a pattern that doesn't fit.

${lines.join("\n\n")}`;
}
