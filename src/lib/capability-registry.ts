/**
 * Capability Registry — unified catalog of all skills, tools, generators,
 * crawlers, and AI features available to agents.
 *
 * Agents query the registry to decide which capabilities to activate.
 * The registry does NOT execute — it only describes what's available.
 */

export type CapabilityType = "skill" | "tool" | "generator" | "crawler" | "ai-feature";

export interface Capability {
  id: string;
  type: CapabilityType;
  name: string;
  description: string;          // Agent reads this to decide relevance
  when: string;                 // When this capability is useful
  stage?: string[];             // Which build stages can use it
  requires?: string[];          // npm packages or external services needed
  installable?: boolean;        // Needs user confirmation to install
  cost?: "free" | "api-call";   // Whether it consumes API credits
  installed?: boolean;          // Whether it's currently available
}

// ---- Built-in capabilities (always available) ----

const BUILTIN_CAPABILITIES: Capability[] = [
  // Skills
  {
    id: "brainstorming", type: "skill", name: "Brainstorming",
    description: "Explore directions, clarify goals, generate creative ideas",
    when: "User's intent is unclear or they want to explore options",
    stage: ["ideation"], cost: "free", installed: true,
  },
  {
    id: "write-prd", type: "skill", name: "Write PRD",
    description: "Produce a structured product requirements document",
    when: "Ready to formalize the site plan after ideation",
    stage: ["planning"], cost: "free", installed: true,
  },
  {
    id: "ui-design", type: "skill", name: "UI/UX Design",
    description: "Information architecture, layout decisions, UX patterns, accessibility",
    when: "Deciding page structure, section order, disclosure strategy",
    stage: ["ideation", "planning", "execution"], cost: "free", installed: true,
  },
  {
    id: "style-direction", type: "skill", name: "Style Direction",
    description: "Visual style decisions: colors, typography, mood, theme selection",
    when: "Choosing the visual direction for the site",
    stage: ["ideation", "planning"], cost: "free", installed: true,
  },
  {
    id: "storytelling", type: "skill", name: "Storytelling",
    description: "Narrative flow, progressive disclosure, content hierarchy",
    when: "Site needs a compelling story arc (brand sites, portfolios, landing pages)",
    stage: ["ideation", "planning"], cost: "free", installed: true,
  },

  // Tools
  {
    id: "knowledge-router", type: "tool", name: "Knowledge Router",
    description: "Route knowledge items to specific sections based on useCase and category",
    when: "Knowledge base has items that need to be mapped to site sections",
    stage: ["execution"], cost: "free", installed: true,
  },
  {
    id: "compile-spec", type: "tool", name: "Compile Spec",
    description: "Compile SiteSpec from PRD, knowledge, and design decisions",
    when: "PRD is approved and ready for execution",
    stage: ["execution"], cost: "api-call", installed: true,
  },
  {
    id: "compose-page", type: "tool", name: "Compose Page",
    description: "Assemble page from component library using CompositionPlan",
    when: "Building the actual website files",
    stage: ["execution"], cost: "free", installed: true,
  },
  {
    id: "build-export", type: "tool", name: "Build & Export",
    description: "Run Next.js build and static export",
    when: "Code is generated and ready to compile",
    stage: ["execution"], cost: "free", installed: true,
  },
  {
    id: "validate-output", type: "tool", name: "Validate Output",
    description: "Check build output for errors, broken links, empty sections",
    when: "After build completes, before publishing",
    stage: ["execution"], cost: "free", installed: true,
  },
];

// ---- Installable capabilities (need user confirmation) ----

