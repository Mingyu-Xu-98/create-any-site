import type { WorkspaceData, UserSelections, ThemeStyle, LayoutType, FeatureFlags, DesignIntelligence } from "./types";
import type { SiteSpec, SiteSpecSection } from "./site-spec";
import { type LayoutFamily, LAYOUT_FAMILY, type ResolvedStyle } from "./generator-config";
import {
  resolveSelections, getStyleBgMarkup, readSpecValue, getSpecTitle, getSpecName,
  getSectionTitles, getAvailableSections, findSpecSection, readStringArray,
  readProjectItems, readTimelineItems, buildHeroLines,
} from "./generator-utils";
import {
  genPackageJson, genTsConfig, genLayout, genGlobalCSS, genTranslations, genLanguageProvider,
} from "./generator-infrastructure";
import {
  genTypewriterHero, genThemeToggle, genParticleBackground, genGrainOverlay,
  genSharePoster, genChatBot, buildKnowledgeChunks, genChatRoute, genGhibliImageScript,
} from "./generator-shared";
import { assemblePage, buildCompositionPlan, getVisualAssetCSS, getVisualAssetComponents } from "./components";
import type { SectionContext } from "./components/types";
import type { ContentModel } from "./content-model";
import { renderFromContentModel } from "./template-renderer";
import "./templates"; // Register all templates

/**
 * Generate all website file contents as a Record<path, content>.
 * Pure function — no I/O side effects. Used both client-side and server-side.
 */