const INSTALLABLE_CAPABILITIES: Capability[] = [
  {
    id: "web-crawler", type: "crawler", name: "Web Crawler",
    description: "Crawl and analyze reference websites for design inspiration",
    when: "User mentions competitor sites or wants to reference existing designs",
    requires: ["puppeteer"], installable: true, cost: "free", installed: false,
  },
  {
    id: "image-gen", type: "ai-feature", name: "AI Image Generation",
    description: "Generate avatars, hero images, project thumbnails via AI",
    when: "Site needs custom images but user hasn't uploaded any",
    requires: ["SiliconFlow API"], installable: true, cost: "api-call", installed: true,
  },
  {
    id: "screenshot", type: "tool", name: "Screenshot Validator",
    description: "Take screenshots of generated site to verify visual quality",
    when: "After build, to verify the site looks correct",
    requires: ["playwright"], installable: true, cost: "free", installed: false,
  },
  {
    id: "seo-analyzer", type: "tool", name: "SEO Analyzer",
    description: "Analyze generated site for SEO best practices",
    when: "Brand sites and landing pages that need search visibility",
    installable: true, cost: "free", installed: false,
  },
  {
    id: "three-scene", type: "generator", name: "3D Scene Generator",
    description: "Generate Three.js 3D scenes (particles, globe, waves) as backgrounds or sections",
    when: "User wants 3D visual effects or immersive backgrounds",
    requires: ["three", "@react-three/fiber"], installable: true, cost: "free", installed: false,
  },
  {
    id: "lottie-animation", type: "generator", name: "Lottie Animation",
    description: "Add Lottie JSON animations to sections",
    when: "User wants animated illustrations or icons",
    requires: ["@lottiefiles/react-lottie-player"], installable: true, cost: "free", installed: false,
  },
  {
    id: "digital-human", type: "ai-feature", name: "Digital Human",
    description: "Embed AI-powered digital human avatar (HeyGen, D-ID)",
    when: "User wants a virtual presenter or interactive avatar guide",
    requires: ["HeyGen/D-ID API"], installable: true, cost: "api-call", installed: false,
  },
  {
    id: "form-backend", type: "tool", name: "Form Backend",
    description: "Handle contact form submissions with email notifications",
    when: "Site has a contact form that needs to actually work",
    installable: true, cost: "free", installed: false,
  },
];

// ---- Auto-detect installed capabilities from environment ----

function detectInstalled() {
  // Check environment for API keys / feature flags
  if (process.env.SILICONFLOW_API_KEY) {
    const cap = INSTALLABLE_CAPABILITIES.find(c => c.id === "image-gen");
    if (cap) cap.installed = true;
  }
  if (process.env.MINERU_API_KEY) {
    const cap = INSTALLABLE_CAPABILITIES.find(c => c.id === "pdf-parser" as string);
    // pdf-parser is not in the list but MinerU is built-in, mark it
  }
  // Feature flags via env
  const enabledFlags = (process.env.ENABLED_CAPABILITIES || "").split(",").map(s => s.trim()).filter(Boolean);
  for (const flag of enabledFlags) {
    const cap = INSTALLABLE_CAPABILITIES.find(c => c.id === flag);
    if (cap) cap.installed = true;
  }
}

detectInstalled();

// ---- Registry API ----

const allCapabilities = [...BUILTIN_CAPABILITIES, ...INSTALLABLE_CAPABILITIES];

/** Get the full capability catalog for agent consumption */
export function getCapabilityCatalog(): Capability[] {
  return allCapabilities;
}

/** Get a compact manifest (id + description + when) for agent context */
export function getCapabilityManifest(): string {
  return allCapabilities.map(c => {
    const status = c.installed ? "✓" : c.installable ? "⬡ installable" : "✗";
    return `[${status}] ${c.id} (${c.type}): ${c.description} — When: ${c.when}`;
  }).join("\n");
}

/** Get only installed/available capabilities */
export function getInstalledCapabilities(): Capability[] {
  return allCapabilities.filter(c => c.installed);
}

/** Get capabilities relevant to a specific stage */
export function getCapabilitiesForStage(stage: string): Capability[] {
  return allCapabilities.filter(c => !c.stage || c.stage.includes(stage));
}

/** Mark a capability as installed */
export function installCapability(id: string): boolean {
  const cap = allCapabilities.find(c => c.id === id);
  if (cap) { cap.installed = true; return true; }
  return false;
}

/** Look up a capability by ID */
export function getCapability(id: string): Capability | undefined {
  return allCapabilities.find(c => c.id === id);
}