export function generateFileMap(
  rawData: WorkspaceData,
  selections: UserSelections,
  designIntel?: DesignIntelligence | null,
  spec?: SiteSpec | null,
): Record<string, string> {
  // Sanitize data: ensure all array fields exist to prevent undefined crashes
  const data: WorkspaceData = {
    ...rawData,
    name: rawData.name || "Your Name",
    nameEn: rawData.nameEn || rawData.name || "Your Name",
    title: rawData.title || "",
    titleEn: rawData.titleEn || rawData.title || "",
    email: rawData.email || "",
    location: rawData.location || "",
    locationEn: rawData.locationEn || rawData.location || "",
    bio: rawData.bio || "",
    bioEn: rawData.bioEn || rawData.bio || "",
    bioTags: rawData.bioTags || [],
    bioTagsEn: rawData.bioTagsEn || rawData.bioTags || [],
    skills: Array.isArray(rawData.skills) ? rawData.skills : [],
    skillsEn: Array.isArray(rawData.skillsEn) ? rawData.skillsEn : (Array.isArray(rawData.skills) ? rawData.skills : []),
    projects: Array.isArray(rawData.projects) ? rawData.projects : [],
    projectsEn: Array.isArray(rawData.projectsEn) ? rawData.projectsEn : (Array.isArray(rawData.projects) ? rawData.projects : []),
    timeline: Array.isArray(rawData.timeline) ? rawData.timeline : [],
    timelineEn: Array.isArray(rawData.timelineEn) ? rawData.timelineEn : (Array.isArray(rawData.timeline) ? rawData.timeline : []),
    education: Array.isArray(rawData.education) ? rawData.education : [],
    educationEn: Array.isArray(rawData.educationEn) ? rawData.educationEn : (Array.isArray(rawData.education) ? rawData.education : []),
    tags: Array.isArray(rawData.tags) ? rawData.tags : [],
    tagsEn: Array.isArray(rawData.tagsEn) ? rawData.tagsEn : (Array.isArray(rawData.tags) ? rawData.tags : []),
    links: Array.isArray(rawData.links) ? rawData.links : [],
    visibleSections: Array.isArray(rawData.visibleSections) ? rawData.visibleSections : ["about"],
    chatbotContext: rawData.chatbotContext || "",
  };

  const { theme, layout } = resolveSelections(selections);
  const features = selections.features;
  const files: Record<string, string> = {};

  // Resolve recipe — this is the primary design token source
  const { getRecipe, mergeRecipes } = require("./recipes/loader") as typeof import("./recipes/loader");
  const recipeId = (selections as any).recipe || theme;
  const baseRecipe = getRecipe(recipeId) || getRecipe("custom")!;
  const recipeLayers: Partial<import("./recipes/loader").DesignRecipe>[] = [];
  const layerIds = (selections as any).recipeLayers;
  if (Array.isArray(layerIds)) {
    for (const lid of layerIds) {
      const l = getRecipe(lid);
      if (l) recipeLayers.push(l);
    }
  }
  // Apply DI color overrides as a layer
  if (designIntel) {
    const diLayer: Partial<import("./recipes/loader").DesignRecipe> = {};
    const c = (designIntel as any).colorOverrides as Record<string, string> | undefined;
    if (c && Object.keys(c).length > 0) diLayer.colors = c;
    const t = designIntel.typography;
    if (t?.bodyFont || t?.headingFont) {
      diLayer.typography = {
        heading: t?.headingFont || "",
        body: t?.bodyFont || "",
        mono: "",
        scaleRatio: 0,
        import: t?.cssImport || undefined,
      };
    }
    if (Object.keys(diLayer).length > 0) recipeLayers.push(diLayer);
  }
  const agentOverrides = (selections as any).recipeOverrides;
  if (agentOverrides) recipeLayers.push(agentOverrides);
  const resolvedRecipe = mergeRecipes(baseRecipe, ...recipeLayers);

  // Derive ResolvedStyle from recipe (for backward compat with functions still expecting it)
  const { recipeToResolvedStyle } = require("./generator-config") as typeof import("./generator-config");
  const styleConfig = recipeToResolvedStyle(resolvedRecipe);

  files["package.json"] = genPackageJson();
  files["next.config.ts"] = `import type { NextConfig } from "next";\nconst nextConfig: NextConfig = {};\nexport default nextConfig;\n`;
  files["tsconfig.json"] = genTsConfig();
  files["postcss.config.mjs"] = `const config = { plugins: { "@tailwindcss/postcss": {} } };\nexport default config;\n`;
  files[".gitignore"] = "node_modules/\n.next/\n.env.local\n.DS_Store\n";

  // Build a custom-note header if user provided custom descriptions
  const customNotes: string[] = [];
  if (selections.siteType === "custom" && selections.customSiteType) customNotes.push(`Site type: ${selections.customSiteType}`);
  if (selections.layout === "custom" && selections.customLayout) customNotes.push(`Layout: ${selections.customLayout}`);
  if (selections.theme === "custom" && selections.customTheme) customNotes.push(`Theme: ${selections.customTheme}`);
  if (designIntel?.style?.category) customNotes.push(`Design Intelligence: ${designIntel.style.category}`);
  const customHeader = customNotes.length > 0
    ? `/* ==== DESIGN CONTEXT ====\n${customNotes.map(n => ` * ${n}`).join("\n")}\n * ======================== */\n\n`
    : "";

  files["src/app/layout.tsx"] = genLayout(data, theme, features, styleConfig, spec, resolvedRecipe);
  files["src/app/globals.css"] = customHeader + genGlobalCSS(theme, layout, features, styleConfig, resolvedRecipe);

  // Inject visual asset CSS if a CompositionPlan with visualDirection exists
  const activePlan = selections.compositionPlan;
  if (activePlan?.visualDirection) {
    const assetCSS = getVisualAssetCSS(activePlan);
    if (assetCSS) files["src/app/globals.css"] += "\n\n/* === Visual Assets === */\n" + assetCSS;
    // Also generate any extra component files from assets
    const assetComponents = getVisualAssetComponents(activePlan);
    for (const [path, code] of Object.entries(assetComponents)) {
      files[path] = code as string;
    }
  }

  // ===== Page generation: multi-page aware =====
  const ctx: SectionContext = { data, spec, theme, layout, styleConfig, features, recipe: resolvedRecipe };

  // Helper: build a CompositionPlan from SiteSpec sections
  function sectionsToPage(sections: Array<{ id?: string; kind?: string; type?: string; variant?: string; data?: Record<string, unknown>; enabled?: boolean }>, navStyle = "sticky", footerStyle = "standard"): import("./components/types").CompositionPlan {
    const filtered = sections.filter(s => s.enabled !== false && s.id);
    const heroSection = filtered.find(s => s.kind === "hero");
    return {
      layout: "single",
      nav: navStyle,
      hero: heroSection?.variant || "centered",
      sections: filtered.filter(s => s.kind !== "hero").map(s => ({
        id: s.id!,
        kind: (s.kind || "content") as import("./components/types").SectionKind,
        type: s.type,
        variant: s.variant,
        data: s.data,
      })),
      effects: [],
      footer: footerStyle,
    };
  }

  // Path 1: Agent provided a full CompositionPlan
  const agentPlan = selections.compositionPlan;
  if (agentPlan) {
    files["src/app/page.tsx"] = assemblePage(agentPlan, ctx);
  }
  // Path 2: Spec has pages[] — generate per-page route files
  else if (spec?.pages && spec.pages.length > 0) {
    const navStyle = spec.navigation?.style || "sticky";
    for (const page of spec.pages) {
      const pagePlan = sectionsToPage(page.sections, navStyle);
      const route = page.route === "/" ? "" : page.route.replace(/^\//, "");
      const filePath = route ? `src/app/${route}/page.tsx` : "src/app/page.tsx";
      files[filePath] = assemblePage(pagePlan, ctx);
    }
  }
  // Path 3: Spec has kind-aware sections (flat, single page)
  else if (spec?.sections?.some(s => s.kind)) {
    files["src/app/page.tsx"] = assemblePage(sectionsToPage(spec.sections || []), ctx);
  }
  // Path 4: Fallback from theme/layout mapping
  else {
    const fallbackPlan = buildCompositionPlan(theme, layout, getAvailableSections(data, spec), spec);
    const assembled = assemblePage(fallbackPlan, ctx);
    if (assembled.includes("section") || assembled.includes("className")) {
      files["src/app/page.tsx"] = assembled;
    } else {
      files["src/app/page.tsx"] = genPage(data, layout, theme, features);
    }
  }
  files["src/app/not-found.tsx"] = `export default function NotFound() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <h1>404 - Page Not Found</h1>
    </div>
  );
}
`;
  files["src/i18n/translations.ts"] = genTranslations(data, spec);
  files["src/components/LanguageProvider.tsx"] = genLanguageProvider();

  files["src/components/ChatBot.tsx"] = genChatBot();
  files["src/app/api/chat/route.ts"] = genChatRoute(data);
  files["src/components/SharePoster.tsx"] = genSharePoster();

  // Dynamic knowledge base for AI chatbot
  files["src/data/knowledge.json"] = JSON.stringify(
    buildKnowledgeChunks(data, spec),
    null,
    2,
  );
  files["src/data/site-spec.json"] = JSON.stringify(spec || {}, null, 2);

  // Style-specific extra components
  if (theme === "cyberpunk") {
    files["src/components/ParticleBackground.tsx"] = genParticleBackground();
  }
  if (theme === "retro") {
    files["src/components/GrainOverlay.tsx"] = genGrainOverlay();
  }
  if (theme === "ghibli") {
    files["scripts/generate-images.mjs"] = genGhibliImageScript(data);
  }

  // SiliconFlow API key for chatbot (all themes) and image generation (ghibli)
  files[".env.local"] = `SILICONFLOW_API_KEY=sk-tiucfyagykltjzwgnkyzgxkrzkomwwfrauhvepzserdjtupv\n`;

  files["public/images/README.txt"] = "Place your project images and avatar.png here.\n";

  return files;
}

// ---- File generators ----

function genThemeShowcaseHero(theme: ThemeStyle, sectionClass = ""): string {
  const themeClassMap: Partial<Record<ThemeStyle, string>> = {
    cyberpunk: "theme-hero-cyberpunk",
    cinematic: "theme-hero-cinematic",
    retro: "theme-hero-retro",
    nature: "theme-hero-nature",
    "gradient-mesh": "theme-hero-gradient-mesh",
    "neo-tokyo": "theme-hero-neo-tokyo",
  };

  const themeHeroClass = themeClassMap[theme] || "theme-hero-default";
  const visual = theme === "cyberpunk"
    ? `
            <div className="showcase-terminal">
              <div className="showcase-terminal-bar">
                <span />
                <span />
                <span />
              </div>
              <div className="showcase-terminal-body">
                {t.hero.lines.slice(0, 4).map((line) => (
                  <div key={line} className="showcase-terminal-line">{line}</div>
                ))}
              </div>
            </div>`
    : theme === "cinematic"
      ? `
            <div className="showcase-poster-frame">
              <div className="showcase-poster-noise" />
              <div className="showcase-poster-label">Scene 01</div>
              <div className="showcase-poster-title">{t.hero.lines[0]?.replace("> ", "") || t.ui.heyIm}</div>
              <div className="showcase-poster-subtitle">{t.hero.lines[1]?.replace("> ", "") || ""}</div>
            </div>`
      : theme === "retro"
        ? `
            <div className="showcase-retro-stack">
              <div className="showcase-retro-card">
                <div className="showcase-retro-sticker">{t.hero.tags[0] || "Now"}</div>
                <div className="showcase-retro-initials">{t.hero.lines[0]?.replace("> ", "").slice(0, 2)}</div>
              </div>
              <div className="showcase-retro-shadow" />
            </div>`
        : theme === "nature"
          ? `
            <div className="showcase-nature-panel">
              <div className="showcase-nature-sun" />
              <div className="showcase-nature-hill hill-1" />
              <div className="showcase-nature-hill hill-2" />
              <div className="showcase-nature-copy">{t.about.tags.slice(0, 3).join(" · ")}</div>
            </div>`
          : theme === "neo-tokyo"
            ? `
            <div className="showcase-tokyo-panel">
              <div className="showcase-tokyo-grid" />
              <div className="showcase-tokyo-copy">
                <span className="showcase-tokyo-kicker">// signal</span>
                <strong>{t.hero.lines[0]?.replace("> ", "") || t.ui.heyIm}</strong>
                <span>{t.hero.lines[1]?.replace("> ", "") || ""}</span>
              </div>
            </div>`
            : `
            <div className="showcase-orbital-panel">
              <div className="showcase-orbital-ring ring-1" />
              <div className="showcase-orbital-ring ring-2" />
              <div className="showcase-orbital-core">{t.hero.tags[0] || "AI"}</div>
            </div>`;

  return `
        <section className="max-w-[1100px] mx-auto px-6 pt-20 pb-14${sectionClass ? ` ${sectionClass}` : ""}">
          <div className="showcase-hero ${themeHeroClass}">
            <div className="showcase-copy">
              <span className="showcase-kicker">{t.ui.availableForHire}</span>
              <h1 className="showcase-title">{t.hero.lines[0]?.replace("> ", "") || t.ui.heyIm}</h1>
              <p className="showcase-subtitle">{t.hero.lines[1]?.replace("> ", "") || t.about.text}</p>
              <div className="showcase-actions">
                <a href="#projects" className="showcase-btn showcase-btn-primary">{t.nav.projects}</a>
                <a href="#contact" className="showcase-btn showcase-btn-secondary">{t.nav.contact}</a>
              </div>
              <div className="showcase-tag-row">
                {t.hero.tags.slice(0, 4).map((tag) => (<span key={tag} className="badge">{tag}</span>))}
              </div>
            </div>
            <div className="showcase-visual">
              ${visual}
            </div>
          </div>
        </section>`;
}

function genSidebarThemePanel(theme: ThemeStyle): string {
  if (theme === "cyberpunk") {
    return `
            <div className="sidebar-theme-panel sidebar-panel-cyberpunk">
              <div className="sidebar-signal" />
              <div className="sidebar-code-line" />
              <div className="sidebar-code-line short" />
              <div className="sidebar-code-line" />
            </div>`;
  }
  if (theme === "nature") {
    return `
            <div className="sidebar-theme-panel sidebar-panel-nature">
              <div className="sidebar-leaf leaf-1" />
              <div className="sidebar-leaf leaf-2" />
              <div className="sidebar-hill" />
            </div>`;
  }
  if (theme === "retro") {
    return `
            <div className="sidebar-theme-panel sidebar-panel-retro">
              <div className="sidebar-retro-stamp">ARCHIVE</div>
            </div>`;
  }
  if (theme === "neo-tokyo") {
    return `
            <div className="sidebar-theme-panel sidebar-panel-tokyo">
              <div className="sidebar-tokyo-grid" />
              <span className="sidebar-tokyo-label">signal://live</span>
            </div>`;
  }
  return `
            <div className="sidebar-theme-panel sidebar-panel-default">
              <div className="sidebar-orbit" />
            </div>`;
}

function genSplitThemePanel(theme: ThemeStyle): string {
  if (theme === "cinematic") {
    return `
          <div className="split-theme-panel split-panel-cinematic">
            <div className="split-frame-line top" />
            <div className="split-frame-line bottom" />
            <span className="split-scene-label">Scene 01</span>
          </div>`;
  }
  if (theme === "gradient-mesh" || theme === "glassmorphism") {
    return `
          <div className="split-theme-panel split-panel-orbital">
            <div className="split-orb orb-a" />
            <div className="split-orb orb-b" />
            <div className="split-orb orb-c" />
          </div>`;
  }
  if (theme === "cyberpunk" || theme === "neo-tokyo") {
    return `
          <div className="split-theme-panel split-panel-grid">
            <div className="split-grid-scan" />
          </div>`;
  }
  return `
          <div className="split-theme-panel split-panel-default">
            <div className="split-panel-crest" />
          </div>`;
}

function genPage(data: WorkspaceData, layout: LayoutType, theme: ThemeStyle, features: FeatureFlags): string {
  // Theme-specific page generators
  if (theme === "tpl-resume-bold") return genBoldResumePage(data, features);
  if (theme === "ghibli") return genGhibliPage(data, features);
  if (theme === "minimalist") return genMinimalistPage(data, features);
  if (theme === "brutalist") return genBrutalistPage(data, features);
  if (theme === "glassmorphism") return genGlassmorphismPage(data, features);
  if (theme === "tpl-blog") return genBlogPage(data, features);

  const family = LAYOUT_FAMILY[layout] || "single";
  switch (family) {
    case "sidebar": return genSidebarPage(data, layout, theme, features);
    case "split":   return genSplitPage(data, theme, features);
    case "grid":    return genGridPage(data, layout, theme, features);
    case "single":
    default:        return genSingleColumnPage(data, layout, theme, features);
  }
}

/**
 * Dedicated page generator for tpl-resume-bold theme.
 * Produces the specific layout from the bold resume template:
 * nav → hero (2-col with avatar frame + floating tags) → marquee → experience → skills → projects → education → contact → footer
 */
function genBoldResumePage(data: WorkspaceData, features: FeatureFlags): string {
  const imports = [
    `"use client";`,
    `import { useEffect, useRef } from "react";`,
    `import { useLanguage } from "@/components/LanguageProvider";`,
    `import Image from "next/image";`,
    `import ChatBot from "@/components/ChatBot";`,
    `import SharePoster from "@/components/SharePoster";`,
  ].filter(Boolean).join("\n");

  // Build marquee items from skills
  const allSkills = data.skills.flatMap(g => g.skills).slice(0, 10);
  const marqueeItems = allSkills.map(s => `<span>${s}</span><span className="sep">/</span>`).join("\n              ");

  // Build floating tags (top 3 skill categories or tags)
  const floatingTags = data.tags.slice(0, 3);

  // Build initials for avatar fallback
  const initials = (data.nameEn || data.name).split(/\\s+/).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return `${imports}

export default function Home() {
  const { lang, t, toggle } = useLanguage();
  const revealRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          // Animate skill bars
          entry.target.querySelectorAll<HTMLElement>(".skill-bar-fill").forEach(bar => {
            if (bar.dataset.width) bar.style.width = bar.dataset.width;
          });
        }
      });
    }, { threshold: 0.15 });
    revealRef.current?.querySelectorAll(".bold-reveal").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen relative bg-bg text-text" ref={revealRef}>
      {/* Background Shapes */}
      <div className="bold-resume-bg"><div className="shape shape-1" /><div className="shape shape-2" /><div className="shape shape-3" /></div>

      {/* Navigation */}
      <nav className="bold-nav">
        <div className="logo">{lang === "zh" ? "${data.name}" : "${data.nameEn || data.name}"}</div>
        <ul className="nav-links">
          {t.availableSections.filter(s => s !== "about").map((id) => (
            <li key={id}><a href={\`#\${id === "timeline" ? "experience" : id}\`}>{t.sections[id as keyof typeof t.sections] || id}</a></li>
          ))}
          <li><button onClick={toggle}>{lang === "zh" ? "EN" : "\\u4e2d"}</button></li>
        </ul>
      </nav>

      {/* Main */}
      <main className="relative z-[1] max-w-[1100px] mx-auto px-6 pt-[100px] pb-[60px]">

        {/* Hero */}
        <section className="bold-hero">
          <div className="bold-hero-text">
            <span className="bold-hero-label">// {t.ui.availableForHire}</span>
            <h1>{t.ui.heyIm}</h1>
            <p className="bold-hero-subtitle">
              {lang === "zh" ? "${data.title}" : "${data.titleEn || data.title}"}
            </p>
            <div className="flex gap-4 flex-wrap">
              <a href="#contact" className="btn-bold btn-bold-primary">{t.nav.contact}</a>
              <a href="#projects" className="btn-bold btn-bold-outline">{t.nav.projects}</a>
            </div>
          </div>
          <div className="bold-hero-visual">
            <div className="avatar-frame">
              <Image src="/images/avatar.png" alt="" width={340} height={340} className="avatar-frame-img" style={{width:"100%",height:"100%",objectFit:"cover"}} unoptimized onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }} />
              <span className="avatar-text hidden">${initials}</span>
              <div className="floating-tag tag-1">${floatingTags[0] || data.tags[0] || ""}</div>
              <div className="floating-tag tag-2">${floatingTags[1] || data.tags[1] || ""}</div>
              <div className="floating-tag tag-3">${floatingTags[2] || data.tags[2] || ""}</div>
            </div>
          </div>
        </section>

        {/* Marquee */}
        <div className="bold-marquee-wrapper">
          <div className="bold-marquee">
            ${marqueeItems}
            ${marqueeItems}
          </div>
        </div>

        {/* About */}
        <section id="about" className="bold-reveal mb-20">
          <div className="bold-section-header">
            <span className="bold-section-number">00</span>
            <h2 className="bold-section-title">{t.sections.about}</h2>
          </div>
          <div className="card p-6">
            <p className="text-text-muted leading-relaxed mb-4">{t.about.text}</p>
            <div className="flex flex-wrap gap-2">
              {t.about.tags.map((tag) => (<span key={tag} className="badge">{tag}</span>))}
            </div>
          </div>
        </section>

        {/* Experience */}
        {t.timeline.length > 0 && (
        <section id="experience" className="bold-reveal mb-20">
          <div className="bold-section-header">
            <span className="bold-section-number">01</span>
            <h2 className="bold-section-title">{t.sections.timeline}</h2>
          </div>
          <div className="bold-timeline">
            {t.timeline.map((item, i) => (
              <div key={i} className="exp-card">
                <span className="exp-card-year">{item.date}</span>
                <div className="exp-role">{item.title}</div>
                <p className="exp-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Skills */}
        {t.skills.length > 0 && (
        <section id="skills" className="bold-reveal mb-20">
          <div className="bold-section-header">
            <span className="bold-section-number">02</span>
            <h2 className="bold-section-title">{t.sections.skills}</h2>
          </div>
          <div className="bold-skills-grid">
            {t.skills.map((group, i) => (
              <div key={i} className="skill-card">
                <h3>{group.title}</h3>
                <ul className="skill-list">
                  {group.skills.map((s) => (<li key={s}>{s}</li>))}
                </ul>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Projects */}
        {t.projects.length > 0 && (
        <section id="projects" className="bold-reveal mb-20">
          <div className="bold-section-header">
            <span className="bold-section-number">03</span>
            <h2 className="bold-section-title">{t.sections.projects}</h2>
          </div>
          <div className="bold-projects-grid">
            {t.projects.map((p, i) => (
              <div key={i} className="project-card">
                <div className="project-preview">
                  {p.title.slice(0, 6)}
                  <div className="pattern" />
                </div>
                <div className="project-info">
                  <h3>{p.title}</h3>
                  <p>{p.desc}</p>
                  <div className="exp-tags">
                    {p.tags.map((tag) => (<span key={tag} className="exp-tag">{tag}</span>))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Education */}
        {t.education.length > 0 && (
        <section id="education" className="bold-reveal mb-20">
          <div className="bold-section-header">
            <span className="bold-section-number">04</span>
            <h2 className="bold-section-title">{t.sections.education}</h2>
          </div>
          <div className="space-y-6">
            {t.education.map((edu, i) => (
              <div key={i} className="edu-card">
                <div className="edu-icon">{edu.school.slice(0, 2)}</div>
                <div className="edu-info">
                  <h3>{edu.degree}</h3>
                  <div className="edu-school">{edu.school}</div>
                  <div className="edu-detail">{edu.highlights.join(" | ")}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Contact */}
        <section id="contact" className="bold-contact bold-reveal">
          <h2>{t.ui.letsCollaborate}</h2>
          <p>{t.ui.openForOpportunities}</p>
          <div className="bold-contact-links">
            <a href="mailto:${data.email}" className="contact-chip">${data.email}</a>
            ${data.github ? `<a href="${data.github}" target="_blank" className="contact-chip">GitHub</a>` : ""}
            ${data.linkedin ? `<a href="${data.linkedin}" target="_blank" className="contact-chip">LinkedIn</a>` : ""}
            ${data.location ? `<span className="contact-chip">{lang === "zh" ? "${data.location}" : "${data.locationEn || data.location}"}</span>` : ""}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bold-footer">
        <p>{t.footer}</p>
      </footer>

      <SharePoster />
      <ChatBot />
    </div>
  );
}
`;
}

/**
 * Dedicated page generator for the Blog (暖调书卷) theme.
 * Warm earthy tones, serif headings, grain overlay, hero with avatar,
 * about, skills tags, projects grid, experience timeline, education, contact.
 */
function genBlogPage(data: WorkspaceData, features: FeatureFlags): string {
  const initials = (data.nameEn || data.name).split(/\s+/).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return `"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useLanguage } from "@/components/LanguageProvider";
import ChatBot from "@/components/ChatBot";
import SharePoster from "@/components/SharePoster";

export default function Home() {
  const { lang, t, toggle } = useLanguage();
  const [dark, setDark] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (saved === "dark" || (!saved && prefersDark)) setDark(true);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });
    mainRef.current?.querySelectorAll(".blog-reveal").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={mainRef} className="min-h-screen">
      {/* Grain Overlay */}
      <div className="blog-grain" />

      {/* Navigation */}
      <nav className={\`blog-nav\${navScrolled ? " scrolled" : ""}\`}>
        <div className="blog-nav-inner">
          <span className="blog-nav-brand">{lang === "zh" ? "${data.name}" : "${data.nameEn || data.name}"}</span>
          <ul className="blog-nav-links">
            {t.availableSections.filter(s => s !== "contact").map((id) => (
              <li key={id}><a href={\`#\${id === "timeline" ? "experience" : id}\`}>{t.sections[id as keyof typeof t.sections] || id}</a></li>
            ))}
            <li><a href="#contact">{t.nav.contact}</a></li>
            <li><button onClick={toggle}>{lang === "zh" ? "EN" : "\\u4e2d"}</button></li>
            <li>
              <button className="blog-theme-toggle" onClick={() => setDark(!dark)} aria-label="Toggle theme">
                {dark ? "\\u2600" : "\\u263e"}
              </button>
            </li>
          </ul>
        </div>
      </nav>

      {/* Hero */}
      <section className="blog-hero">
        <div className="blog-hero-avatar-wrap blog-reveal">
          <div className="blog-hero-avatar">
            <Image src="/images/avatar.png" alt="" width={200} height={200} className="w-full h-full object-cover" unoptimized onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }} />
            <div className="avatar-placeholder hidden">${initials}</div>
          </div>
        </div>
        <div className="blog-hero-info">
          <div className="blog-hero-hello blog-reveal">// {t.ui.welcomeToSite}</div>
          <h1 className="blog-hero-name blog-reveal blog-reveal-d1">{lang === "zh" ? "${data.name}" : "${data.nameEn || data.name}"}</h1>
          <p className="blog-hero-tagline blog-reveal blog-reveal-d2">{lang === "zh" ? "${data.title}" : "${data.titleEn || data.title}"}</p>
          <p className="blog-hero-bio blog-reveal blog-reveal-d3">{t.about.text}</p>
          <div className="blog-hero-socials blog-reveal blog-reveal-d4">
            ${data.email ? `<a href="mailto:${data.email}" className="blog-social-btn" title="Email">{"\\u2709"}</a>` : ""}
            ${data.github ? `<a href="${data.github}" target="_blank" className="blog-social-btn" title="GitHub"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg></a>` : ""}
            ${data.linkedin ? `<a href="${data.linkedin}" target="_blank" className="blog-social-btn" title="LinkedIn"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>` : ""}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="blog-section" id="about">
        <div className="blog-section-header blog-reveal">
          <div className="blog-section-label">About</div>
          <h2 className="blog-section-title">{t.sections.about}</h2>
          <div className="blog-section-line" />
        </div>
        <div className="blog-about blog-reveal blog-reveal-d1">{t.about.text}</div>
        <div className="blog-skills-wrap" style={{marginTop: 24}}>
          {t.about.tags.map((tag) => (<span key={tag} className="blog-skill-tag blog-reveal blog-reveal-d2">{tag}</span>))}
        </div>
      </section>

      {/* Skills */}
      {t.skills.length > 0 && (
      <section className="blog-section-alt" id="skills">
        <div style={{maxWidth: 1120, margin: "0 auto"}}>
          <div className="blog-section-header blog-reveal">
            <div className="blog-section-label">Skills</div>
            <h2 className="blog-section-title">{t.sections.skills}</h2>
            <div className="blog-section-line" />
          </div>
          <div className="blog-skills-wrap">
            {t.skills.flatMap(g => g.skills).map((s, i) => (
              <span key={s} className={\`blog-skill-tag blog-reveal blog-reveal-d\${(i % 4) + 1}\`}>{s}</span>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Projects */}
      {t.projects.length > 0 && (
      <section className="blog-section" id="projects">
        <div className="blog-section-header blog-reveal">
          <div className="blog-section-label">Projects</div>
          <h2 className="blog-section-title">{t.sections.projects}</h2>
          <div className="blog-section-line" />
        </div>
        <div className="blog-projects-grid">
          {t.projects.map((p, i) => (
            <div key={i} className={\`blog-project-card blog-reveal blog-reveal-d\${(i % 3) + 1}\`}>
              <div className="blog-project-icon">{p.title.slice(0, 1)}</div>
              <h3 className="blog-project-name">{p.title}</h3>
              <p className="blog-project-desc">{p.desc}</p>
              <div className="blog-project-tech">
                {p.tags.map((tag) => (<span key={tag}>{tag}</span>))}
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* Experience */}
      {t.timeline.length > 0 && (
      <section className="blog-section-alt" id="experience">
        <div style={{maxWidth: 1120, margin: "0 auto"}}>
          <div className="blog-section-header blog-reveal">
            <div className="blog-section-label">Experience</div>
            <h2 className="blog-section-title">{t.sections.timeline}</h2>
            <div className="blog-section-line" />
          </div>
          <div className="blog-timeline">
            {t.timeline.map((item, i) => (
              <div key={i} className={\`blog-timeline-item blog-reveal blog-reveal-d\${(i % 3) + 1}\`}>
                <div className="blog-timeline-period">{item.date}</div>
                <div className="blog-timeline-role">{item.title}</div>
                <div className="blog-timeline-desc">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Education */}
      {t.education.length > 0 && (
      <section className="blog-section" id="education">
        <div className="blog-section-header blog-reveal">
          <div className="blog-section-label">Education</div>
          <h2 className="blog-section-title">{t.sections.education}</h2>
          <div className="blog-section-line" />
        </div>
        <div>
          {t.education.map((edu, i) => (
            <div key={i} className={\`blog-edu-card blog-reveal blog-reveal-d\${(i % 3) + 1}\`}>
              <div className="blog-edu-icon">{edu.school.slice(0, 2)}</div>
              <div className="blog-edu-info">
                <h3>{edu.degree}</h3>
                <div className="blog-edu-school">{edu.school}</div>
                <div className="blog-edu-detail">{edu.highlights.join(" | ")}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* Contact */}
      <section className="blog-section" id="contact">
        <div className="blog-section-header blog-reveal">
          <div className="blog-section-label">Contact</div>
          <h2 className="blog-section-title">{t.sections.contact || t.nav.contact}</h2>
          <div className="blog-section-line" />
        </div>
        <div className="blog-contact-box blog-reveal blog-reveal-d1">
          <p>{t.ui.openForOpportunities}</p>
          ${data.email ? `<a href="mailto:${data.email}" className="blog-contact-btn">{"\\u2709 "}${data.email}</a>` : ""}
        </div>
      </section>

      {/* Footer */}
      <footer className="blog-footer">
        <div className="blog-footer-inner">
          <div className="blog-footer-copy">{t.footer}</div>
        </div>
      </footer>

      <SharePoster />
      <ChatBot />
    </div>
  );
}
`;
}

/**
 * Dedicated page generator for the Minimalist theme.
 * Reference design: sticky nav, large hero, stats cards, about, experience timeline, project cards, skills, education.
 */
function genMinimalistPage(data: WorkspaceData, features: FeatureFlags): string {
  // Compute stats from data
  const projectCount = data.projects.length;
  const skillCount = data.skills.reduce((acc, g) => acc + g.skills.length, 0);
  const timelineCount = data.timeline.length;
  const eduCount = data.education.length;

  return `"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useLanguage } from "@/components/LanguageProvider";
import ChatBot from "@/components/ChatBot";
import SharePoster from "@/components/SharePoster";

export default function Home() {
  const { lang, t, toggle } = useLanguage();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (saved === "dark" || (!saved && prefersDark)) setDark(true);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <>
      {/* ===== STICKY NAVIGATION ===== */}
      <nav className="mini-nav">
        <span className="mini-nav-logo">{lang === "zh" ? "${data.name}" : "${data.nameEn}"}</span>
        <ul className="mini-nav-links">
          {t.availableSections.filter(s => s !== "contact").map((id) => (
            <li key={id}><a href={\`#\${id === "timeline" ? "experience" : id}\`}>{t.sections[id as keyof typeof t.sections] || id}</a></li>
          ))}
          <li><button onClick={toggle} className="text-xs border border-line rounded-full px-2.5 py-1 hover:border-text transition-colors">{lang === "zh" ? "EN" : "\\u4e2d"}</button></li>
          <li>
            <button onClick={() => setDark(!dark)} className="mini-theme-toggle" aria-label="Toggle theme">
              {dark ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
          </li>
        </ul>
      </nav>

      {/* Hero aurora background */}
      <div className="mini-hero-bg" />

      {/* ===== HERO SECTION ===== */}
      <section className="mini-hero">
        <div className="relative w-20 h-20 mx-auto mb-5">
          <Image src="/images/avatar.png" alt="" width={80} height={80} className="w-full h-full rounded-full object-cover border-2 border-line shadow-md" unoptimized />
        </div>
        <div className="mini-hero-badge">
          <span className="dot" />
          <span>{t.ui.welcomeToSite}</span>
        </div>
        <h1>{lang === "zh" ? "${data.name}" : "${data.nameEn}"}</h1>
        <p className="subtitle">{lang === "zh" ? "${data.title}" : "${data.titleEn}"}</p>
        <p className="text-sm text-text-muted max-w-lg mx-auto leading-relaxed">{t.about.text}</p>
        <div className="mini-hero-buttons">
          ${data.github ? `<a href="${data.github}" target="_blank" className="mini-btn-primary">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </a>` : ""}
          <a href="mailto:${data.email}" className="mini-btn-secondary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            {t.ui.contactMe}
          </a>
        </div>
        <div className="mini-scroll-indicator">
          <span>{t.ui.scrollDown}</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
        </div>
      </section>

      {/* ===== STATS CARDS ===== */}
      <div className="mini-stats">
        <div className="mini-stat-card">
          <div className="mini-stat-value">${projectCount}</div>
          <div className="mini-stat-label">{t.ui.statLabels.projects}</div>
        </div>
        <div className="mini-stat-card">
          <div className="mini-stat-value">${skillCount}</div>
          <div className="mini-stat-label">{t.ui.statLabels.skills}</div>
        </div>
        <div className="mini-stat-card">
          <div className="mini-stat-value">${timelineCount}</div>
          <div className="mini-stat-label">{t.ui.statLabels.experiences}</div>
        </div>
        <div className="mini-stat-card">
          <div className="mini-stat-value">${eduCount}</div>
          <div className="mini-stat-label">{t.ui.statLabels.education}</div>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <main className="mini-main">

        {/* About Section */}
        <section id="about" className="mb-16">
          <h2 className="section-heading">{t.sections.about}</h2>
          <p className="mini-section-subtitle">{t.ui.sectionSubtitles.about}</p>
          <div className="mini-about">
            <div>
              <p className="mini-about-text">{t.about.text}</p>
              <div className="mini-about-tags">
                {t.about.tags.map((tag) => (<span key={tag} className="mini-badge">{tag}</span>))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-text-muted">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <span>{lang === "zh" ? "${data.location}" : "${data.locationEn}"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-text-muted">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                <span>${data.email}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {t.hero.tags.slice(0, 6).map((tag) => (<span key={tag} className="mini-badge">{tag}</span>))}
              </div>
            </div>
          </div>
        </section>

        {/* Experience / Timeline Section */}
        {t.timeline.length > 0 && (
        <section id="experience" className="mb-16">
          <h2 className="section-heading">{t.sections.timeline}</h2>
          <p className="mini-section-subtitle">{t.ui.sectionSubtitles.timeline}</p>
          <div className="mini-timeline">
            {t.timeline.map((item) => (
              <div key={item.title} className="mini-timeline-card">
                <div className="mini-timeline-header">
                  <h3 className="mini-timeline-title">{item.title}</h3>
                  <span className="mini-timeline-date">{item.date}</span>
                </div>
                <p className="mini-timeline-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Projects Section */}
        {t.projects.length > 0 && (
        <section id="projects" className="mb-16">
          <h2 className="section-heading">{t.sections.projects}</h2>
          <p className="mini-section-subtitle">{t.ui.sectionSubtitles.projects}</p>
          <div className="mini-projects-grid">
            {t.projects.map((p) => (
              <div key={p.title} className="mini-project-card">
                <div className="mini-project-image">
                  <Image src={p.image} alt={p.title} fill className="object-cover" unoptimized />
                </div>
                <div className="mini-project-body">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <h3 className="mini-project-title">{p.title}</h3>
                      <p className="mini-project-org">{p.org}</p>
                    </div>
                    {p.link && <a href={p.link} target="_blank" className="text-xs text-text-muted hover:text-text transition-colors shrink-0">GitHub &rarr;</a>}
                  </div>
                  <p className="mini-project-desc line-clamp-2">{p.desc}</p>
                  <div className="mini-project-tags">
                    {p.tags.slice(0, 4).map((tag) => (<span key={tag} className="mini-project-tag">{tag}</span>))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Skills Section */}
        {t.skills.length > 0 && (
        <section id="skills" className="mb-16">
          <h2 className="section-heading">{t.sections.skills}</h2>
          <p className="mini-section-subtitle">{t.ui.sectionSubtitles.skills}</p>
          <div className="mini-skills-grid">
            {t.skills.map((group) => (
              <div key={group.title} className="mini-skill-card">
                <h3 className="mini-skill-title">{group.title}</h3>
                <div className="mini-skill-tags">
                  {group.skills.map((s) => (<span key={s} className="mini-badge">{s}</span>))}
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Education Section */}
        {t.education.length > 0 && (
        <section id="education" className="mb-16">
          <h2 className="section-heading">{t.sections.education}</h2>
          <div className="mini-edu-grid">
            {t.education.map((edu) => (
              <div key={edu.school} className="mini-edu-card">
                <h3 className="font-bold text-sm text-text">{edu.school}</h3>
                <p className="text-xs text-text-muted mt-1">{edu.degree}</p>
                <ul className="mt-3 space-y-1.5">
                  {edu.highlights.map((h) => (
                    <li key={h} className="text-xs text-text-muted flex items-start gap-2">
                      <span className="text-text mt-0.5">&#8226;</span>{h}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Footer */}
        <footer className="mini-footer">{t.footer}</footer>
      </main>

      <SharePoster />
      <ChatBot />
    </>
  );
}
`;
}

/**
 * Dedicated page generator for the Ghibli theme.
 * Warm parchment aesthetic with top nav, landscape banner, polaroid-style about section.
 */
function genGhibliPage(data: WorkspaceData, features: FeatureFlags): string {
  return `"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useLanguage } from "@/components/LanguageProvider";
import ChatBot from "@/components/ChatBot";
import SharePoster from "@/components/SharePoster";

export default function Home() {
  const { lang, t, toggle } = useLanguage();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ghibli-dark");
    if (saved !== null) {
      setDark(saved === "1");
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setDark(true);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("ghibli-dark", dark ? "1" : "0");
  }, [dark]);

  return (
    <>
      {/* ===== TOP NAVIGATION ===== */}
      <nav className="ghibli-topnav">
        <div className="ghibli-topnav-inner">
          <a href="#" className="ghibli-logo-badge">{lang === "zh" ? "${data.name}" : "${data.nameEn}"}</a>
          <div className="ghibli-topnav-links">
            {t.availableSections.filter(s => s !== "contact").map((id) => (
              <a key={id} href={\`#\${id}\`} className="ghibli-topnav-link">{t.sections[id as keyof typeof t.sections] || id}</a>
            ))}
            <button onClick={() => setDark(!dark)} className="ghibli-theme-toggle" title="Toggle theme">
              {dark ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
            <button onClick={toggle} className="ghibli-theme-toggle" title="Toggle language" style={{fontSize: "0.75rem", fontWeight: 600}}>
              {lang === "zh" ? "EN" : "\\u4e2d"}
            </button>
          </div>
        </div>
      </nav>

      {/* ===== GHIBLI LANDSCAPE BANNER ===== */}
      <div className="ghibli-landscape" />

      {/* ===== MAIN CONTENT ===== */}
      <div className="ghibli-content">
        {/* About Me Section */}
        <section id="about" className="ghibli-about-section">
          <div className="ghibli-about-text">
            <h2>{t.sections.about}</h2>
            <p>{lang === "zh" ? "${data.title}" : "${data.titleEn}"}</p>
            <p>{t.about.text}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {t.about.tags.map((tag) => (<span key={tag} className="ghibli-badge">{tag}</span>))}
            </div>
            <div className="flex items-center gap-3 mt-4">
              ${data.github ? `<a href="${data.github}" target="_blank" className="contact-icon">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
              </a>` : ""}
              <a href="mailto:${data.email}" className="contact-icon">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </a>
              ${data.linkedin ? `<a href="${data.linkedin}" target="_blank" className="contact-icon">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
              </a>` : ""}
            </div>
          </div>
          <div className="ghibli-polaroid-stack">
            <div className="ghibli-polaroid">
              <Image src="/images/avatar.png" alt="" width={175} height={155} className="w-full" style={{height: 155, objectFit: "cover"}} unoptimized />
            </div>
            <div className="ghibli-polaroid">
              <Image src="/images/ghibli-background.png" alt="" width={175} height={155} className="w-full" style={{height: 155, objectFit: "cover"}} unoptimized />
            </div>
          </div>
        </section>

        {/* Projects */}
        {t.projects.length > 0 && (
        <section id="projects" className="mb-12">
          <h2 className="section-heading">{t.sections.projects}</h2>
          <div className="ghibli-projects-grid">
            {t.projects.map((p) => (
              <div key={p.title} className="parchment-card">
                <div className="relative h-36 overflow-hidden">
                  <Image src={p.image} alt={p.title} fill className="object-cover" unoptimized />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h3 className="font-bold text-sm text-text">{p.title}</h3>
                      <p className="text-xs text-text-muted">{p.org}</p>
                    </div>
                    {p.badge && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">{p.badge}</span>}
                    {p.link && <a href={p.link} target="_blank" className="text-xs text-accent hover:underline">GitHub &rarr;</a>}
                  </div>
                  <p className="text-xs text-text-muted mt-2 leading-relaxed line-clamp-2">{p.desc}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.tags.slice(0, 3).map((tag) => (<span key={tag} className="ghibli-badge text-[11px]">{tag}</span>))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Timeline */}
        {t.timeline.length > 0 && (
        <section id="timeline" className="mb-12">
          <h2 className="section-heading">{t.sections.timeline}</h2>
          <div className="relative pl-6">
            <div className="timeline-line" />
            <div className="space-y-5">
              {t.timeline.map((item) => (
                <div key={item.title} className="relative flex gap-4">
                  <div className={\`timeline-dot \${item.active ? "timeline-dot-active" : ""}\`} />
                  <div className="parchment-card flex-1 p-4">
                    <span className="text-xs font-semibold text-accent">{item.date}</span>
                    <h3 className="font-bold text-sm text-text mt-1">{item.title}</h3>
                    <p className="text-xs text-text-muted mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        )}

        {/* Skills */}
        {t.skills.length > 0 && (
        <section id="skills" className="mb-12">
          <h2 className="section-heading">{t.sections.skills}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {t.skills.map((group) => (
              <div key={group.title} className="parchment-card p-4">
                <h3 className="font-bold text-sm text-text mb-3">{group.title}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {group.skills.map((s) => (<span key={s} className="ghibli-badge">{s}</span>))}
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Education */}
        {t.education.length > 0 && (
        <section id="education" className="mb-12">
          <h2 className="section-heading">{t.sections.education}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {t.education.map((edu) => (
              <div key={edu.school} className="parchment-card p-5">
                <h3 className="font-bold text-sm text-text">{edu.school}</h3>
                <p className="text-xs text-text-muted mt-1">{edu.degree}</p>
                <ul className="mt-3 space-y-1.5">
                  {edu.highlights.map((h) => (
                    <li key={h} className="text-xs text-text-muted flex items-start gap-2">
                      <span className="text-accent mt-0.5">&#8226;</span>{h}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-text-muted py-8 border-t border-line">{t.footer}</footer>
      </div>

      <SharePoster />
      <ChatBot />
    </>
  );
}
`;
}

/**
 * Dedicated page generator for the Brutalist theme.
 * Dark coder-style: centered hero, clean typography, date+title project list.
 */
function genBrutalistPage(data: WorkspaceData, features: FeatureFlags): string {
  return `"use client";

import Image from "next/image";
import { useLanguage } from "@/components/LanguageProvider";
import ChatBot from "@/components/ChatBot";
import SharePoster from "@/components/SharePoster";

export default function Home() {
  const { lang, t } = useLanguage();

  return (
    <>
      {/* ===== TOP NAVIGATION ===== */}
      <nav className="brutal-topnav">
        <div className="brutal-topnav-inner">
          <a href="#" className="brutal-logo">{lang === "zh" ? "${data.name}" : "${data.nameEn}"}</a>
          <div className="brutal-nav-links">
            {t.availableSections.filter(s => s !== "contact").map((id) => (
              <a key={id} href={\`#\${id}\`} className="brutal-nav-link">{t.sections[id as keyof typeof t.sections] || id}</a>
            ))}
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <header className="brutal-hero">
        <div className="brutal-avatar">
          <Image src="/images/avatar.png" alt="" width={160} height={160} unoptimized />
        </div>
        <h1>{lang === "zh" ? "${data.name}" : "${data.nameEn}"}</h1>
        <p className="brutal-hero-subtitle">{lang === "zh" ? "${data.title}" : "${data.titleEn}"}</p>
        <p className="brutal-hero-subtitle">{lang === "zh" ? "${data.location}" : "${data.locationEn}"}</p>
        <div className="brutal-social">
          ${data.github ? `<a href="${data.github}" target="_blank" title="GitHub">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
          </a>` : ""}
          ${data.linkedin ? `<a href="${data.linkedin}" target="_blank" title="LinkedIn">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
          </a>` : ""}
          <a href="mailto:${data.email}" title="Email">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </a>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <div className="brutal-content">
        {/* About */}
        <section id="about" className="mb-12 brutal-about">
          <h2 className="brutal-section-heading">{t.sections.about}</h2>
          <p>{t.about.text}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {t.about.tags.map((tag) => (<span key={tag} className="badge">{tag}</span>))}
          </div>
        </section>

        {/* Projects */}
        {t.projects.length > 0 && (
        <section id="projects" className="mb-12">
          <h2 className="brutal-section-heading">{t.sections.projects}</h2>
          <div className="brutal-project-list">
            {t.projects.map((p) => (
              <div key={p.title} className="brutal-project-item">
                <span className="brutal-project-date">{p.org}</span>
                <div>
                  <span className="brutal-project-title">
                    {p.link ? <a href={p.link} target="_blank">{p.title}</a> : p.title}
                  </span>
                  {p.badge && <span className="ml-2 text-[11px] text-accent">[{p.badge}]</span>}
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Timeline */}
        {t.timeline.length > 0 && (
        <section id="timeline" className="mb-12">
          <h2 className="brutal-section-heading">{t.sections.timeline}</h2>
          <div>
            {t.timeline.map((item) => (
              <div key={item.title} className="brutal-timeline-item">
                <span className="brutal-timeline-date">{item.date}</span>
                <div className="brutal-timeline-text">
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Skills & Education side by side */}
        {(t.skills.length > 0 || t.education.length > 0) && (
        <div className="brutal-two-col mb-12">
          {t.skills.length > 0 && (
          <section id="skills">
            <h2 className="brutal-section-heading">{t.sections.skills}</h2>
            {t.skills.map((group) => (
              <div key={group.title} className="brutal-col mb-4">
                <h3>{group.title}</h3>
                <ul>
                  {group.skills.map((s) => (<li key={s}>{s}</li>))}
                </ul>
              </div>
            ))}
          </section>
          )}
          {t.education.length > 0 && (
          <section id="education">
            <h2 className="brutal-section-heading">{t.sections.education}</h2>
            {t.education.map((edu) => (
              <div key={edu.school} className="brutal-col mb-4">
                <h3>{edu.school}</h3>
                <p className="text-xs text-text-muted mb-1">{edu.degree}</p>
                <ul>
                  {edu.highlights.map((h) => (<li key={h}>{h}</li>))}
                </ul>
              </div>
            ))}
          </section>
          )}
        </div>
        )}

        {/* Footer */}
        <footer className="brutal-footer">{t.footer}</footer>
      </div>

      <SharePoster />
      <ChatBot />
    </>
  );
}
`;
}

/**
 * Dedicated page generator for the Glassmorphism theme.
 * Cosmic sidebar navigation page with deep space gradient, glass cards,
 * neon hero heading, contribution grid, project/skill cards.
 */
function genGlassmorphismPage(data: WorkspaceData, features: FeatureFlags): string {
  return `"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { useLanguage } from "@/components/LanguageProvider";
import ChatBot from "@/components/ChatBot";
import SharePoster from "@/components/SharePoster";

export default function Home() {
  const { lang, t, toggle } = useLanguage();

  const contribGrid = useMemo(() => {
    const seed = 42;
    const cells: number[] = [];
    let s = seed;
    for (let i = 0; i < 52 * 7; i++) {
      s = (s * 16807 + 0) % 2147483647;
      const r = s / 2147483647;
      cells.push(r < 0.35 ? 0 : r < 0.55 ? 1 : r < 0.75 ? 2 : r < 0.9 ? 3 : 4);
    }
    return cells;
  }, []);

  return (
    <>
      <div className="glass-bg"><div className="blob blob-1" /><div className="blob blob-2" /><div className="blob blob-3" /><div className="blob blob-4" /></div>

      <div className="gm-layout">
        {/* ===== SIDEBAR ===== */}
        <aside className="gm-sidebar">
          {/* Avatar Card */}
          <div className="gm-card gm-avatar-wrap">
            <div className="gm-avatar-ring">
              <div className="gm-avatar-glow" />
              <Image src="/images/avatar.png" alt="" width={100} height={100} unoptimized />
            </div>
            <div className="gm-sidebar-name">{lang === "zh" ? "${data.name}" : "${data.nameEn}"}</div>
            <div className="gm-sidebar-title">{lang === "zh" ? "${data.title}" : "${data.titleEn}"}</div>
          </div>

          {/* Info Card */}
          <div className="gm-card">
            ${data.location ? `<div className="gm-info-row">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              <span>${data.location}</span>
            </div>` : ""}
            <div className="gm-info-row">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <span>{lang === "zh" ? "${data.title}" : "${data.titleEn}"}</span>
            </div>
            <div className="gm-info-row">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <span>${data.email}</span>
            </div>
          </div>

          {/* Tags Card */}
          <div className="gm-card">
            <div className="gm-tag-wrap">
              {t.hero.tags.map((tag) => (<span key={tag} className="gm-tag">{tag}</span>))}
            </div>
          </div>

          {/* Mini Timeline Card */}
          {t.timeline.length > 0 && (
          <div className="gm-card">
            <div className="gm-mini-timeline">
              {t.timeline.slice(0, 4).map((item, i) => (
                <div key={i} className="gm-mini-item">
                  <div className={\`gm-mini-dot \${i === 0 ? "active" : ""}\`} />
                  <div className="gm-mini-label">
                    <strong>{item.title}</strong>
                    <span>{item.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Language Toggle */}
          <button onClick={toggle} className="gm-lang-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
            {lang === "zh" ? "English" : "\\u4e2d\\u6587"}
          </button>
        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <main className="gm-main">
          {/* Hero */}
          <section className="gm-hero" id="about">
            <h1 className="gm-hero-heading">
              {lang === "zh" ? "Hello \\u6211\\u662f " : "Hello I'm "}
              <span className="gm-neon-name">{lang === "zh" ? "${data.name}" : "${data.nameEn}"}</span>
            </h1>
            <p className="gm-hero-bio">{t.about.text}</p>
            <div className="gm-about-tags">
              {t.about.tags.map((tag) => (<span key={tag} className="gm-about-tag">{tag}</span>))}
            </div>
          </section>

          {/* Social Icons */}
          <div className="gm-social-row">
            ${data.github ? `<a href="${data.github}" target="_blank" rel="noopener noreferrer" className="gm-social-icon" title="GitHub">
              <svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            </a>` : ""}
            <a href="mailto:${data.email}" className="gm-social-icon" title="Email">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </a>
            ${data.linkedin ? `<a href="${data.linkedin}" target="_blank" rel="noopener noreferrer" className="gm-social-icon" title="LinkedIn">
              <svg fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>` : ""}
          </div>

          {/* Contribution Grid */}
          <div className="gm-contrib-section gm-card">
            <div className="gm-contrib-label">{lang === "zh" ? "\\u6d3b\\u8dc3\\u5ea6" : "Activity"}</div>
            <div className="gm-contrib-grid">
              {contribGrid.map((level, i) => (
                <div key={i} className={\`gm-contrib-cell gm-contrib-\${level}\`} />
              ))}
            </div>
          </div>

          {/* Projects */}
          {t.projects.length > 0 && (
          <section id="projects" style={{ marginBottom: 36 }}>
            <h2 className="gm-section-heading">{t.sections.projects}</h2>
            <div className="gm-projects-grid">
              {t.projects.map((p, i) => (
                <div key={i} className="gm-project-card">
                  <div className="gm-project-name">{p.title}</div>
                  <div className="gm-project-desc">{p.desc}</div>
                  <div className="gm-project-tech">
                    {p.tags.map((tag) => (<span key={tag}>{tag}</span>))}
                  </div>
                </div>
              ))}
            </div>
          </section>
          )}

          {/* Skills */}
          {t.skills.length > 0 && (
          <section id="skills" style={{ marginBottom: 36 }}>
            <h2 className="gm-section-heading">{t.sections.skills}</h2>
            <div className="gm-skills-grid">
              {t.skills.flatMap((group) => group.skills).map((s) => (
                <div key={s} className="gm-skill-chip">{s}</div>
              ))}
            </div>
          </section>
          )}

          {/* Education */}
          {t.education.length > 0 && (
          <section id="education" style={{ marginBottom: 36 }}>
            <h2 className="gm-section-heading">{t.sections.education}</h2>
            <div className="gm-edu-grid">
              {t.education.map((edu, i) => (
                <div key={i} className="gm-edu-card">
                  <div className="gm-edu-school">{edu.school}</div>
                  <div className="gm-edu-degree">{edu.degree}</div>
                </div>
              ))}
            </div>
          </section>
          )}

          {/* Footer */}
          <footer className="gm-footer">{t.footer}</footer>
        </main>
      </div>

      <SharePoster />
      <ChatBot />
    </>
  );
}
`;
}

function genSingleColumnPage(data: WorkspaceData, layout: LayoutType, theme: ThemeStyle, features: FeatureFlags): string {
  const needsUseEffect = layout === "interactive";
  const reactHooks: string[] = ["useState"];
  if (needsUseEffect) reactHooks.push("useEffect", "useRef");
  const reactImport = reactHooks.length > 0 ? `import { ${reactHooks.join(", ")} } from "react";` : "";

  const imports = [
    `"use client";`,
    reactImport,
    `import { useLanguage } from "@/components/LanguageProvider";`,
    `import Image from "next/image";`,
    `import ChatBot from "@/components/ChatBot";`,
    `import SharePoster from "@/components/SharePoster";`,
    theme === "cyberpunk" ? `import ParticleBackground from "@/components/ParticleBackground";` : "",
    theme === "retro" ? `import GrainOverlay from "@/components/GrainOverlay";` : "",
  ].filter(Boolean).join("\n");
  const wrapClass = layout === "f-shape" ? "f-layout" : "";
  const sectionClass = layout === "interactive" ? "scroll-section" : "";

  const styleBg = getStyleBgMarkup(theme);

  // --- Navbar variations ---
  let navbar: string;
  if (layout === "hidden-nav") {
    navbar = `
        {/* Hidden Nav */}
        <div className="fixed top-4 right-4 z-50">
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="text-sm text-text-muted hover:text-text px-3 py-1.5 rounded-full border border-line bg-bg/80 backdrop-blur-xl transition-colors">
              {lang === "zh" ? "EN" : "\\u4e2d"}
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="hamburger bg-bg/80 backdrop-blur-xl rounded-full border border-line">
              <span /><span /><span />
            </button>
          </div>
        </div>
        <div className={\`mobile-menu \${menuOpen ? "open" : ""}\`}>
          {t.availableSections.filter(s => s !== "about" && s !== "contact").map((id) => (
            <a key={id} href={\`#\${id}\`} onClick={() => setMenuOpen(false)}>{t.sections[id as keyof typeof t.sections] || id}</a>
          ))}
        </div>`;
  } else if (layout === "fixed-nav") {
    navbar = `
        {/* Fixed Navigation */}
        <nav className="fixed-top-nav">
          <ul>
            <li><span className="font-bold text-text">{lang === "zh" ? "${data.name}" : "${data.nameEn}"}</span></li>
            <li className="flex-1" />
            {t.availableSections.filter(s => s !== "about" && s !== "contact").map((id) => (
              <li key={id}><a href={\`#\${id}\`}>{t.sections[id as keyof typeof t.sections] || id}</a></li>
            ))}
            <li>
              <button onClick={toggle} className="text-sm text-text-muted hover:text-accent px-3 py-1 rounded-full border border-line transition-colors">
                {lang === "zh" ? "EN" : "\\u4e2d"}
              </button>
            </li>
          </ul>
        </nav>`;
  } else {
    navbar = `
        {/* Navbar */}
        <nav className="sticky top-0 z-50 bg-bg/80 backdrop-blur-xl border-b border-line">
          <div className="max-w-[1100px] mx-auto px-6 h-16 flex items-center justify-between">
            <span className="font-bold text-lg">{lang === "zh" ? "${data.name}" : "${data.nameEn}"}</span>
            <div className="hidden md:flex items-center gap-6">
              {t.availableSections.filter(s => s !== "about" && s !== "contact").map((id) => (
                <a key={id} href={\`#\${id}\`} className="text-sm text-text-muted hover:text-text transition-colors">{t.sections[id as keyof typeof t.sections] || id}</a>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggle} className="text-sm text-text-muted hover:text-text px-3 py-1.5 rounded-full border border-line transition-colors">
                {lang === "zh" ? "EN" : "\\u4e2d"}
              </button>
              </div>
          </div>
        </nav>`;
  }

  // --- Hero variations ---
  let hero: string;
  if (layout === "hero-media") {
    hero = `
        {/* Hero Media */}
        <section className="hero-media">
          <div className="hero-media-overlay" />
          <div className="hero-media-content">
            <div className="relative w-[140px] h-[140px] mx-auto mb-6">
              <div className="avatar-glow" />
              <div className="w-[140px] h-[140px] rounded-full overflow-hidden relative z-10 border-2 border-line">
                <Image src="/images/avatar.png" alt="" width={140} height={140} className="w-full h-full object-cover" unoptimized />
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-3">{lang === "zh" ? "${data.name}" : "${data.nameEn}"}</h1>
            <p className="text-xl text-text-muted">{lang === "zh" ? "${data.title}" : "${data.titleEn}"}</p>
            <div className="flex flex-wrap justify-center gap-2 mt-8">
              {t.hero.tags.map((tag) => (<span key={tag} className="badge">{tag}</span>))}
            </div>
          </div>
        </section>`;
  } else {
    hero = genThemeShowcaseHero(theme, sectionClass);
  }

  // --- About section ---
  const about = `
        {/* About */}
        <section id="about" className="max-w-[1100px] mx-auto px-6 py-16${sectionClass ? ` ${sectionClass}` : ""}">
          <h2 className="section-heading">{t.sections.about}</h2>
          <div className="card p-6">
            <p className="text-text-muted leading-relaxed mb-4">{t.about.text}</p>
            <div className="flex flex-wrap gap-2">
              {t.about.tags.map((tag) => (<span key={tag} className="badge">{tag}</span>))}
            </div>
          </div>
        </section>`;

  // --- Projects section variations ---
  let projects: string;
  if (layout === "z-shape") {
    projects = `
        {/* Projects – Z-Shape */}
        {t.projects.length > 0 && (
        <section id="projects" className="px-6 py-16${sectionClass ? ` ${sectionClass}` : ""}">
          <h2 className="section-heading">{t.sections.projects}</h2>
          <div className="space-y-16">
            {t.projects.map((p, i) => (
              <div key={i} className="zigzag-section">
                <div className="zigzag-inner">
                  <div className="card overflow-hidden">
                    {p.image && <div className="w-full h-48 bg-bg-card"><Image src={p.image} alt={p.title} width={600} height={300} className="w-full h-full object-cover" unoptimized /></div>}
                    <div className="p-6">
                      <h3 className="font-semibold text-lg mb-1">{p.title}</h3>
                      <p className="text-xs text-text-muted">{p.org}</p>
                      <p className="text-sm text-text-muted mt-3 leading-relaxed">{p.desc}</p>
                      <div className="flex flex-wrap gap-1.5 mt-4">
                        {p.tags.map((tag) => (<span key={tag} className="badge text-xs">{tag}</span>))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    {"badge" in p && p.badge && (
                      <span className="text-sm bg-green/15 text-green px-4 py-1.5 rounded-full font-medium">{p.badge}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}`;
  } else {
    projects = `
        {/* Projects */}
        {t.projects.length > 0 && (
        <section id="projects" className="max-w-[1100px] mx-auto px-6 py-16${sectionClass ? ` ${sectionClass}` : ""}">
          <h2 className="section-heading">{t.sections.projects}</h2>
          <div className="grid md:grid-cols-2 gap-5">
            {t.projects.map((p, i) => (
              <div key={i} className="card overflow-hidden cursor-pointer group" onClick={() => setExpandedProject(expandedProject === i ? null : i)}>
                {p.image && <div className="w-full h-40 bg-bg-card overflow-hidden"><Image src={p.image} alt={p.title} width={600} height={300} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" unoptimized /></div>}
                <div className="relative z-10 p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-base">{p.title}</h3>
                      <p className="text-xs text-text-muted mt-0.5">{p.org}</p>
                    </div>
                    {"badge" in p && p.badge && (
                      <span className="text-xs bg-green/15 text-green px-2.5 py-0.5 rounded-full font-medium">{p.badge}</span>
                    )}
                  </div>
                  <p className={\`text-sm text-text-muted mb-3 leading-relaxed \${expandedProject === i ? "" : "line-clamp-3"}\`}>{p.desc}</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {p.tags.map((tag) => (<span key={tag} className="badge text-xs">{tag}</span>))}
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-line">
                    {p.link ? (
                      <a href={p.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-accent hover:underline">{lang === "zh" ? "查看项目 →" : "View project →"}</a>
                    ) : <span />}
                    <span className="text-xs text-text-muted">{expandedProject === i ? (lang === "zh" ? "收起" : "Collapse") : (lang === "zh" ? "展开详情" : "Read more")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}`;
  }

  // --- Interactive scroll observer ---
  const scrollScript = layout === "interactive" ? `
  const sectionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); });
    }, { threshold: 0.1 });
    sectionsRef.current?.querySelectorAll(".scroll-section").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);` : "";

  const hiddenNavState = layout === "hidden-nav" ? `\n  const [menuOpen, setMenuOpen] = useState(false);` : "";

  return `${imports}

export default function Home() {
  const { lang, t, toggle } = useLanguage();${hiddenNavState}${scrollScript}
  const [expandedProject, setExpandedProject] = useState<number | null>(null);

  return (
    <div className="min-h-screen relative bg-bg text-text theme-divider-${theme}">
      ${styleBg}
      ${layout === "interactive" ? `<div className="parallax-bg" />` : ""}
      <div className="relative z-10${wrapClass ? ` ${wrapClass}` : ""}"${layout === "interactive" ? ` ref={sectionsRef}` : ""}>
        ${navbar}

        ${hero}

        ${about}

        ${projects}

        {/* Timeline */}
        {t.timeline.length > 0 && (
        <section id="timeline" className="max-w-[1100px] mx-auto px-6 py-16${sectionClass ? ` ${sectionClass}` : ""}">
          <h2 className="section-heading">{t.sections.timeline}</h2>
          <div className="${layout === "f-shape" ? "" : "max-w-2xl mx-auto "}relative pl-8">
            <div className="timeline-line" />
            {t.timeline.map((item, i) => (
              <div key={i} className="relative flex gap-6 mb-10 last:mb-0">
                <div className={\`timeline-dot mt-1 \${"active" in item && item.active ? "timeline-dot-active" : ""}\`} />
                <div className="flex-1 pb-2">
                  <span className="text-sm text-accent font-medium">{item.date}</span>
                  <h3 className="text-base font-semibold mt-1">{item.title}</h3>
                  <p className="text-sm text-text-muted mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Skills */}
        {t.skills.length > 0 && (
        <section id="skills" className="max-w-[1100px] mx-auto px-6 py-16${sectionClass ? ` ${sectionClass}` : ""}">
          <h2 className="section-heading">{t.sections.skills}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {t.skills.map((group, i) => (
              <div key={i} className="card p-5">
                <div className="relative z-10">
                  <h3 className="font-semibold text-sm mb-3 text-accent">{group.title}</h3>
                  <div className="flex flex-wrap gap-2">
                    {group.skills.map((s) => (<span key={s} className="badge">{s}</span>))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Education */}
        {t.education.length > 0 && (
        <section id="education" className="max-w-[1100px] mx-auto px-6 py-16${sectionClass ? ` ${sectionClass}` : ""}">
          <h2 className="section-heading">{t.sections.education}</h2>
          <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {t.education.map((edu, i) => (
              <div key={i} className="card p-5">
                <div className="relative z-10">
                  <h3 className="font-semibold text-sm">{edu.school}</h3>
                  <p className="text-xs text-text-muted">{edu.degree}</p>
                  <div className="space-y-2 mt-3">
                    {edu.highlights.map((item) => (
                      <div key={item} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                        <span className="text-sm text-text-muted">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Contact */}
        <section id="contact" className="max-w-[1100px] mx-auto px-6 py-16${sectionClass ? ` ${sectionClass}` : ""}">
          <h2 className="section-heading">{t.sections.contact}</h2>
          <div className="flex justify-center gap-12 flex-wrap">
            <a href="mailto:${data.email}" className="contact-icon">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
              <span className="text-sm font-medium">Email</span>
            </a>
            ${data.github ? `<a href="${data.github}" target="_blank" className="contact-icon">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              <span className="text-sm font-medium">GitHub</span>
            </a>` : ""}
          </div>
        </section>

        <footer className="border-t border-line">
          <div className="max-w-[1100px] mx-auto px-6 py-8 text-center">
            <p className="text-sm text-text-muted">{t.footer}</p>
          </div>
        </footer>
      </div>
      <SharePoster />
      <ChatBot />
    </div>
  );
}
`;
}

function genSidebarPage(data: WorkspaceData, _layout: LayoutType, theme: ThemeStyle, features: FeatureFlags): string {
  const imports = [
    `"use client";`,
    `import Image from "next/image";`,
    `import { useLanguage } from "@/components/LanguageProvider";`,
    `import ChatBot from "@/components/ChatBot";`,
    `import SharePoster from "@/components/SharePoster";`,
    theme === "cyberpunk" ? `import ParticleBackground from "@/components/ParticleBackground";` : "",
    theme === "retro" ? `import GrainOverlay from "@/components/GrainOverlay";` : "",
  ].filter(Boolean).join("\n");

  const styleBg = getStyleBgMarkup(theme);

  return `${imports}

export default function Home() {
  const { lang, t, toggle } = useLanguage();

  return (
    <>${styleBg}
      <div className="two-column-layout">
        <aside className="sidebar-panel">
          <div className="sidebar-card">
            ${genSidebarThemePanel(theme)}
            <div className="relative w-28 h-28 mx-auto mb-5">
              <div className="avatar-glow" />
              <Image src="/images/avatar.png" alt="" width={112} height={112} className="relative z-10 w-full h-full rounded-full object-cover border-3 border-white/60 shadow-lg" unoptimized />
            </div>
            <h1 className="text-xl font-bold text-text mb-1">{lang === "zh" ? "${data.name}" : "${data.nameEn}"}</h1>
            <p className="text-sm text-text-muted mb-5">{lang === "zh" ? "${data.title}" : "${data.titleEn}"}</p>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {t.hero.tags.slice(0, 4).map((tag) => (<span key={tag} className="badge">{tag}</span>))}
            </div>
            <nav className="flex flex-col gap-1 mb-6">
              {t.availableSections.filter(s => s !== "about" && s !== "contact").map((id) => (
                <a key={id} href={\`#\${id}\`} className="sidebar-nav-link">{t.sections[id as keyof typeof t.sections] || id}</a>
              ))}
            </nav>
            <div className="flex justify-center gap-5 mb-5">
              <a href="mailto:${data.email}" className="contact-icon">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </a>
            </div>
            <button onClick={toggle} className="text-xs text-text-muted hover:text-accent border border-line rounded-full px-4 py-1.5 transition-colors">
              {lang === "zh" ? "EN" : "\\u4e2d"}
            </button>
          </div>
        </aside>

        <main className="content-panel theme-divider-${theme}">
          <section id="about" className="mb-14">
            <h2 className="section-heading">{t.sections.about}</h2>
            <div className="card p-6">
              <p className="text-text-muted leading-relaxed mb-4">{t.about.text}</p>
              <div className="flex flex-wrap gap-2">
                {t.about.tags.map((tag) => (<span key={tag} className="badge">{tag}</span>))}
              </div>
            </div>
          </section>

          {t.projects.length > 0 && (
          <section id="projects" className="mb-14">
            <h2 className="section-heading">{t.sections.projects}</h2>
            <div className="grid grid-cols-2 gap-5">
              {t.projects.map((p) => (
                <div key={p.title} className="card overflow-hidden">
                  {p.image && <div className="w-full h-32 bg-bg-card"><Image src={p.image} alt={p.title} width={400} height={200} className="w-full h-full object-cover" unoptimized /></div>}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <h3 className="font-bold text-sm text-text">{p.title}</h3>
                        <p className="text-xs text-text-muted">{p.org}</p>
                      </div>
                      {p.badge && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">{p.badge}</span>}
                    </div>
                    <p className="text-xs text-text-muted mt-2 leading-relaxed line-clamp-3">{p.desc}</p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {p.tags.map((tag) => (<span key={tag} className="badge text-[11px]">{tag}</span>))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          )}

          {t.timeline.length > 0 && (
          <section id="timeline" className="mb-14">
            <h2 className="section-heading">{t.sections.timeline}</h2>
            <div className="relative pl-6">
              <div className="timeline-line" />
              <div className="space-y-6">
                {t.timeline.map((item) => (
                  <div key={item.title} className="relative flex gap-4">
                    <div className={\`timeline-dot \${item.active ? "timeline-dot-active" : ""}\`} />
                    <div className="card flex-1 p-4">
                      <span className="text-xs font-semibold text-accent">{item.date}</span>
                      <h3 className="font-bold text-sm text-text mt-1">{item.title}</h3>
                      <p className="text-xs text-text-muted mt-1">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
          )}

          {t.skills.length > 0 && (
          <section id="skills" className="mb-14">
            <h2 className="section-heading">{t.sections.skills}</h2>
            <div className="grid grid-cols-2 gap-4">
              {t.skills.map((group) => (
                <div key={group.title} className="card p-4">
                  <h3 className="font-bold text-sm text-text mb-3">{group.title}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {group.skills.map((s) => (<span key={s} className="badge">{s}</span>))}
                  </div>
                </div>
              ))}
            </div>
          </section>
          )}

          {t.education.length > 0 && (
          <section id="education" className="mb-14">
            <h2 className="section-heading">{t.sections.education}</h2>
            <div className="grid grid-cols-2 gap-5">
              {t.education.map((edu) => (
                <div key={edu.school} className="card p-5">
                  <h3 className="font-bold text-sm text-text">{edu.school}</h3>
                  <p className="text-xs text-text-muted mt-1">{edu.degree}</p>
                  <ul className="mt-3 space-y-1.5">
                    {edu.highlights.map((h) => (
                      <li key={h} className="text-xs text-text-muted flex items-start gap-2">
                        <span className="text-accent mt-0.5">&#8226;</span>{h}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
          )}

          <footer className="text-center text-xs text-text-muted py-8 border-t border-line">{t.footer}</footer>
        </main>
      </div>
      <SharePoster />
      <ChatBot />
    </>
  );
}
`;
}

function genGridPage(data: WorkspaceData, layout: LayoutType, theme: ThemeStyle, features: FeatureFlags): string {
  const imports = [
    `"use client";`,
    `import { useLanguage } from "@/components/LanguageProvider";`,
    `import Image from "next/image";`,
    `import ChatBot from "@/components/ChatBot";`,
    `import SharePoster from "@/components/SharePoster";`,
    theme === "cyberpunk" ? `import ParticleBackground from "@/components/ParticleBackground";` : "",
    theme === "retro" ? `import GrainOverlay from "@/components/GrainOverlay";` : "",
  ].filter(Boolean).join("\n");

  // Style-specific background
  const styleBg = getStyleBgMarkup(theme);

  // Grid class and item class differ per layout variant
  let gridClass: string;
  let itemClass: string;
  if (layout === "masonry") {
    gridClass = "masonry-grid";
    itemClass = "card p-5";
  } else if (layout === "magazine") {
    gridClass = "magazine-grid";
    itemClass = "card p-5";
  } else {
    // card-grid (bento)
    gridClass = "bento-grid";
    itemClass = 'card p-5';
  }

  const projectItems = layout === "magazine"
    ? `{t.projects.map((p, i) => (
              <div key={i} className={\`card overflow-hidden \${i === 0 ? "magazine-feature" : ""}\`}>
                {p.image && <div className={\`w-full bg-bg-card \${i === 0 ? "h-56" : "h-36"}\`}><Image src={p.image} alt={p.title} width={600} height={300} className="w-full h-full object-cover" unoptimized /></div>}
                <div className="relative z-10 p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-base">{p.title}</h3>
                      <p className="text-xs text-text-muted mt-0.5">{p.org}</p>
                    </div>
                    {"badge" in p && p.badge && (
                      <span className="text-xs bg-green/15 text-green px-2.5 py-0.5 rounded-full font-medium">{p.badge}</span>
                    )}
                  </div>
                  <p className="text-sm text-text-muted mb-3 leading-relaxed">{p.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.tags.map((tag) => (<span key={tag} className="badge text-xs">{tag}</span>))}
                  </div>
                </div>
              </div>
            ))}`
    : layout === "card-grid"
    ? `{t.projects.map((p, i) => (
              <div key={i} className={\`card overflow-hidden \${i === 0 ? "bento-wide" : ""}\`}>
                {p.image && <div className="w-full h-40 bg-bg-card"><Image src={p.image} alt={p.title} width={600} height={300} className="w-full h-full object-cover" unoptimized /></div>}
                <div className="relative z-10 p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-base">{p.title}</h3>
                      <p className="text-xs text-text-muted mt-0.5">{p.org}</p>
                    </div>
                    {"badge" in p && p.badge && (
                      <span className="text-xs bg-green/15 text-green px-2.5 py-0.5 rounded-full font-medium">{p.badge}</span>
                    )}
                  </div>
                  <p className="text-sm text-text-muted mb-3 leading-relaxed line-clamp-3">{p.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.tags.map((tag) => (<span key={tag} className="badge text-xs">{tag}</span>))}
                  </div>
                </div>
              </div>
            ))}`
    : `{t.projects.map((p, i) => (
              <div key={i} className="card overflow-hidden">
                {p.image && <div className="w-full h-40 bg-bg-card"><Image src={p.image} alt={p.title} width={600} height={300} className="w-full h-full object-cover" unoptimized /></div>}
                <div className="relative z-10 p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-base">{p.title}</h3>
                      <p className="text-xs text-text-muted mt-0.5">{p.org}</p>
                    </div>
                    {"badge" in p && p.badge && (
                      <span className="text-xs bg-green/15 text-green px-2.5 py-0.5 rounded-full font-medium">{p.badge}</span>
                    )}
                  </div>
                  <p className="text-sm text-text-muted mb-3 leading-relaxed">{p.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.tags.map((tag) => (<span key={tag} className="badge text-xs">{tag}</span>))}
                  </div>
                </div>
              </div>
            ))}`;

  return `${imports}

export default function Home() {
  const { lang, t, toggle } = useLanguage();

  return (
    <div className="min-h-screen relative bg-bg text-text theme-divider-${theme}">
      ${styleBg}
      <div className="relative z-10">
        <nav className="sticky top-0 z-50 bg-bg/80 backdrop-blur-xl border-b border-line">
          <div className="max-w-[1100px] mx-auto px-6 h-16 flex items-center justify-between">
            <span className="font-bold text-lg">{lang === "zh" ? "${data.name}" : "${data.nameEn}"}</span>
            <div className="hidden md:flex items-center gap-6">
              {t.availableSections.filter(s => s !== "about" && s !== "contact").map((id) => (
                <a key={id} href={\`#\${id}\`} className="text-sm text-text-muted hover:text-text transition-colors">{t.sections[id as keyof typeof t.sections] || id}</a>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggle} className="text-sm text-text-muted hover:text-text px-3 py-1.5 rounded-full border border-line transition-colors">
                {lang === "zh" ? "EN" : "\\u4e2d"}
              </button>
              </div>
          </div>
        </nav>

        ${genThemeShowcaseHero(theme)}

        <section id="about" className="max-w-[1100px] mx-auto px-6 py-16">
          <h2 className="section-heading">{t.sections.about}</h2>
          <div className="card p-6">
            <p className="text-text-muted leading-relaxed mb-4">{t.about.text}</p>
            <div className="flex flex-wrap gap-2">
              {t.about.tags.map((tag) => (<span key={tag} className="badge">{tag}</span>))}
            </div>
          </div>
        </section>

        {t.projects.length > 0 && (
        <section id="projects" className="max-w-[1100px] mx-auto px-6 py-16">
          <h2 className="section-heading">{t.sections.projects}</h2>
          <div className="${gridClass}">
            ${projectItems}
          </div>
        </section>
        )}

        {t.timeline.length > 0 && (
        <section id="timeline" className="max-w-[1100px] mx-auto px-6 py-16">
          <h2 className="section-heading">{t.sections.timeline}</h2>
          <div className="max-w-2xl mx-auto relative pl-8">
            <div className="timeline-line" />
            {t.timeline.map((item, i) => (
              <div key={i} className="relative flex gap-6 mb-10 last:mb-0">
                <div className={\`timeline-dot mt-1 \${"active" in item && item.active ? "timeline-dot-active" : ""}\`} />
                <div className="flex-1 pb-2">
                  <span className="text-sm text-accent font-medium">{item.date}</span>
                  <h3 className="text-base font-semibold mt-1">{item.title}</h3>
                  <p className="text-sm text-text-muted mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {t.skills.length > 0 && (
        <section id="skills" className="max-w-[1100px] mx-auto px-6 py-16">
          <h2 className="section-heading">{t.sections.skills}</h2>
          <div className="${gridClass === "bento-grid" ? "bento-grid" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"}">
            {t.skills.map((group, i) => (
              <div key={i} className="card p-5">
                <div className="relative z-10">
                  <h3 className="font-semibold text-sm mb-3 text-accent">{group.title}</h3>
                  <div className="flex flex-wrap gap-2">
                    {group.skills.map((s) => (<span key={s} className="badge">{s}</span>))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {t.education.length > 0 && (
        <section id="education" className="max-w-[1100px] mx-auto px-6 py-16">
          <h2 className="section-heading">{t.sections.education}</h2>
          <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {t.education.map((edu, i) => (
              <div key={i} className="card p-5">
                <div className="relative z-10">
                  <h3 className="font-semibold text-sm">{edu.school}</h3>
                  <p className="text-xs text-text-muted">{edu.degree}</p>
                  <div className="space-y-2 mt-3">
                    {edu.highlights.map((item) => (
                      <div key={item} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                        <span className="text-sm text-text-muted">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        <section id="contact" className="max-w-[1100px] mx-auto px-6 py-16">
          <h2 className="section-heading">{t.sections.contact}</h2>
          <div className="flex justify-center gap-12 flex-wrap">
            <a href="mailto:${data.email}" className="contact-icon">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
              <span className="text-sm font-medium">Email</span>
            </a>
            ${data.github ? `<a href="${data.github}" target="_blank" className="contact-icon">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              <span className="text-sm font-medium">GitHub</span>
            </a>` : ""}
          </div>
        </section>

        <footer className="border-t border-line">
          <div className="max-w-[1100px] mx-auto px-6 py-8 text-center">
            <p className="text-sm text-text-muted">{t.footer}</p>
          </div>
        </footer>
      </div>
      <SharePoster />
      <ChatBot />
    </div>
  );
}
`;
}

function genSplitPage(data: WorkspaceData, theme: ThemeStyle, features: FeatureFlags): string {
  const imports = [
    `"use client";`,
    `import { useLanguage } from "@/components/LanguageProvider";`,
    `import Image from "next/image";`,
    `import ChatBot from "@/components/ChatBot";`,
    `import SharePoster from "@/components/SharePoster";`,
    theme === "cyberpunk" ? `import ParticleBackground from "@/components/ParticleBackground";` : "",
    theme === "retro" ? `import GrainOverlay from "@/components/GrainOverlay";` : "",
  ].filter(Boolean).join("\n");

  const styleBg = getStyleBgMarkup(theme);

  return `${imports}

export default function Home() {
  const { lang, t, toggle } = useLanguage();

  return (
    <>
      ${styleBg}
      <div className="split-layout theme-divider-${theme}">
        <div className="split-left">
          <div className="text-center">
            ${genSplitThemePanel(theme)}
            <div className="relative w-32 h-32 mx-auto mb-6">
              <div className="avatar-glow" />
              <Image src="/images/avatar.png" alt="" width={128} height={128} className="relative z-10 w-full h-full rounded-full object-cover border-2 border-line" unoptimized />
            </div>
            <h1 className="text-3xl font-bold mb-2">{lang === "zh" ? "${data.name}" : "${data.nameEn}"}</h1>
            <p className="text-text-muted mb-6">{lang === "zh" ? "${data.title}" : "${data.titleEn}"}</p>
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {t.hero.tags.map((tag) => (<span key={tag} className="badge">{tag}</span>))}
            </div>
            <nav className="flex flex-col gap-2 mb-8">
              {t.availableSections.filter(s => s !== "about" && s !== "contact").map((id) => (
                <a key={id} href={\`#\${id}\`} className="text-sm text-text-muted hover:text-accent transition-colors">{t.sections[id as keyof typeof t.sections] || id}</a>
              ))}
            </nav>
            <div className="flex justify-center gap-4 mb-6">
              <a href="mailto:${data.email}" className="contact-icon">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </a>
              ${data.github ? `<a href="${data.github}" target="_blank" className="contact-icon">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              </a>` : ""}
            </div>
            <div className="flex justify-center gap-2">
              <button onClick={toggle} className="text-xs text-text-muted hover:text-accent border border-line rounded-full px-4 py-1.5 transition-colors">
                {lang === "zh" ? "EN" : "\\u4e2d"}
              </button>
              </div>
          </div>
        </div>

        <div className="split-right">
          <section id="about" className="mb-14">
            <h2 className="section-heading">{t.sections.about}</h2>
            <div className="card p-6">
              <p className="text-text-muted leading-relaxed mb-4">{t.about.text}</p>
              <div className="flex flex-wrap gap-2">
                {t.about.tags.map((tag) => (<span key={tag} className="badge">{tag}</span>))}
              </div>
            </div>
          </section>

          {t.projects.length > 0 && (
          <section id="projects" className="mb-14">
            <h2 className="section-heading">{t.sections.projects}</h2>
            <div className="space-y-4">
              {t.projects.map((p, i) => (
                <div key={i} className="card overflow-hidden">
                  {p.image && <div className="w-full h-40 bg-bg-card"><Image src={p.image} alt={p.title} width={600} height={300} className="w-full h-full object-cover" unoptimized /></div>}
                  <div className="relative z-10 p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-base">{p.title}</h3>
                        <p className="text-xs text-text-muted mt-0.5">{p.org}</p>
                      </div>
                      {"badge" in p && p.badge && (
                        <span className="text-xs bg-green/15 text-green px-2.5 py-0.5 rounded-full font-medium">{p.badge}</span>
                      )}
                    </div>
                    <p className="text-sm text-text-muted mb-3 leading-relaxed">{p.desc}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.tags.map((tag) => (<span key={tag} className="badge text-xs">{tag}</span>))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          )}

          {t.timeline.length > 0 && (
          <section id="timeline" className="mb-14">
            <h2 className="section-heading">{t.sections.timeline}</h2>
            <div className="relative pl-6">
              <div className="timeline-line" />
              {t.timeline.map((item, i) => (
                <div key={i} className="relative flex gap-4 mb-8 last:mb-0">
                  <div className={\`timeline-dot mt-1 \${"active" in item && item.active ? "timeline-dot-active" : ""}\`} />
                  <div className="flex-1">
                    <span className="text-sm text-accent font-medium">{item.date}</span>
                    <h3 className="font-semibold mt-1">{item.title}</h3>
                    <p className="text-sm text-text-muted mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          )}

          {t.skills.length > 0 && (
          <section id="skills" className="mb-14">
            <h2 className="section-heading">{t.sections.skills}</h2>
            <div className="grid grid-cols-2 gap-4">
              {t.skills.map((group, i) => (
                <div key={i} className="card p-4">
                  <div className="relative z-10">
                    <h3 className="font-semibold text-sm mb-3 text-accent">{group.title}</h3>
                    <div className="flex flex-wrap gap-2">
                      {group.skills.map((s) => (<span key={s} className="badge">{s}</span>))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          )}

          {t.education.length > 0 && (
          <section id="education" className="mb-14">
            <h2 className="section-heading">{t.sections.education}</h2>
            <div className="space-y-4">
              {t.education.map((edu, i) => (
                <div key={i} className="card p-5">
                  <div className="relative z-10">
                    <h3 className="font-semibold text-sm">{edu.school}</h3>
                    <p className="text-xs text-text-muted">{edu.degree}</p>
                    <div className="space-y-2 mt-3">
                      {edu.highlights.map((item) => (
                        <div key={item} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                          <span className="text-sm text-text-muted">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          )}

          <footer className="text-center text-sm text-text-muted py-8 border-t border-line">{t.footer}</footer>
        </div>
      </div>
      <SharePoster />
      <ChatBot />
    </>
  );
}
`;
}

// ---- Default mode: ContentModel → Template ----

/**
 * Generate site files from a ContentModel using the template renderer.
 * This is the new default path — simpler, more reliable than the old chain.
 */
export function generateFromContentModel(
  content: ContentModel,
  templateId?: string,
): Record<string, string> {
  return renderFromContentModel(content, templateId);
}

// ---- Re-exports for external use ----
export { buildCompositionPlan, assemblePage, listVariants, listLayouts } from "./components";
export { renderFromContentModel, autoSelectTemplate, getTemplatesForMode, listTemplateIds } from "./template-renderer";
export type { CompositionPlan, SectionContext } from "./components/types";
export type { ContentModel } from "./content-model";

