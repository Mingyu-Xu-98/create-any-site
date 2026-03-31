import type { WorkspaceData, ThemeStyle, LayoutType, FeatureFlags } from "./types";
import type { SiteSpec } from "./site-spec";
import { getInstalledNextVersion } from "./next-version";
import { type ResolvedStyle, STYLE_CONFIG, LAYOUT_FAMILY, applyDesignIntelligence } from "./generator-config";
import { getSpecTitle, getSpecName, getSectionTitles, getAvailableSections, findSpecSection, readStringArray, readProjectItems, readTimelineItems, buildHeroLines } from "./generator-utils";

export function genPackageJson(): string {
  const nextVersion = getInstalledNextVersion();
  return JSON.stringify({
    name: "my-resume",
    version: "1.0.0",
    type: "module",
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: {
      "@tailwindcss/postcss": "^4.2.1",
      "@types/node": "^25.4.0",
      "@types/react": "^19.2.14",
      dijkstrajs: "^1.0.3",
      next: nextVersion,
      postcss: "^8.5.8",
      pngjs: "^7.0.0",
      react: "^19.2.4",
      "react-dom": "^19.2.4",
      qrcode: "^1.5.4",
      "@types/qrcode": "^1.5.5",
      tailwindcss: "^4.2.1",
      typescript: "^5.9.3",
    },
  }, null, 2);
}

export function genTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2017", lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true, skipLibCheck: true, strict: true, noEmit: true,
      esModuleInterop: true, module: "esnext", moduleResolution: "bundler",
      resolveJsonModule: true, isolatedModules: true, jsx: "preserve",
      incremental: true, plugins: [{ name: "next" }],
      paths: { "@/*": ["./src/*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  }, null, 2);
}

export function genLayout(data: WorkspaceData, theme: ThemeStyle, features: FeatureFlags, resolved?: ResolvedStyle, spec?: SiteSpec | null): string {
  const bgThemes = ["ghibli", "nature", "cinematic"];
  const bodyClassMap: Partial<Record<ThemeStyle, string>> = { ghibli: "ghibli-bg", nature: "nature-bg", cinematic: "cinematic-page-bg" };
  const bodyClass = bgThemes.includes(theme) ? (bodyClassMap[theme] || "") : "";
  const darkScript = "";

  // External fonts - prefer design intelligence fonts, fall back to defaults
  let fontLinks = "";
  if (resolved?.fontImport) {
    // Design intelligence provided a CSS @import, convert to <link> for <head>
    // Extract the URL from: @import url('...');
    const urlMatch = resolved.fontImport.match(/url\(['"]?([^'"]+)['"]?\)/);
    if (urlMatch) {
      fontLinks = `\n        <link href="${urlMatch[1]}" rel="stylesheet" />`;
    }
  }
  if (!fontLinks) {
    const fontMap: Partial<Record<ThemeStyle, string>> = {
      brutalist: "https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&display=swap",
      cyberpunk: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap",
      ghibli: "https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;700&display=swap",
      glassmorphism: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&display=swap",
      minimalist: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
      cinematic: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=Playfair+Display:wght@300;400;700&display=swap",
      retro: "https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap",
      "bold-creative": "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;900&display=swap",
      editorial: "https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap",
      nature: "https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700&display=swap",
      "gradient-mesh": "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap",
      "neo-tokyo": "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500&display=swap",
      "tpl-resume-bold": "https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Manrope:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      "tpl-resume-dark": "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
      "tpl-blog": "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,900&family=Inter:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap",
    };
    const url = fontMap[theme];
    if (url) fontLinks = `\n        <link href="${url}" rel="stylesheet" />`;
  }

  return `import type { Metadata } from "next";
import "./globals.css";
import LanguageProvider from "@/components/LanguageProvider";

export const metadata: Metadata = {
  title: "${getSpecName(spec) || data.name} - ${getSpecTitle(spec) || data.title || "Portfolio"}",
  description: "${spec?.product?.purpose || data.title || data.bio.slice(0, 120)}",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" suppressHydrationWarning>${darkScript}
      <head>${fontLinks}
      </head>
      <body className="${bodyClass}">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
`;
}

// ---- CSS Generation ----

export function genGlobalCSS(theme: ThemeStyle, layout: LayoutType, features: FeatureFlags, resolved?: ResolvedStyle): string {
  const config = resolved || applyDesignIntelligence(theme);
  // Font @import must come BEFORE @import "tailwindcss" (CSS spec: @import must precede all rules)
  const fontImportLine = config.fontImport ? `${config.fontImport}\n` : "";
  const base = `${fontImportLine}@import "tailwindcss";

@theme {
${Object.entries(config.colors).map(([k, v]) => `  --color-${k}: ${v};`).join("\n")}
  --font-sans: ${config.fontSans};
  --font-heading: ${config.fontHeading};
  --font-mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace;
  --radius-card: ${config.borderRadius};
}
`;

  const lightTheme = "";

  const baseStyles = `
body {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
  line-height: 1.6;
  overflow-x: hidden;
}
::selection { background-color: var(--color-accent); color: white; }
html { scroll-behavior: smooth; }
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--color-text-muted); border-radius: 999px; }
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

  const family = LAYOUT_FAMILY[layout] || "single";
  const isLeftAligned = family === "sidebar" || family === "split" || layout === "f-shape";
  const sectionHeading = `
.section-heading {
  font-size: 1.75rem; font-weight: 700;
  margin-bottom: 2.5rem;
  position: relative;
  padding-bottom: 0.75rem;${isLeftAligned ? "" : "\n  text-align: center;"}
}
.section-heading::after {
  content: "";
  position: absolute;
  bottom: 0; ${isLeftAligned ? "left: 0;" : "left: 50%; transform: translateX(-50%);"}
  width: 40px; height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--color-accent), var(--color-accent-alt));
}
`;

  const cardStyle = genCardStyle(theme);
  const layoutCSS = genLayoutCSS(layout, theme);
  const animationCSS = genAnimationCSS(theme);
  const chatCSS = genChatCSS();

  return base + lightTheme + baseStyles + sectionHeading + cardStyle + layoutCSS + animationCSS + chatCSS;
}

export function genLightThemeOverride(theme: ThemeStyle): string {
  // Light themes don't need an override
  const lightThemes: ThemeStyle[] = ["ghibli", "minimalist", "retro", "bold-creative", "editorial", "nature", "tpl-resume-bold", "tpl-blog"];
  if (lightThemes.includes(theme)) return "";
  return `
[data-theme="light"] {
  --color-bg: #f0f0f8 !important;
  --color-bg-card: rgba(255,255,255,0.7) !important;
  --color-bg-card-solid: #ffffff !important;
  --color-bg-tag: rgba(108,99,255,0.08) !important;
  --color-text: #1a1a2e !important;
  --color-text-muted: #6b7280 !important;
  --color-line: rgba(0,0,0,0.08) !important;
}
`;
}

export function genCardStyle(theme: ThemeStyle): string {
  switch (theme) {
    case "cyberpunk":
      return `
.card {
  background: var(--color-bg-card);
  backdrop-filter: blur(12px);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  transition: border-color 0.3s, box-shadow 0.3s;
}
.card:hover {
  border-color: var(--color-accent);
  box-shadow: 0 0 20px rgba(0,255,240,0.15), inset 0 0 20px rgba(0,255,240,0.03);
}
.card::after {
  content: "";
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent, var(--color-accent), transparent);
  opacity: 0; transition: opacity 0.3s;
}
.card:hover::after { opacity: 1; }
`;
    case "minimalist":
      return `
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}
.card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.06); border-color: transparent; }
`;
    case "ghibli":
      return `
.card {
  background: var(--color-bg-card);
  backdrop-filter: blur(8px) saturate(1.2);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  box-shadow: 0 2px 12px rgba(139,119,90,0.08);
  overflow: hidden;
  position: relative;
  transition: transform 0.4s cubic-bezier(0.4,0,0.2,1), box-shadow 0.4s ease;
}
.card:hover {
  transform: translateY(-4px) rotate(-0.5deg);
  box-shadow: 0 12px 32px rgba(139,119,90,0.14);
}
`;
    case "glassmorphism":
      return `
.card {
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(20px) saturate(1.4);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  transition: transform 0.4s, border-color 0.4s, box-shadow 0.4s;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}
.card:hover {
  transform: translateY(-4px);
  border-color: rgba(255,255,255,0.2);
  box-shadow: 0 16px 48px rgba(70,130,220,0.15);
}
.card::before {
  content: "";
  position: absolute; inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%);
  pointer-events: none; z-index: 1;
}
`;
    case "retro":
      return `
.card {
  background: var(--color-bg-card);
  border: 2px solid var(--color-line);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  box-shadow: 4px 4px 0 var(--color-line);
  transition: transform 0.2s, box-shadow 0.2s;
}
.card:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 var(--color-line);
}
`;
    case "brutalist":
      return `
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-line);
  border-radius: 0;
  overflow: hidden;
  position: relative;
  transition: border-color 0.2s;
}
.card:hover {
  border-color: var(--color-text-muted);
}
`;
    case "cinematic":
      return `
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  transition: transform 0.5s cubic-bezier(0.25,0.1,0.25,1), box-shadow 0.5s;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
.card:hover {
  transform: scale(1.02);
  box-shadow: 0 8px 40px rgba(233,69,96,0.15), 0 4px 20px rgba(0,0,0,0.4);
}
.card::after {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.5));
  pointer-events: none; z-index: 1;
}
`;
    case "bold-creative":
      return `
.card {
  background: var(--color-bg-card);
  border: 3px solid var(--color-text);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  transition: transform 0.3s, background 0.3s;
}
.card:hover {
  transform: rotate(-1deg) scale(1.03);
  background: var(--color-accent-soft);
}
`;
    case "editorial":
      return `
.card {
  background: var(--color-bg-card);
  border-bottom: 2px solid var(--color-line);
  border-radius: 0;
  overflow: hidden;
  position: relative;
  padding-bottom: 1rem;
  transition: border-color 0.3s;
}
.card:hover {
  border-color: var(--color-accent);
}
`;
    case "nature":
      return `
.card {
  background: var(--color-bg-card);
  backdrop-filter: blur(6px);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  box-shadow: 0 4px 16px rgba(45,80,22,0.06);
  transition: transform 0.4s cubic-bezier(0.4,0,0.2,1), box-shadow 0.4s;
}
.card:hover {
  transform: translateY(-6px);
  box-shadow: 0 16px 40px rgba(45,80,22,0.12);
}
`;
    case "gradient-mesh":
      return `
.card {
  background: rgba(255,255,255,0.04);
  backdrop-filter: blur(24px) saturate(1.3);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  transition: transform 0.4s, border-color 0.4s, box-shadow 0.4s;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}
.card:hover {
  transform: translateY(-4px);
  border-color: rgba(161,140,209,0.3);
  box-shadow: 0 16px 48px rgba(161,140,209,0.15);
}
.card::before {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(161,140,209,0.05) 0%, rgba(255,154,158,0.05) 100%);
  pointer-events: none; z-index: 1;
}
`;
    case "neo-tokyo":
      return `
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  transition: border-color 0.3s, box-shadow 0.3s;
}
.card:hover {
  border-color: var(--color-accent);
  box-shadow: 0 0 24px rgba(255,46,99,0.2), 0 0 48px rgba(8,217,214,0.08);
}
.card::after {
  content: "";
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, var(--color-accent), var(--color-accent-alt));
  opacity: 0; transition: opacity 0.3s;
}
.card:hover::after { opacity: 1; }
`;
    case "tpl-resume-bold":
      return `
.card {
  background: var(--color-bg-card);
  border: 3px solid var(--color-text);
  border-radius: 0;
  overflow: hidden;
  position: relative;
  box-shadow: 6px 6px 0 var(--color-accent);
  transition: transform 0.2s, box-shadow 0.2s;
}
.card:hover {
  transform: translate(-3px, -3px);
  box-shadow: 9px 9px 0 var(--color-accent), 12px 12px 0 var(--color-accent-alt);
}
.card::before {
  content: "";
  position: absolute; top: 0; left: 0; width: 4px; height: 100%;
  background: linear-gradient(180deg, var(--color-accent), var(--color-accent-alt));
  z-index: 2;
}
`;
    case "tpl-resume-dark":
      return `
.card {
  background: var(--color-bg-card);
  backdrop-filter: blur(20px) saturate(1.3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  transition: transform 0.4s, border-color 0.4s, box-shadow 0.4s;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}
.card:hover {
  transform: translateY(-4px);
  border-color: var(--color-accent);
  box-shadow: 0 16px 48px rgba(94,106,210,0.2), 0 0 0 1px var(--color-accent);
}
.card::after {
  content: "";
  position: absolute; inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(94,106,210,0.05) 0%, transparent 50%);
  pointer-events: none; z-index: 1;
}
`;
    case "tpl-blog":
      return `
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  transition: transform 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(184,92,56,0.12);
  border-color: var(--color-accent);
}
.card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--color-accent);
  transform: scaleX(0); transform-origin: left;
  transition: transform 0.4s ease;
}
.card:hover::before { transform: scaleX(1); }
`;
    default:
      return `
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  transition: transform 0.3s, box-shadow 0.3s;
}
.card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
`;
  }
}

export function genLayoutCSS(layout: LayoutType, theme: ThemeStyle = "minimalist"): string {
  const family = LAYOUT_FAMILY[layout] || "single";

  // ---- Sidebar family (two-column, asymmetric) ----
  if (family === "sidebar") {
    const sidebarWidth = layout === "asymmetric" ? "28%" : "35%";
    return `
.two-column-layout { display: flex; min-height: 100vh; }
.sidebar-panel {
  width: ${sidebarWidth}; max-width: ${layout === "asymmetric" ? "320px" : "400px"}; min-width: 280px;
  position: sticky; top: 0; height: 100vh;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 2rem 1.5rem;
}
.sidebar-card {
  background: var(--color-bg-card);
  backdrop-filter: blur(16px) saturate(1.4);
  border: 1px solid var(--color-line);
  border-radius: 24px;
  padding: 2.5rem 2rem;
  box-shadow: 0 4px 24px rgba(0,0,0,0.06);
  text-align: center;
  width: 100%;
}
.content-panel { flex: 1; padding: 3rem 2.5rem; min-height: 100vh; }
.sidebar-nav-link {
  font-size: 0.95rem; font-weight: 500;
  color: var(--color-text-muted);
  transition: color 0.3s; text-decoration: none;
  padding: 0.35rem 0; display: block;
}
.sidebar-nav-link:hover { color: var(--color-accent); }
${layout === "asymmetric" ? `.content-panel .card:nth-child(even) { transform: translateY(24px); }
.content-panel .card:nth-child(even):hover { transform: translateY(20px); }` : ""}
@media (max-width: 768px) {
  .two-column-layout { flex-direction: column; }
  .sidebar-panel { width: 100%; max-width: none; min-width: 0; height: auto; position: relative; padding: 1.5rem; }
  .content-panel { padding: 1.5rem; }
  .content-panel .card:nth-child(even) { transform: none; }
}
`;
  }

  // ---- Split family (split-screen) ----
  if (family === "split") {
    return `
.split-layout { display: flex; min-height: 100vh; }
.split-left {
  width: 50%; position: sticky; top: 0; height: 100vh;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 3rem;
  background: var(--color-bg-card);
  border-right: 1px solid var(--color-line);
}
.split-right { width: 50%; padding: 3rem; overflow-y: auto; }
@media (max-width: 768px) {
  .split-layout { flex-direction: column; }
  .split-left { width: 100%; height: auto; position: relative; border-right: none; border-bottom: 1px solid var(--color-line); padding: 2rem; }
  .split-right { width: 100%; padding: 1.5rem; }
}
`;
  }

  // ---- Grid family (card-grid, masonry, magazine) ----
  if (family === "grid") {
    if (layout === "masonry") {
      return `
.masonry-grid { columns: 3; column-gap: 20px; }
.masonry-grid > * { break-inside: avoid; margin-bottom: 20px; }
@media (max-width: 768px) { .masonry-grid { columns: 1; } }
`;
    }
    if (layout === "magazine") {
      return `
.magazine-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-rows: auto auto;
  gap: 20px;
}
.magazine-feature { grid-row: span 2; }
.magazine-sidebar { display: flex; flex-direction: column; gap: 20px; }
@media (max-width: 768px) {
  .magazine-grid { grid-template-columns: 1fr; }
  .magazine-feature { grid-row: span 1; }
}
`;
    }
    // card-grid (bento)
    return `
.bento-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
.bento-wide { grid-column: span 2; }
@media (max-width: 768px) {
  .bento-grid { grid-template-columns: 1fr; }
  .bento-wide { grid-column: span 1; }
}
`;
  }

  // ---- Single family variations ----
  let extra = "";

  if (layout === "z-shape") {
    extra = `
.zigzag-section { max-width: 1100px; margin: 0 auto; }
.zigzag-section:nth-child(even) .zigzag-inner { flex-direction: row-reverse; }
.zigzag-inner { display: flex; align-items: center; gap: 3rem; }
.zigzag-inner > * { flex: 1; }
@media (max-width: 768px) {
  .zigzag-inner, .zigzag-section:nth-child(even) .zigzag-inner { flex-direction: column; }
}
`;
  }

  if (layout === "hero-media") {
    const isImageStyle = ["ghibli", "nature", "cinematic"].includes(theme);
    extra = `
.hero-media {
  width: 100%; min-height: ${isImageStyle ? "70vh" : "60vh"};
  display: flex; align-items: center; justify-content: center;
  position: relative; overflow: hidden;
  background: linear-gradient(135deg, var(--color-bg-card) 0%, var(--color-bg) 100%);
  background-image: url('/images/hero-bg.png');
  background-size: cover; background-position: center;
}
.hero-media-overlay {
  position: absolute; inset: 0;
  background: ${isImageStyle
    ? "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, var(--color-bg) 90%)"
    : "linear-gradient(to bottom, transparent 20%, var(--color-bg) 100%)"};
  z-index: 1;
}
.hero-media-content { position: relative; z-index: 2; text-align: center; padding: 2rem; }
`;
  }

  if (layout === "hidden-nav") {
    extra = `
.hamburger { display: flex; flex-direction: column; gap: 5px; cursor: pointer; padding: 8px; z-index: 100; }
.hamburger span { display: block; width: 24px; height: 2px; background: var(--color-text); transition: all 0.3s; border-radius: 2px; }
.mobile-menu {
  position: fixed; inset: 0; background: var(--color-bg); z-index: 90;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2rem;
  opacity: 0; pointer-events: none; transition: opacity 0.3s;
}
.mobile-menu.open { opacity: 1; pointer-events: all; }
.mobile-menu a { font-size: 1.5rem; font-weight: 600; color: var(--color-text); text-decoration: none; }
.mobile-menu a:hover { color: var(--color-accent); }
`;
  }

  if (layout === "interactive") {
    extra = `
.scroll-section {
  opacity: 0; transform: translateY(40px);
  transition: opacity 0.8s ease, transform 0.8s ease;
}
.scroll-section.visible { opacity: 1; transform: translateY(0); }
.parallax-bg {
  position: fixed; inset: 0; z-index: 0;
  background: radial-gradient(ellipse at 30% 50%, var(--color-accent-soft) 0%, transparent 60%);
  pointer-events: none;
}
`;
  }

  if (layout === "f-shape") {
    extra = `
.f-layout { max-width: 900px; margin: 0 auto; }
.f-layout .section-heading { text-align: left; }
.f-layout .section-heading::after { left: 0; transform: none; }
`;
  }

  if (layout === "fixed-nav") {
    extra = `
.fixed-top-nav {
  position: sticky; top: 0; z-index: 50;
  background: var(--color-bg-card); backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--color-line);
  padding: 0 2rem;
}
.fixed-top-nav ul {
  display: flex; gap: 2rem; list-style: none;
  max-width: 1100px; margin: 0 auto; padding: 0;
  height: 56px; align-items: center;
}
.fixed-top-nav a {
  font-size: 0.9rem; font-weight: 600; color: var(--color-text-muted);
  text-decoration: none; transition: color 0.3s;
  padding: 4px 0; border-bottom: 2px solid transparent;
}
.fixed-top-nav a:hover, .fixed-top-nav a.active {
  color: var(--color-accent); border-bottom-color: var(--color-accent);
}
`;
  }

  return extra;
}

export function genAnimationCSS(theme: ThemeStyle): string {
  // Style-specific background effects
  let bgEffects = "";
  if (theme === "cyberpunk") {
    bgEffects = `
/* Cyberpunk grid background */
.cyber-grid {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background-image:
    linear-gradient(rgba(0,255,240,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,255,240,0.03) 1px, transparent 1px);
  background-size: 60px 60px;
}
.cyber-grid::after {
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(ellipse at 50% 0%, rgba(0,255,240,0.08) 0%, transparent 60%);
}
/* Scanline overlay */
.scanlines {
  position: fixed; inset: 0; pointer-events: none; z-index: 1;
  background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px);
}
`;
  } else if (theme === "glassmorphism") {
    bgEffects = `
/* === Glassmorphism Dusk Street Background === */
.glass-bg {
  position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 0;
  /* Deep dusk sky: warm horizon fading into cool twilight */
  background: linear-gradient(170deg,
    #1a1225 0%,        /* deep night sky */
    #2a1b3d 15%,       /* purple dusk */
    #3d2449 30%,       /* warm twilight */
    #4a2f52 45%,       /* dusky violet */
    #3a2845 60%,       /* fading purple */
    #2d2040 75%,       /* deeper evening */
    #1a1428 100%       /* night */
  );
}
/* Heavily blurred color blobs simulate out-of-focus street lights & signage */
.glass-bg .blob { position: absolute; border-radius: 50%; }
/* Warm street lamp glow — top right */
.glass-bg .blob-1 {
  width: 700px; height: 700px;
  background: radial-gradient(circle, rgba(255,170,80,0.25) 0%, rgba(220,120,50,0.1) 50%, transparent 70%);
  filter: blur(120px); top: -10%; right: -5%;
  animation: float1 20s ease-in-out infinite;
}
/* Cool neon reflection — bottom left */
.glass-bg .blob-2 {
  width: 550px; height: 550px;
  background: radial-gradient(circle, rgba(100,140,220,0.2) 0%, rgba(80,100,180,0.08) 50%, transparent 70%);
  filter: blur(140px); bottom: -10%; left: -8%;
  animation: float2 25s ease-in-out infinite;
}
/* Pink/magenta shop sign bokeh — mid */
.glass-bg .blob-3 {
  width: 450px; height: 450px;
  background: radial-gradient(circle, rgba(200,100,160,0.18) 0%, rgba(160,70,130,0.06) 50%, transparent 70%);
  filter: blur(160px); top: 35%; left: 25%;
  animation: float3 22s ease-in-out infinite;
}
/* Distant amber streetlight — lower right */
.glass-bg .blob-4 {
  width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(240,180,100,0.15) 0%, rgba(200,140,60,0.05) 50%, transparent 70%);
  filter: blur(130px); bottom: 15%; right: 15%;
  animation: float4 28s ease-in-out infinite;
}
@keyframes float1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-60px,40px) scale(1.1)} }
@keyframes float2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(50px,-30px) scale(1.08)} }
@keyframes float3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-30px,-40px) scale(0.9)} }
@keyframes float4 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,30px) scale(1.05)} }

/* === Layout === */
.gm-layout { display: flex; min-height: 100vh; position: relative; z-index: 1; }
.gm-sidebar {
  width: 280px; min-width: 280px; position: fixed; top: 0; left: 0; bottom: 0;
  display: flex; flex-direction: column; gap: 12px; padding: 16px;
  overflow-y: auto; z-index: 10;
}
.gm-sidebar::-webkit-scrollbar { width: 4px; }
.gm-sidebar::-webkit-scrollbar-thumb { background: rgba(180,130,200,0.3); border-radius: 2px; }
.gm-main { margin-left: 280px; flex: 1; padding: 32px 40px; min-height: 100vh; }

/* === Glass Card Base === */
.gm-card {
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(20px) saturate(1.4);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px; padding: 20px;
  position: relative; overflow: hidden;
  transition: transform 0.3s, box-shadow 0.3s, border-color 0.3s;
}
.gm-card::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit;
  background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 50%);
  pointer-events: none;
}
.gm-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.18); box-shadow: 0 8px 32px rgba(70,130,220,0.12); }

/* === Sidebar: Avatar === */
.gm-avatar-wrap { display: flex; flex-direction: column; align-items: center; padding: 24px 16px 16px; }
.gm-avatar-ring {
  position: relative; width: 100px; height: 100px; border-radius: 50%;
  background: conic-gradient(from 0deg, #4682d9, #7cb3ff, #3a6fb0, #4682d9);
  padding: 3px; margin-bottom: 12px;
  animation: gm-ring-spin 8s linear infinite;
}
@keyframes gm-ring-spin { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } }
.gm-avatar-ring img {
  width: 100%; height: 100%; border-radius: 50%; object-fit: cover;
  border: 3px solid #0d1520;
}
.gm-avatar-glow {
  position: absolute; inset: -8px; border-radius: 50%;
  background: radial-gradient(circle, rgba(70,130,220,0.4) 0%, transparent 70%);
  animation: gm-glow-pulse 3s ease-in-out infinite; z-index: -1;
}
@keyframes gm-glow-pulse { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.1)} }
.gm-sidebar-name { font-size: 1.1rem; font-weight: 700; color: #e8f0ff; text-align: center; margin-bottom: 2px; }
.gm-sidebar-title { font-size: 0.8rem; color: #8aa0c0; text-align: center; }

/* === Sidebar: Info Card === */
.gm-info-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; color: #8aa0c0; font-size: 0.82rem; }
.gm-info-row svg { width: 16px; height: 16px; color: #5b8fd9; flex-shrink: 0; }

/* === Sidebar: Tags === */
.gm-tag-wrap { display: flex; flex-wrap: wrap; gap: 6px; }
.gm-tag {
  display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 0.72rem;
  background: rgba(70,130,220,0.15); color: #a0c4e8; border: 1px solid rgba(70,130,220,0.2);
  transition: all 0.3s;
}
.gm-tag:hover { background: rgba(70,130,220,0.25); transform: translateY(-1px); color: #d0e0f0; }

/* === Sidebar: Mini Timeline === */
.gm-mini-timeline { display: flex; flex-direction: column; gap: 0; position: relative; padding-left: 14px; }
.gm-mini-timeline::before {
  content: ""; position: absolute; left: 5px; top: 8px; bottom: 8px;
  width: 1px; background: rgba(70,130,220,0.3);
}
.gm-mini-item { display: flex; align-items: flex-start; gap: 10px; padding: 6px 0; position: relative; }
.gm-mini-dot {
  width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 4px;
  background: rgba(70,130,220,0.5); border: 2px solid #5b8fd9; position: absolute; left: -14px;
}
.gm-mini-dot.active { background: #5b8fd9; box-shadow: 0 0 8px rgba(70,130,220,0.6); }
.gm-mini-label { font-size: 0.75rem; color: #8aa0c0; line-height: 1.3; }
.gm-mini-label strong { color: #a0c4e8; font-weight: 600; display: block; }

/* === Sidebar: Language Button === */
.gm-lang-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px; border-radius: 10px; font-size: 0.78rem; cursor: pointer;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  color: #8aa0c0; transition: all 0.3s; margin-top: auto;
}
.gm-lang-btn:hover { background: rgba(70,130,220,0.15); color: #a0c4e8; }

/* === Main: Hero === */
.gm-hero { margin-bottom: 36px; }
.gm-hero-heading { font-size: 2.5rem; font-weight: 800; color: #e8f0ff; line-height: 1.2; margin-bottom: 8px; }
.gm-neon-name {
  color: #7cb3ff;
  text-shadow: 0 0 10px rgba(124,179,255,0.5), 0 0 30px rgba(124,179,255,0.3), 0 0 60px rgba(124,179,255,0.15);
}
.gm-hero-bio { font-size: 0.95rem; color: #8aa0c0; line-height: 1.6; max-width: 600px; margin-bottom: 16px; }
.gm-about-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.gm-about-tag {
  padding: 6px 14px; border-radius: 20px; font-size: 0.78rem;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: #a0c4e8; backdrop-filter: blur(8px);
}

/* === Main: Social Icons === */
.gm-social-row { display: flex; gap: 12px; margin: 20px 0 32px; }
.gm-social-icon {
  width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: #8aa0c0; transition: all 0.3s; cursor: pointer; backdrop-filter: blur(8px);
}
.gm-social-icon:hover { background: rgba(70,130,220,0.2); color: #a0c4e8; border-color: rgba(70,130,220,0.3); box-shadow: 0 0 16px rgba(70,130,220,0.2); }
.gm-social-icon svg { width: 18px; height: 18px; }

/* === Main: Contribution Grid === */
.gm-contrib-section { margin-bottom: 36px; }
.gm-contrib-label { font-size: 0.8rem; color: #8aa0c0; margin-bottom: 10px; }
.gm-contrib-grid {
  display: grid; grid-template-columns: repeat(52, 1fr); gap: 3px;
}
.gm-contrib-cell { aspect-ratio: 1; border-radius: 3px; transition: all 0.2s; }
.gm-contrib-0 { background: rgba(255,255,255,0.04); }
.gm-contrib-1 { background: rgba(70,160,200,0.2); }
.gm-contrib-2 { background: rgba(70,160,200,0.4); }
.gm-contrib-3 { background: rgba(70,160,200,0.6); }
.gm-contrib-4 { background: rgba(70,160,200,0.85); }
.gm-contrib-cell:hover { transform: scale(1.8); z-index: 2; }

/* === Main: Section Heading === */
.gm-section-heading {
  font-size: 1.3rem; font-weight: 700; color: #e8f0ff; margin-bottom: 20px;
  padding-bottom: 8px; border-bottom: 1px solid rgba(70,130,220,0.2);
}

/* === Main: Projects Grid === */
.gm-projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom: 36px; }
.gm-project-card {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px; padding: 20px; transition: all 0.3s; position: relative; overflow: hidden;
}
.gm-project-card::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit;
  background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%);
  pointer-events: none;
}
.gm-project-card:hover { transform: translateY(-3px); border-color: rgba(70,130,220,0.3); box-shadow: 0 8px 24px rgba(70,130,220,0.1); }
.gm-project-name { font-size: 1rem; font-weight: 600; color: #d0e0f0; margin-bottom: 6px; }
.gm-project-desc { font-size: 0.82rem; color: #8aa0c0; line-height: 1.5; margin-bottom: 10px; }
.gm-project-tech { display: flex; flex-wrap: wrap; gap: 4px; }
.gm-project-tech span { font-size: 0.68rem; padding: 2px 8px; border-radius: 10px; background: rgba(70,130,220,0.12); color: #a0c4e8; }

/* === Main: Skills Grid === */
.gm-skills-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; margin-bottom: 36px; }
.gm-skill-chip {
  padding: 10px 14px; border-radius: 12px; font-size: 0.82rem; text-align: center;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  color: #a0c4e8; transition: all 0.3s;
}
.gm-skill-chip:hover { background: rgba(70,130,220,0.15); border-color: rgba(70,130,220,0.3); transform: translateY(-2px); }

/* === Main: Education Grid === */
.gm-edu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; margin-bottom: 36px; }
.gm-edu-card {
  padding: 18px; border-radius: 14px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  transition: all 0.3s;
}
.gm-edu-card:hover { border-color: rgba(70,130,220,0.2); }
.gm-edu-school { font-size: 0.95rem; font-weight: 600; color: #d0e0f0; }
.gm-edu-degree { font-size: 0.82rem; color: #8aa0c0; margin-top: 4px; }

/* === Footer === */
.gm-footer {
  margin-top: 48px; padding: 24px 0; border-top: 1px solid rgba(255,255,255,0.06);
  text-align: center; font-size: 0.78rem; color: #5a6a80;
}

/* === Mobile Responsive === */
@media (max-width: 768px) {
  .gm-layout { flex-direction: column; }
  .gm-sidebar {
    position: relative; width: 100%; min-width: 100%; flex-direction: row;
    overflow-x: auto; gap: 10px; padding: 12px;
  }
  .gm-sidebar .gm-card { min-width: 200px; flex-shrink: 0; }
  .gm-main { margin-left: 0; padding: 20px 16px; }
  .gm-hero-heading { font-size: 1.8rem; }
  .gm-contrib-grid { grid-template-columns: repeat(26, 1fr); }
  .gm-projects-grid { grid-template-columns: 1fr; }
  .gm-avatar-ring { width: 72px; height: 72px; }
}
`;
  } else if (theme === "ghibli") {
    bgEffects = `
/* Ghibli background wrapper */
.ghibli-bg {
  min-height: 100vh;
  color: var(--color-text);
  transition: background-color 0.4s ease, color 0.4s ease;
}
/* Ghibli landscape banner at top */
.ghibli-landscape {
  width: 100%;
  height: 260px;
  background-image: url('/images/ghibli-background.png');
  background-size: cover;
  background-position: center bottom;
  border-radius: 0 0 28px 28px;
  position: relative;
}
.ghibli-landscape::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 0 0 28px 28px;
  background: linear-gradient(to bottom, transparent 60%, var(--color-bg) 100%);
}
/* Top navigation */
.ghibli-topnav {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(245,239,230,0.88);
  backdrop-filter: blur(16px) saturate(1.4);
  -webkit-backdrop-filter: blur(16px) saturate(1.4);
  border-bottom: 1px solid var(--color-line);
  transition: background-color 0.4s ease;
}
.ghibli-topnav-inner {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 1.5rem;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ghibli-logo-badge {
  background: var(--color-accent);
  color: #fff;
  font-weight: 700;
  font-size: 0.82rem;
  padding: 5px 16px;
  border-radius: 20px;
  letter-spacing: 0.02em;
  text-decoration: none;
  transition: background 0.3s, transform 0.2s;
}
.ghibli-logo-badge:hover {
  transform: translateY(-1px);
  filter: brightness(1.1);
}
.ghibli-topnav-links {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}
.ghibli-topnav-link {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-muted);
  text-decoration: none;
  transition: color 0.3s;
}
.ghibli-topnav-link:hover {
  color: var(--color-accent);
}
.ghibli-theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--color-line);
  background: transparent;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: color 0.3s, background 0.3s, border-color 0.3s;
  font-size: 1rem;
}
.ghibli-theme-toggle:hover {
  color: var(--color-accent);
  background: var(--color-accent-soft);
  border-color: var(--color-accent);
}
/* Content container */
.ghibli-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.5rem 3rem;
}
/* About Me section */
.ghibli-about-section {
  display: flex;
  gap: 2.5rem;
  align-items: flex-start;
  margin-bottom: 3rem;
  padding: 2.5rem;
  background: var(--color-bg-card);
  backdrop-filter: blur(8px) saturate(1.2);
  -webkit-backdrop-filter: blur(8px) saturate(1.2);
  border: 1px solid var(--color-line);
  border-radius: 24px;
  box-shadow: 0 4px 24px rgba(139,119,90,0.08);
}
.ghibli-about-text {
  flex: 1;
  min-width: 0;
}
.ghibli-about-text h2 {
  font-size: 1.65rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 1rem;
}
.ghibli-about-text p {
  font-size: 0.92rem;
  line-height: 1.8;
  color: var(--color-text-muted);
  margin-bottom: 0.75rem;
}
/* Polaroid-style avatar */
.ghibli-polaroid-stack {
  flex-shrink: 0;
  position: relative;
  width: 200px;
  height: 250px;
}
.ghibli-polaroid {
  position: absolute;
  width: 175px;
  background: #fffdf7;
  padding: 10px 10px 28px;
  border-radius: 4px;
  box-shadow: 0 4px 18px rgba(0,0,0,0.1);
  transition: transform 0.4s ease;
}
.ghibli-polaroid:nth-child(1) {
  top: 0; left: 10px;
  transform: rotate(-5deg);
  z-index: 2;
}
.ghibli-polaroid:nth-child(2) {
  top: 16px; left: 24px;
  transform: rotate(4deg);
  z-index: 1;
}
.ghibli-polaroid:hover {
  transform: rotate(0deg) scale(1.05);
  z-index: 10;
}
.ghibli-polaroid img {
  width: 100%;
  height: 155px;
  object-fit: cover;
  border-radius: 2px;
}
/* Projects grid */
.ghibli-projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.25rem;
}
/* Parchment card */
.parchment-card {
  background: var(--color-bg-card);
  backdrop-filter: blur(8px) saturate(1.2);
  -webkit-backdrop-filter: blur(8px) saturate(1.2);
  border: 1px solid var(--color-line);
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(139,119,90,0.08);
  overflow: hidden;
  position: relative;
  transition: transform 0.4s cubic-bezier(0.4,0,0.2,1), box-shadow 0.4s ease;
}
.parchment-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 28px rgba(139,119,90,0.14);
}
/* Ghibli badge */
.ghibli-badge {
  font-size: 0.78rem;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 20px;
  background: rgba(125,155,95,0.12);
  color: var(--color-text-muted);
  border: 1px solid var(--color-line);
  transition: transform 0.2s ease, color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
  display: inline-block;
}
.ghibli-badge:hover {
  transform: translateY(-2px);
  color: var(--color-accent);
  background: var(--color-accent-soft);
  border-color: var(--color-accent);
}
/* Avatar glow */
.avatar-glow {
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  background: #a6d784;
  filter: blur(25px);
  opacity: 0.35;
}
/* Section heading with gradient underline */
.section-heading::after {
  background: linear-gradient(90deg, var(--color-accent), #a6d784) !important;
}
/* Timeline */
.timeline-line {
  background: linear-gradient(to bottom, var(--color-accent), #f1dbb6, transparent) !important;
}
.timeline-dot-active {
  box-shadow: 0 0 0 4px var(--color-accent-soft), 0 0 12px rgba(125,155,95,0.25);
}
/* Dark mode */
[data-theme="dark"] {
  --color-bg: #1a1814;
  --color-bg-card: rgba(35,32,26,0.9);
  --color-bg-card-solid: #2a2620;
  --color-bg-tag: rgba(125,155,95,0.15);
  --color-text: #e8e0d4;
  --color-text-muted: #a09882;
  --color-accent: #8fb86a;
  --color-accent-soft: rgba(143,184,106,0.15);
  --color-accent-alt: #e8a87c;
  --color-line: rgba(255,255,255,0.1);
}
[data-theme="dark"] .ghibli-topnav {
  background: rgba(26,24,20,0.88);
}
[data-theme="dark"] .ghibli-polaroid {
  background: #2a2620;
  box-shadow: 0 4px 18px rgba(0,0,0,0.3);
}
[data-theme="dark"] .ghibli-about-section {
  box-shadow: 0 4px 24px rgba(0,0,0,0.2);
}
[data-theme="dark"] .parchment-card {
  box-shadow: 0 2px 12px rgba(0,0,0,0.2);
}
[data-theme="dark"] .parchment-card:hover {
  box-shadow: 0 8px 28px rgba(0,0,0,0.3);
}
[data-theme="dark"] .ghibli-landscape::after {
  background: linear-gradient(to bottom, transparent 40%, var(--color-bg) 100%);
}
/* Scrollbar */
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #e3bba1; border-radius: 999px; }
/* Mobile responsive */
@media (max-width: 768px) {
  .ghibli-landscape { height: 160px; border-radius: 0 0 18px 18px; }
  .ghibli-topnav-links { gap: 0.6rem; }
  .ghibli-topnav-link { font-size: 0.75rem; }
  .ghibli-about-section { flex-direction: column; padding: 1.5rem; gap: 1.5rem; }
  .ghibli-polaroid-stack { width: 160px; height: 200px; margin: 0 auto; }
  .ghibli-polaroid { width: 140px; }
  .ghibli-polaroid img { height: 120px; }
  .ghibli-content { padding: 1rem 1.25rem 2rem; }
  .ghibli-projects-grid { grid-template-columns: 1fr; }
}
`;
  } else if (theme === "brutalist") {
    bgEffects = `
/* Brutalist dark coder theme */
.brutal-topnav {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(29,29,29,0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-line);
}
.brutal-topnav-inner {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 1.5rem;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.brutal-logo {
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 0.9rem;
  color: var(--color-text);
  text-decoration: none;
  letter-spacing: 0.04em;
}
.brutal-logo:hover { color: var(--color-accent); }
.brutal-nav-links {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.brutal-nav-link {
  font-size: 0.85rem;
  font-weight: 400;
  color: var(--color-text);
  text-decoration: none;
  transition: color 0.2s;
}
.brutal-nav-link:hover { color: var(--color-accent); }
.brutal-lang-toggle {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  border-left: 1px solid var(--color-line);
  padding-left: 1.25rem;
  transition: color 0.2s;
}
.brutal-lang-toggle:hover { color: var(--color-accent); }
/* Hero: centered avatar + name + title + social */
.brutal-hero {
  max-width: 800px;
  margin: 0 auto;
  padding: 5rem 1.5rem 3rem;
  text-align: center;
}
.brutal-avatar {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  border: 3px solid var(--color-line);
  overflow: hidden;
  margin: 0 auto 2rem;
}
.brutal-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.brutal-hero h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 0.5rem;
}
.brutal-hero-subtitle {
  font-size: 0.95rem;
  color: var(--color-text-muted);
  margin-bottom: 0.25rem;
  line-height: 1.6;
}
.brutal-social {
  display: flex;
  justify-content: center;
  gap: 1.25rem;
  margin-top: 1.5rem;
}
.brutal-social a {
  color: var(--color-text-muted);
  transition: color 0.2s;
}
.brutal-social a:hover { color: var(--color-text); }
/* Content container */
.brutal-content {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 1.5rem 3rem;
}
/* Section heading */
.brutal-section-heading {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-line);
}
/* About section */
.brutal-about p {
  font-size: 0.92rem;
  line-height: 1.8;
  color: var(--color-text-muted);
  margin-bottom: 1rem;
  text-align: justify;
}
/* Projects list */
.brutal-project-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.brutal-project-item {
  display: flex;
  gap: 2rem;
  align-items: baseline;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-line);
  transition: background 0.2s;
}
.brutal-project-item:hover {
  background: var(--color-bg-tag);
}
.brutal-project-date {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  min-width: 100px;
}
.brutal-project-title {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-text);
}
.brutal-project-title:hover { color: var(--color-accent); }
.brutal-project-org {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  font-weight: 400;
}
/* Timeline list */
.brutal-timeline-item {
  display: flex;
  gap: 2rem;
  align-items: baseline;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-line);
}
.brutal-timeline-date {
  font-size: 0.82rem;
  color: var(--color-accent);
  white-space: nowrap;
  min-width: 100px;
  font-weight: 500;
}
.brutal-timeline-text h3 {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 0.25rem;
}
.brutal-timeline-text p {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  line-height: 1.6;
}
/* Two-column grid */
.brutal-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}
.brutal-col h3 {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 0.5rem;
}
.brutal-col ul {
  list-style: disc;
  padding-left: 1.25rem;
}
.brutal-col li {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  line-height: 1.8;
}
.brutal-col li strong {
  color: var(--color-text);
  font-weight: 600;
}
/* Footer */
.brutal-footer {
  text-align: center;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  padding: 2rem 0;
  border-top: 1px solid var(--color-line);
  margin-top: 2rem;
}
.brutal-footer a {
  color: var(--color-accent);
  text-decoration: none;
}
.brutal-footer a:hover { text-decoration: underline; }
/* Override generic heading/section-heading styles */
.brutal-hero h1 { font-size: 2rem; margin: 0 0 0.5rem; text-transform: none; }
.brutal-section-heading { position: relative; text-transform: none; padding-bottom: 0.75rem; }
.brutal-section-heading::after { display: none; }
.brutal-about p { margin-top: 0; }
.brutal-content .section-heading { display: none; }
.brutal-content h2,
.brutal-content h3 { text-transform: none; letter-spacing: normal; }
.brutal-two-col .brutal-section-heading { font-size: 1.5rem; }
.brutal-project-item > div { min-width: 0; flex: 1; }
.brutal-timeline-text { min-width: 0; flex: 1; }
/* word wrap safety */
.brutal-content * { overflow-wrap: break-word; word-break: break-word; }
/* Mobile responsive */
@media (max-width: 768px) {
  .brutal-hero { padding: 3rem 1.5rem 2rem; }
  .brutal-avatar { width: 120px; height: 120px; }
  .brutal-nav-links { gap: 0.75rem; }
  .brutal-nav-link { font-size: 0.78rem; }
  .brutal-two-col { grid-template-columns: 1fr; }
  .brutal-project-item { gap: 1rem; }
  .brutal-project-item { flex-direction: column; gap: 0.25rem; }
  .brutal-timeline-item { flex-direction: column; gap: 0.25rem; }
  .brutal-section-heading { font-size: 1.4rem; }
}
`;
  } else if (theme === "cinematic") {
    bgEffects = `
.cinematic-page-bg {
  position: relative;
  background: #0d0d12;
}
.cinematic-page-bg::before {
  content: ""; position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background-image: url('/images/hero-bg.png');
  background-size: cover; background-position: center;
  opacity: 0.08;
}
.cinematic-bg {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background: radial-gradient(ellipse at 50% 30%, rgba(233,69,96,0.06) 0%, transparent 60%),
              radial-gradient(ellipse at 20% 80%, rgba(201,169,110,0.04) 0%, transparent 50%);
}
/* Letterbox bars */
.letterbox-top, .letterbox-bottom {
  position: fixed; left: 0; right: 0; height: 40px; z-index: 2;
  background: #000; pointer-events: none;
}
.letterbox-top { top: 0; }
.letterbox-bottom { bottom: 0; }
`;
  } else if (theme === "bold-creative") {
    bgEffects = `
.bold-bg {
  position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden;
}
.bold-bg .shape { position: absolute; border-radius: 50%; }
.bold-bg .shape-1 { width: 300px; height: 300px; background: rgba(255,107,107,0.08); top: 10%; right: -5%; }
.bold-bg .shape-2 { width: 200px; height: 200px; background: rgba(77,150,255,0.08); bottom: 20%; left: -3%; }
.bold-bg .shape-3 { width: 150px; height: 150px; background: rgba(255,217,61,0.08); top: 50%; left: 40%; border-radius: 30%; transform: rotate(45deg); }
`;
  } else if (theme === "gradient-mesh") {
    bgEffects = `
.mesh-bg {
  position: fixed; inset: 0; overflow: hidden; pointer-events: none; z-index: 0;
  background: #0f0f1a;
}
.mesh-bg .blob { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.5; }
.mesh-bg .blob-1 { width: 500px; height: 500px; background: rgba(161,140,209,0.4); top: -10%; right: -5%; animation: meshFloat1 18s ease-in-out infinite; }
.mesh-bg .blob-2 { width: 400px; height: 400px; background: rgba(255,154,158,0.3); bottom: -5%; left: -5%; animation: meshFloat2 22s ease-in-out infinite; }
.mesh-bg .blob-3 { width: 350px; height: 350px; background: rgba(150,251,196,0.2); top: 50%; left: 40%; animation: meshFloat3 20s ease-in-out infinite; }
@keyframes meshFloat1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-40px,30px) scale(1.15)} }
@keyframes meshFloat2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(50px,-40px) scale(1.1)} }
@keyframes meshFloat3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-30px,-50px) scale(0.85)} }
`;
  } else if (theme === "neo-tokyo") {
    bgEffects = `
.neotokyo-bg {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background:
    linear-gradient(180deg, rgba(255,46,99,0.03) 0%, transparent 30%),
    radial-gradient(ellipse at 70% 80%, rgba(8,217,214,0.05) 0%, transparent 50%);
}
.neotokyo-bg::after {
  content: ""; position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,46,99,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,46,99,0.02) 1px, transparent 1px);
  background-size: 40px 40px;
}
`;
  } else if (theme === "nature") {
    bgEffects = `
.nature-bg {
  position: relative;
  background: linear-gradient(180deg, #d4c9a8 0%, #f0ebe3 20%, #f0ebe3 100%);
}
.nature-bg::before {
  content: ""; position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background-image: url('/images/hero-bg.png');
  background-size: cover; background-position: center;
  opacity: 0.1;
}
`;
  } else if (theme === "editorial") {
    bgEffects = `
.editorial-bg { position: relative; }
`;
  } else if (theme === "tpl-resume-bold") {
    bgEffects = `
/* ===== Bold Resume — Animated Background ===== */
.bold-resume-bg {
  position: fixed; top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 0; overflow: hidden;
}
.bold-resume-bg .shape {
  position: absolute; border-radius: 50%; opacity: 0.08;
  animation: floatBold 20s infinite ease-in-out;
}
.bold-resume-bg .shape-1 { width: 400px; height: 400px; background: var(--color-accent); top: -100px; left: -100px; }
.bold-resume-bg .shape-2 { width: 300px; height: 300px; background: var(--color-accent-alt); top: 50%; right: -80px; animation-delay: -5s; animation-duration: 25s; }
.bold-resume-bg .shape-3 { width: 200px; height: 200px; background: #FBBF24; bottom: 10%; left: 20%; animation-delay: -10s; animation-duration: 18s; }
@keyframes floatBold {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -40px) scale(1.05); }
  50% { transform: translate(-20px, 20px) scale(0.95); }
  75% { transform: translate(15px, 35px) scale(1.02); }
}

/* ===== Bold Resume — Navigation ===== */
.bold-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  background: rgba(253, 242, 248, 0.85); backdrop-filter: blur(16px);
  border-bottom: 3px solid var(--color-text); padding: 0 40px;
  display: flex; justify-content: space-between; align-items: center; height: 64px;
}
[data-theme="dark"] .bold-nav { background: rgba(15, 23, 42, 0.85); }
.bold-nav .logo {
  font-family: var(--font-heading); font-weight: 800; font-size: 1.4rem;
  color: var(--color-accent); letter-spacing: -1px;
}
.bold-nav .nav-links { display: flex; gap: 8px; list-style: none; }
.bold-nav .nav-links a, .bold-nav .nav-links button {
  font-family: var(--font-heading); font-weight: 600; font-size: 0.85rem;
  text-decoration: none; color: var(--color-text); padding: 8px 16px;
  border: 2px solid transparent; transition: all 0.2s;
  text-transform: uppercase; letter-spacing: 1px; background: none; cursor: pointer;
}
.bold-nav .nav-links a:hover, .bold-nav .nav-links button:hover {
  border: 2px solid var(--color-text); background: #FBBF24;
  box-shadow: 4px 4px 0px var(--color-text); transform: translate(-2px, -2px);
}
@media (max-width: 768px) { .bold-nav .nav-links { display: none; } }

/* ===== Bold Resume — Buttons ===== */
.btn-bold {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--font-heading); font-weight: 700; font-size: 0.95rem;
  padding: 14px 28px; border: 4px solid var(--color-text);
  text-decoration: none; cursor: pointer; transition: all 0.15s;
  text-transform: uppercase; letter-spacing: 1px;
}
.btn-bold:active { transform: translate(4px, 4px); box-shadow: none; }
.btn-bold-primary {
  background: var(--color-accent); color: #fff;
  box-shadow: 6px 6px 0px var(--color-text);
}
.btn-bold-primary:hover { background: #DB2777; transform: translate(-2px, -2px); box-shadow: 8px 8px 0 var(--color-text); }
.btn-bold-outline {
  background: #fff; color: var(--color-text);
  box-shadow: 6px 6px 0px var(--color-text);
}
.btn-bold-outline:hover { background: #06B6D4; color: #fff; transform: translate(-2px, -2px); box-shadow: 8px 8px 0 var(--color-text); }

/* ===== Bold Resume — Hero ===== */
.bold-hero {
  display: grid; grid-template-columns: 1fr 1fr; gap: 48px;
  align-items: center; min-height: 80vh; padding: 40px 0;
}
.bold-hero-text { animation: boldSlideLeft 0.8s ease-out; }
.bold-hero-label {
  display: inline-block; font-family: 'JetBrains Mono', var(--font-mono, monospace);
  font-size: 0.8rem; color: #fff; background: var(--color-text);
  padding: 6px 14px; border: 4px solid var(--color-text);
  margin-bottom: 20px; transform: rotate(-2deg);
  letter-spacing: 2px; text-transform: uppercase;
}
.bold-hero h1 {
  font-family: var(--font-heading); font-size: 4.5rem; font-weight: 800;
  line-height: 1; letter-spacing: -3px; margin-bottom: 20px;
}
.bold-hero .highlight {
  color: var(--color-accent); position: relative; display: inline-block;
}
.bold-hero .highlight::after {
  content: ''; position: absolute; bottom: 4px; left: -4px; right: -4px;
  height: 14px; background: #FBBF24; opacity: 0.5; z-index: -1; transform: rotate(-1deg);
}
.bold-hero-subtitle {
  font-size: 1.15rem; color: var(--color-text-muted); line-height: 1.7;
  margin-bottom: 32px; max-width: 460px;
}
.bold-hero-visual {
  position: relative; display: flex; justify-content: center; align-items: center;
  animation: boldSlideRight 0.8s ease-out;
}
.avatar-frame {
  width: 340px; height: 340px;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-alt));
  border: 4px solid var(--color-text); box-shadow: 6px 6px 0px var(--color-text);
  display: flex; justify-content: center; align-items: center;
  transform: rotate(3deg); position: relative; overflow: hidden;
}
.avatar-frame .avatar-text {
  font-family: var(--font-heading); font-weight: 800; color: #fff;
  font-size: 6rem; letter-spacing: -4px; text-shadow: 3px 3px 0 rgba(0,0,0,0.2);
}
.avatar-frame img { width: 100%; height: 100%; object-fit: cover; }
.floating-tag {
  position: absolute; font-family: 'JetBrains Mono', var(--font-mono, monospace);
  font-size: 0.75rem; font-weight: 500; padding: 8px 14px;
  border: 3px solid var(--color-text); box-shadow: 4px 4px 0px var(--color-text);
  animation: bobble 3s infinite ease-in-out; white-space: nowrap;
}
.floating-tag.tag-1 { top: -10px; right: -30px; background: #FBBF24; transform: rotate(5deg); }
.floating-tag.tag-2 { bottom: 40px; left: -50px; background: #34D399; animation-delay: -1s; transform: rotate(-3deg); }
.floating-tag.tag-3 { bottom: -15px; right: 20px; background: #A78BFA; color: #fff; animation-delay: -2s; transform: rotate(2deg); }
@keyframes bobble { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes boldSlideLeft { from { opacity: 0; transform: translateX(-60px); } to { opacity: 1; transform: translateX(0); } }
@keyframes boldSlideRight { from { opacity: 0; transform: translateX(60px); } to { opacity: 1; transform: translateX(0); } }
@media (max-width: 768px) {
  .bold-hero { grid-template-columns: 1fr; text-align: center; min-height: auto; padding: 20px 0; }
  .bold-hero h1 { font-size: 3rem; }
  .bold-hero-subtitle { margin: 0 auto 32px; }
  .bold-hero-visual { order: -1; }
  .avatar-frame { width: 240px; height: 240px; }
  .avatar-frame .avatar-text { font-size: 4rem; }
  .floating-tag.tag-2 { left: -20px; }
}

/* ===== Bold Resume — Marquee ===== */
.bold-marquee-wrapper {
  overflow: hidden; border-top: 3px solid var(--color-text);
  border-bottom: 3px solid var(--color-text); background: var(--color-text);
  padding: 14px 0; margin-bottom: 80px;
}
.bold-marquee { display: flex; animation: boldMarquee 30s linear infinite; width: max-content; }
.bold-marquee span {
  font-family: var(--font-heading); font-weight: 800; font-size: 1.1rem;
  color: #fff; text-transform: uppercase; letter-spacing: 4px;
  padding: 0 40px; white-space: nowrap;
}
[data-theme="dark"] .bold-marquee span { color: var(--color-bg); }
.bold-marquee .sep { color: var(--color-accent); font-size: 1.4rem; padding: 0 20px; }
@keyframes boldMarquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

/* ===== Bold Resume — Section Headers ===== */
.bold-section-header { display: flex; align-items: center; gap: 16px; margin-bottom: 40px; }
.bold-section-number {
  font-family: var(--font-heading); font-weight: 800; font-size: 3rem;
  color: var(--color-accent); opacity: 0.3; line-height: 1;
}
.bold-section-title {
  font-family: var(--font-heading); font-weight: 800; font-size: 2.2rem;
  letter-spacing: -1px; position: relative;
}
.bold-section-title::after {
  content: ''; display: block; width: 60px; height: 5px;
  background: var(--color-accent); margin-top: 8px;
}

/* ===== Bold Resume — Experience Cards ===== */
.bold-timeline { display: flex; flex-direction: column; gap: 28px; }
.exp-card {
  background: var(--color-bg-card); border: 4px solid var(--color-text);
  box-shadow: 6px 6px 0px var(--color-text); padding: 32px;
  position: relative; transition: all 0.2s;
}
.exp-card:hover { transform: translate(-4px, -4px); box-shadow: 10px 10px 0 var(--color-text); }
.exp-card-year {
  position: absolute; top: -14px; left: 24px;
  font-family: 'JetBrains Mono', var(--font-mono, monospace); font-size: 0.75rem; font-weight: 500;
  background: var(--color-accent-alt); color: #fff;
  padding: 4px 12px; border: 3px solid var(--color-text); letter-spacing: 1px;
}
.exp-role { font-family: var(--font-heading); font-weight: 700; font-size: 1.3rem; letter-spacing: -0.5px; }
.exp-company {
  font-family: 'JetBrains Mono', var(--font-mono, monospace); font-size: 0.85rem;
  color: var(--color-accent); font-weight: 500;
}
.exp-desc { color: var(--color-text-muted); line-height: 1.7; font-size: 0.95rem; margin: 12px 0 16px; }
.exp-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.exp-tag {
  font-family: 'JetBrains Mono', var(--font-mono, monospace); font-size: 0.7rem;
  padding: 4px 10px; border: 2px solid var(--color-text); background: var(--color-bg);
  font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;
}

/* ===== Bold Resume — Skills Cards ===== */
.bold-skills-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 24px;
}
.skill-card {
  background: var(--color-bg-card); border: 4px solid var(--color-text);
  box-shadow: 6px 6px 0px var(--color-text); padding: 28px;
  transition: all 0.2s; position: relative; overflow: hidden;
}
.skill-card:hover { transform: translate(-3px, -3px); box-shadow: 9px 9px 0 var(--color-text); }
.skill-card h3 {
  font-family: var(--font-heading); font-weight: 700; font-size: 1.15rem;
  margin-bottom: 12px; letter-spacing: -0.5px;
}
.skill-list {
  list-style: none; display: flex; flex-wrap: wrap; gap: 6px;
  padding: 0; margin: 0 0 16px;
}
.skill-list li {
  font-family: 'JetBrains Mono', var(--font-mono, monospace); font-size: 0.7rem;
  padding: 4px 10px; background: var(--color-bg); border: 2px solid var(--color-line);
  font-weight: 500;
}
.skill-bar-item { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.skill-bar-label {
  font-family: 'JetBrains Mono', var(--font-mono, monospace); font-size: 0.72rem;
  font-weight: 500; min-width: 80px; text-align: right; color: var(--color-text-muted);
}
.skill-bar-track {
  flex: 1; height: 14px; background: var(--color-bg);
  border: 2px solid var(--color-text); position: relative; overflow: hidden;
}
.skill-bar-fill { height: 100%; transition: width 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94); width: 0; }

/* ===== Bold Resume — Projects ===== */
.bold-projects-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
.project-card {
  background: var(--color-bg-card); border: 4px solid var(--color-text);
  box-shadow: 6px 6px 0px var(--color-text); overflow: hidden; transition: all 0.2s;
}
.project-card:hover { transform: translate(-4px, -4px) rotate(-0.5deg); box-shadow: 10px 10px 0 var(--color-text); }
.project-preview {
  height: 180px; display: flex; justify-content: center; align-items: center;
  font-family: var(--font-heading); font-weight: 800; font-size: 3rem;
  color: #fff; letter-spacing: -2px; position: relative; overflow: hidden;
}
.project-preview .pattern {
  position: absolute; inset: 0; opacity: 0.15;
  background-image: repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.3) 20px, rgba(255,255,255,0.3) 40px);
}
.project-card:nth-child(1) .project-preview { background: linear-gradient(135deg, #EC4899, #9333EA); }
.project-card:nth-child(2) .project-preview { background: linear-gradient(135deg, #0891B2, #0284C7); }
.project-card:nth-child(3) .project-preview { background: linear-gradient(135deg, #FB923C, #EC4899); }
.project-card:nth-child(4) .project-preview { background: linear-gradient(135deg, #0F172A, #0891B2); }
.project-card:nth-child(5) .project-preview { background: linear-gradient(135deg, #A78BFA, #6366f1); }
.project-card:nth-child(6) .project-preview { background: linear-gradient(135deg, #34D399, #059669); }
.project-info { padding: 24px; }
.project-info h3 {
  font-family: var(--font-heading); font-weight: 700; font-size: 1.15rem;
  margin-bottom: 8px; letter-spacing: -0.5px;
}
.project-info p { color: var(--color-text-muted); font-size: 0.9rem; line-height: 1.6; margin-bottom: 14px; }
@media (max-width: 768px) { .bold-projects-grid { grid-template-columns: 1fr; } }

/* ===== Bold Resume — Education ===== */
.edu-card {
  background: var(--color-bg-card); border: 4px solid var(--color-text);
  box-shadow: 6px 6px 0px var(--color-text); padding: 32px;
  display: flex; gap: 24px; align-items: center; transition: all 0.2s;
}
.edu-card:hover { transform: translate(-3px, -3px); box-shadow: 9px 9px 0 var(--color-text); }
.edu-icon {
  width: 72px; height: 72px; flex-shrink: 0;
  background: linear-gradient(135deg, var(--color-accent-alt), var(--color-accent));
  border: 3px solid var(--color-text); display: flex;
  justify-content: center; align-items: center;
  font-family: var(--font-heading); font-weight: 800; font-size: 1.3rem; color: #fff;
}
.edu-info h3 { font-family: var(--font-heading); font-weight: 700; font-size: 1.2rem; letter-spacing: -0.5px; }
.edu-info .edu-school {
  font-family: 'JetBrains Mono', var(--font-mono, monospace); font-size: 0.85rem;
  color: var(--color-accent); font-weight: 500; margin: 4px 0;
}
.edu-info .edu-detail { color: var(--color-text-muted); font-size: 0.9rem; }
@media (max-width: 768px) { .edu-card { flex-direction: column; text-align: center; } }

/* ===== Bold Resume — Contact ===== */
.bold-contact { text-align: center; padding: 60px 0; }
.bold-contact h2 {
  font-family: var(--font-heading); font-weight: 800; font-size: 3rem;
  letter-spacing: -2px; margin-bottom: 16px;
}
.bold-contact p { color: var(--color-text-muted); font-size: 1.05rem; margin-bottom: 36px; }
.bold-contact-links { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; }
.contact-chip {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: 'JetBrains Mono', var(--font-mono, monospace); font-size: 0.85rem; font-weight: 500;
  padding: 12px 24px; background: var(--color-bg-card); border: 4px solid var(--color-text);
  box-shadow: 4px 4px 0px var(--color-text); text-decoration: none;
  color: var(--color-text); transition: all 0.15s;
}
.contact-chip:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 var(--color-text); background: #FBBF24; }
@media (max-width: 768px) { .bold-contact h2 { font-size: 2.2rem; } }

/* ===== Bold Resume — Footer ===== */
.bold-footer {
  text-align: center; padding: 32px; border-top: 3px solid var(--color-text);
  font-family: 'JetBrains Mono', var(--font-mono, monospace); font-size: 0.8rem;
  color: var(--color-text-muted);
}

/* ===== Bold Resume — Scroll Reveal ===== */
.bold-reveal { opacity: 0; transform: translateY(40px); transition: all 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
.bold-reveal.visible { opacity: 1; transform: translateY(0); }

/* Hide generic card/badge/section-heading in bold resume */
.avatar-glow { display: none; }
`;
  } else if (theme === "tpl-resume-dark") {
    bgEffects = `
.dark-resume-bg {
  position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden;
}
.dark-resume-bg .blob { position: absolute; border-radius: 50%; filter: blur(80px); }
.dark-resume-bg .blob-1 {
  width: 400px; height: 400px; background: rgba(94,106,210,0.08);
  top: -15%; right: -10%; animation: floatDark 15s ease-in-out infinite;
}
.dark-resume-bg .blob-2 {
  width: 350px; height: 350px; background: rgba(139,92,246,0.06);
  bottom: -10%; left: -5%; animation: floatDark 12s ease-in-out infinite reverse;
}
.dark-resume-bg .blob-3 {
  width: 250px; height: 250px; background: rgba(52,211,153,0.04);
  top: 50%; left: 40%; animation: floatDark 18s ease-in-out infinite;
}
@keyframes floatDark { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-30px); } }

/* Dark resume — pill nav, grain texture overlay */
body::after {
  content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 9999;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
.section-heading {
  background: var(--color-bg-card) !important; display: inline-block;
  padding: 0.4rem 1.2rem !important; border-radius: 999px !important;
  border: 1px solid var(--color-line) !important; font-size: 0.85rem !important;
  letter-spacing: 0.1em; text-transform: uppercase;
}
.badge { border-radius: 999px !important; }
`;
  } else if (theme === "tpl-blog") {
    bgEffects = `
/* ===== Blog Theme — Dark Mode ===== */
[data-theme="dark"] {
  --color-bg: #0f0e0c;
  --color-bg-card: #1e1c19;
  --color-bg-card-solid: #1e1c19;
  --color-bg-tag: rgba(184,92,56,0.15);
  --color-text: #ede8e0;
  --color-text-muted: #a8a29e;
  --color-accent: #d4825e;
  --color-accent-soft: rgba(212,130,94,0.15);
  --color-accent-alt: #b85c38;
  --color-line: rgba(255,255,255,0.08);
}

/* ===== Blog Theme — Grain Overlay ===== */
.blog-grain {
  position: fixed; inset: 0; pointer-events: none; z-index: 9999;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ===== Blog Theme — Navigation ===== */
.blog-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 900;
  transition: background 0.4s, box-shadow 0.4s;
}
.blog-nav.scrolled {
  background: rgba(253,251,247,0.88);
  backdrop-filter: blur(24px) saturate(1.2); -webkit-backdrop-filter: blur(24px) saturate(1.2);
  box-shadow: 0 1px 0 var(--color-line);
}
[data-theme="dark"] .blog-nav.scrolled {
  background: rgba(15,14,12,0.88);
}
.blog-nav-inner {
  max-width: 1120px; margin: 0 auto; padding: 0 36px;
  height: 72px; display: flex; align-items: center; justify-content: space-between;
}
.blog-nav-brand {
  font-family: var(--font-heading); font-size: 22px; font-weight: 700;
  letter-spacing: -0.5px; color: var(--color-accent);
}
.blog-nav-links {
  display: flex; align-items: center; gap: 28px; list-style: none;
}
.blog-nav-links a, .blog-nav-links button {
  font-size: 14px; font-weight: 500; color: var(--color-text-muted);
  transition: color 0.25s; position: relative; text-decoration: none;
  background: none; border: none; cursor: pointer; font-family: var(--font-sans);
}
.blog-nav-links a::after {
  content: ''; position: absolute; bottom: -4px; left: 0;
  width: 0; height: 2px; background: var(--color-accent);
  border-radius: 1px; transition: width 0.3s ease;
}
.blog-nav-links a:hover { color: var(--color-accent); }
.blog-nav-links a:hover::after { width: 100%; }
.blog-nav-links button:hover { color: var(--color-accent); }
.blog-theme-toggle {
  width: 38px; height: 38px; border-radius: 50%;
  border: 1.5px solid var(--color-line); background: transparent;
  color: var(--color-text-muted); cursor: pointer; font-size: 17px;
  display: flex; align-items: center; justify-content: center; transition: all 0.25s;
}
.blog-theme-toggle:hover { border-color: var(--color-accent); color: var(--color-accent); }
@media (max-width: 768px) { .blog-nav-links { display: none; } }

/* ===== Blog Theme — Hero ===== */
.blog-hero {
  max-width: 1120px; margin: 0 auto; padding: 160px 36px 100px;
  display: flex; align-items: center; gap: 64px;
}
.blog-hero-avatar-wrap { flex-shrink: 0; position: relative; }
.blog-hero-avatar-wrap::before {
  content: ''; position: absolute; inset: -8px; border-radius: 50%;
  border: 2px dashed var(--color-line); animation: blogSpin 40s linear infinite;
}
@keyframes blogSpin { to { transform: rotate(360deg); } }
.blog-hero-avatar {
  width: 200px; height: 200px; border-radius: 50%; overflow: hidden;
  box-shadow: 0 12px 40px rgba(28,25,23,0.08);
  border: 4px solid var(--color-bg-card);
}
.blog-hero-avatar img { width: 100%; height: 100%; object-fit: cover; }
.blog-hero-avatar .avatar-placeholder {
  width: 100%; height: 100%;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-alt));
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-heading); font-size: 72px; font-weight: 700; color: white;
}
.blog-hero-info { flex: 1; }
.blog-hero-hello {
  font-family: 'IBM Plex Mono', var(--font-mono); font-size: 14px;
  color: var(--color-accent); margin-bottom: 12px; letter-spacing: 0.5px;
}
.blog-hero-name {
  font-family: var(--font-heading); font-size: 52px; font-weight: 700;
  line-height: 1.12; letter-spacing: -1.5px; margin-bottom: 8px;
}
.blog-hero-tagline {
  font-size: 20px; color: var(--color-text-muted); margin-bottom: 20px; font-weight: 400;
}
.blog-hero-bio {
  font-size: 16px; color: var(--color-text-muted); max-width: 500px;
  line-height: 1.8; margin-bottom: 28px;
}
.blog-hero-socials { display: flex; gap: 12px; }
.blog-social-btn {
  width: 44px; height: 44px; border-radius: 50%;
  border: 1.5px solid var(--color-line); display: flex;
  align-items: center; justify-content: center; font-size: 16px;
  color: var(--color-text-muted); transition: all 0.3s ease;
  background: transparent; text-decoration: none;
}
.blog-social-btn:hover {
  border-color: var(--color-accent); color: var(--color-accent);
  transform: translateY(-3px); box-shadow: 0 6px 16px var(--color-accent-soft);
}
@media (max-width: 768px) {
  .blog-hero { flex-direction: column; text-align: center; padding: 130px 24px 60px; gap: 36px; }
  .blog-hero-name { font-size: 36px; }
  .blog-hero-tagline { font-size: 17px; }
  .blog-hero-bio { margin: 0 auto 28px; }
  .blog-hero-socials { justify-content: center; }
  .blog-hero-avatar { width: 150px; height: 150px; }
}

/* ===== Blog Theme — Sections ===== */
.blog-section {
  max-width: 1120px; margin: 0 auto; padding: 80px 36px;
}
.blog-section-header { margin-bottom: 48px; }
.blog-section-label {
  font-family: 'IBM Plex Mono', var(--font-mono); font-size: 13px;
  color: var(--color-accent); text-transform: uppercase;
  letter-spacing: 1.5px; margin-bottom: 8px;
}
.blog-section-title {
  font-family: var(--font-heading); font-size: 36px; font-weight: 700;
  letter-spacing: -0.5px;
}
.blog-section-line {
  width: 40px; height: 3px; background: var(--color-accent);
  border-radius: 2px; margin-top: 16px;
}
.blog-section-alt {
  background: var(--color-bg-card-solid); max-width: 100%;
  transition: background 0.4s ease; padding: 80px 36px;
}
[data-theme="dark"] .blog-section-alt { background: rgba(30,28,25,0.5); }
@media (max-width: 768px) {
  .blog-section { padding: 56px 24px; }
  .blog-section-alt { padding: 56px 24px; }
  .blog-section-title { font-size: 28px; }
}

/* ===== Blog Theme — About ===== */
.blog-about {
  max-width: 720px; font-size: 17px; line-height: 2;
  color: var(--color-text-muted); white-space: pre-wrap;
}

/* ===== Blog Theme — Skills ===== */
.blog-skills-wrap { display: flex; flex-wrap: wrap; gap: 12px; }
.blog-skill-tag {
  padding: 10px 24px; background: var(--color-bg-card);
  border: 1.5px solid var(--color-line); border-radius: 100px;
  font-size: 14px; font-weight: 500; color: var(--color-text-muted);
  transition: all 0.3s ease; cursor: default;
}
.blog-skill-tag:hover {
  border-color: var(--color-accent); color: var(--color-accent);
  transform: translateY(-2px); box-shadow: 0 4px 12px var(--color-accent-soft);
}

/* ===== Blog Theme — Projects Grid ===== */
.blog-projects-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 28px;
}
.blog-project-card {
  background: var(--color-bg-card); border-radius: 16px; padding: 32px;
  border: 1px solid var(--color-line); transition: all 0.35s ease;
  cursor: default; position: relative; overflow: hidden;
  display: flex; flex-direction: column;
}
.blog-project-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--color-accent); transform: scaleX(0); transform-origin: left;
  transition: transform 0.4s ease;
}
.blog-project-card:hover { transform: translateY(-6px); box-shadow: 0 12px 40px rgba(28,25,23,0.08); }
.blog-project-card:hover::before { transform: scaleX(1); }
.blog-project-icon {
  width: 48px; height: 48px; border-radius: 12px;
  background: var(--color-accent-soft); display: flex;
  align-items: center; justify-content: center; font-size: 22px; margin-bottom: 20px;
}
.blog-project-name {
  font-family: var(--font-heading); font-size: 20px; font-weight: 700;
  margin-bottom: 10px;
}
.blog-project-desc {
  font-size: 15px; color: var(--color-text-muted); line-height: 1.7;
  margin-bottom: 18px; flex: 1;
}
.blog-project-tech { display: flex; flex-wrap: wrap; gap: 6px; }
.blog-project-tech span {
  font-size: 12px; font-family: 'IBM Plex Mono', var(--font-mono);
  padding: 4px 10px; border-radius: 6px; background: var(--color-bg-tag);
  color: var(--color-text-muted); font-weight: 500;
}
@media (max-width: 768px) { .blog-projects-grid { grid-template-columns: 1fr; } }

/* ===== Blog Theme — Experience Timeline ===== */
.blog-timeline { position: relative; padding-left: 32px; }
.blog-timeline::before {
  content: ''; position: absolute; left: 7px; top: 8px; bottom: 8px;
  width: 2px; background: var(--color-line);
}
.blog-timeline-item { position: relative; margin-bottom: 40px; }
.blog-timeline-item:last-child { margin-bottom: 0; }
.blog-timeline-item::before {
  content: ''; position: absolute; left: -29px; top: 8px;
  width: 12px; height: 12px; border-radius: 50%;
  border: 3px solid var(--color-accent); background: var(--color-bg);
}
.blog-timeline-period {
  font-family: 'IBM Plex Mono', var(--font-mono); font-size: 13px;
  color: var(--color-accent); margin-bottom: 4px;
}
.blog-timeline-role { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
.blog-timeline-company { font-size: 15px; color: var(--color-text-muted); margin-bottom: 8px; }
.blog-timeline-desc { font-size: 15px; color: var(--color-text-muted); line-height: 1.7; }

/* ===== Blog Theme — Education ===== */
.blog-edu-card {
  background: var(--color-bg-card); border: 1px solid var(--color-line);
  border-radius: 16px; padding: 28px 32px; display: flex; gap: 20px;
  align-items: center; transition: all 0.3s ease; margin-bottom: 16px;
}
.blog-edu-card:last-child { margin-bottom: 0; }
.blog-edu-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(28,25,23,0.06); }
.blog-edu-icon {
  width: 56px; height: 56px; flex-shrink: 0; border-radius: 50%;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-alt));
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-heading); font-weight: 700; font-size: 18px; color: white;
}
.blog-edu-info h3 { font-family: var(--font-heading); font-size: 17px; font-weight: 700; }
.blog-edu-school {
  font-family: 'IBM Plex Mono', var(--font-mono); font-size: 13px;
  color: var(--color-accent); font-weight: 500; margin: 2px 0;
}
.blog-edu-detail { font-size: 14px; color: var(--color-text-muted); }
@media (max-width: 768px) { .blog-edu-card { flex-direction: column; text-align: center; } }

/* ===== Blog Theme — Contact ===== */
.blog-contact-box {
  background: var(--color-bg-card); border: 1px solid var(--color-line);
  border-radius: 20px; padding: 48px; text-align: center; max-width: 600px;
}
.blog-contact-box p {
  font-size: 17px; color: var(--color-text-muted); line-height: 1.8; margin-bottom: 28px;
}
.blog-contact-btn {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 14px 36px; background: var(--color-accent); color: white;
  border-radius: 100px; font-size: 15px; font-weight: 600;
  font-family: var(--font-sans); border: none; cursor: pointer;
  transition: all 0.3s ease; box-shadow: 0 4px 16px var(--color-accent-soft);
  text-decoration: none;
}
.blog-contact-btn:hover {
  transform: translateY(-2px); box-shadow: 0 8px 28px rgba(184,92,56,0.3);
}

/* ===== Blog Theme — Footer ===== */
.blog-footer {
  border-top: 1px solid var(--color-line); padding: 40px 36px;
  transition: border-color 0.4s;
}
.blog-footer-inner {
  max-width: 1120px; margin: 0 auto; display: flex;
  align-items: center; justify-content: space-between;
}
.blog-footer-copy { font-size: 14px; color: var(--color-text-muted); }
@media (max-width: 768px) {
  .blog-footer-inner { flex-direction: column; gap: 16px; text-align: center; }
}

/* ===== Blog Theme — Scroll Reveal ===== */
.blog-reveal {
  opacity: 0; transform: translateY(32px);
  transition: opacity 0.7s ease, transform 0.7s ease;
}
.blog-reveal.visible { opacity: 1; transform: translateY(0); }
.blog-reveal-d1 { transition-delay: 0.1s; }
.blog-reveal-d2 { transition-delay: 0.2s; }
.blog-reveal-d3 { transition-delay: 0.3s; }
.blog-reveal-d4 { transition-delay: 0.4s; }

/* ===== Blog Theme — Scrollbar ===== */
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: var(--color-bg); }
::-webkit-scrollbar-thumb { background: var(--color-line); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--color-text-muted); }
`;
  } else if (theme === "minimalist") {
    bgEffects = `
/* ===== Minimalist — Dark Mode ===== */
[data-theme="dark"] {
  --color-bg: #0a0a0f;
  --color-bg-card: rgba(255,255,255,0.04);
  --color-bg-card-solid: #141420;
  --color-bg-tag: rgba(255,255,255,0.06);
  --color-text: #f0f0f5;
  --color-text-muted: #8888a0;
  --color-accent: #f0f0f5;
  --color-accent-soft: rgba(240,240,245,0.08);
  --color-accent-alt: #a0a0b8;
  --color-line: rgba(255,255,255,0.08);
  --color-green: #34d399;
}

/* ===== Minimalist — Sticky Navigation ===== */
.mini-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  background: rgba(255,255,255,0.88); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--color-line);
  padding: 0 2rem; display: flex; justify-content: space-between; align-items: center; height: 60px;
}
[data-theme="dark"] .mini-nav { background: rgba(10,10,15,0.85); }
.mini-nav-logo { font-weight: 700; font-size: 1.1rem; color: var(--color-text); letter-spacing: -0.02em; }
.mini-nav-links { display: flex; gap: 1.5rem; align-items: center; list-style: none; }
.mini-nav-links a, .mini-nav-links button {
  font-size: 0.875rem; font-weight: 500; color: var(--color-text-muted);
  text-decoration: none; transition: color 0.2s; background: none; border: none; cursor: pointer;
}
.mini-nav-links a:hover, .mini-nav-links button:hover { color: var(--color-text); }
.mini-theme-toggle {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 50%;
  background: none; border: 1px solid var(--color-line); cursor: pointer;
  color: var(--color-text-muted); transition: color 0.2s, border-color 0.2s;
}
.mini-theme-toggle:hover { color: var(--color-text); border-color: var(--color-text); }

/* ===== Minimalist — Hero Background Aurora ===== */
.mini-hero-bg {
  position: fixed; top: 0; left: 0; right: 0; height: 100vh;
  pointer-events: none; z-index: 0;
  background:
    radial-gradient(ellipse 60% 50% at 50% 40%, rgba(200,180,255,0.3) 0%, transparent 70%),
    radial-gradient(ellipse 40% 40% at 65% 50%, rgba(255,200,220,0.2) 0%, transparent 60%),
    radial-gradient(ellipse 40% 30% at 35% 55%, rgba(200,230,255,0.2) 0%, transparent 60%);
}
[data-theme="dark"] .mini-hero-bg {
  background:
    radial-gradient(ellipse 60% 50% at 50% 35%, rgba(100,80,180,0.15) 0%, transparent 70%),
    radial-gradient(ellipse 40% 40% at 60% 45%, rgba(140,60,120,0.1) 0%, transparent 60%),
    radial-gradient(ellipse 40% 30% at 40% 50%, rgba(60,80,160,0.08) 0%, transparent 60%);
}

/* ===== Minimalist — Hero Section ===== */
.mini-hero {
  position: relative; z-index: 1;
  padding: 10rem 2rem 4rem; max-width: 800px; margin: 0 auto; text-align: center;
}
.mini-hero-badge {
  display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.35rem 1rem; border-radius: 999px;
  background: var(--color-bg-card-solid); border: 1px solid var(--color-line);
  font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 1.5rem;
}
.mini-hero-badge .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--color-green); }
.mini-hero h1 {
  font-size: 3.5rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1.1;
  color: var(--color-text); margin-bottom: 1rem;
}
.mini-hero .subtitle {
  font-size: 1.1rem; color: var(--color-text-muted); margin-bottom: 1.5rem;
  max-width: 560px; margin-left: auto; margin-right: auto; line-height: 1.7;
}
.mini-hero-buttons { display: flex; gap: 0.75rem; justify-content: center; margin-top: 2rem; }
.mini-btn-primary {
  display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.7rem 1.6rem; border-radius: 999px;
  background: var(--color-text); color: var(--color-bg); font-weight: 600; font-size: 0.9rem;
  text-decoration: none; border: none; cursor: pointer;
  transition: opacity 0.2s, transform 0.2s;
}
.mini-btn-primary:hover { opacity: 0.85; transform: translateY(-1px); }
.mini-btn-secondary {
  display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.7rem 1.6rem; border-radius: 999px;
  background: transparent; color: var(--color-text); font-weight: 600; font-size: 0.9rem;
  text-decoration: none; border: 1px solid var(--color-line); cursor: pointer;
  transition: border-color 0.2s, transform 0.2s;
}
.mini-btn-secondary:hover { border-color: var(--color-text); transform: translateY(-1px); }

/* ===== Minimalist — Scroll Indicator ===== */
.mini-scroll-indicator {
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  margin-top: 3rem; color: var(--color-text-muted); font-size: 0.75rem;
  animation: miniBounce 2s ease-in-out infinite;
}
@keyframes miniBounce { 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(6px); } }

/* ===== Minimalist — Stats Cards ===== */
.mini-stats {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;
  max-width: 900px; margin: 0 auto 4rem; padding: 0 2rem;
}
.mini-stat-card {
  background: var(--color-bg-card); border: 1px solid var(--color-line);
  border-radius: var(--radius-card); padding: 1.25rem 1rem; text-align: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.mini-stat-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.05); }
.mini-stat-value { font-size: 1.5rem; font-weight: 800; color: var(--color-text); margin-bottom: 0.25rem; }
.mini-stat-label { font-size: 0.78rem; color: var(--color-text-muted); }

/* ===== Minimalist — Main Content ===== */
.mini-main { position: relative; z-index: 1; max-width: 900px; margin: 0 auto; padding: 0 2rem 4rem; }
.mini-stats { position: relative; z-index: 1; }

/* ===== Minimalist — Section Heading Override ===== */
.mini-main .section-heading {
  font-size: 1.5rem; font-weight: 700; margin-bottom: 2rem;
  text-align: left; padding-bottom: 0; letter-spacing: -0.02em;
}
.mini-main .section-heading::after { display: none; }
.mini-section-subtitle {
  font-size: 0.9rem; color: var(--color-text-muted); margin-top: -1.5rem; margin-bottom: 2rem;
}

/* ===== Minimalist — About Section ===== */
.mini-about {
  display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 4rem;
}
.mini-about-text { font-size: 0.9rem; color: var(--color-text-muted); line-height: 1.8; }
.mini-about-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }

/* ===== Minimalist — Experience Cards ===== */
.mini-timeline { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 4rem; }
.mini-timeline-card {
  background: var(--color-bg-card); border: 1px solid var(--color-line);
  border-radius: var(--radius-card); padding: 1.5rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.mini-timeline-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.05); }
.mini-timeline-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
.mini-timeline-title { font-weight: 700; font-size: 0.95rem; color: var(--color-text); }
.mini-timeline-date {
  font-size: 0.78rem; color: var(--color-text-muted); background: var(--color-bg-card-solid);
  padding: 0.2rem 0.6rem; border-radius: 999px; white-space: nowrap;
}
.mini-timeline-desc { font-size: 0.85rem; color: var(--color-text-muted); line-height: 1.6; margin-top: 0.5rem; }

/* ===== Minimalist — Project Cards ===== */
.mini-projects-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; margin-bottom: 4rem;
}
.mini-project-card {
  background: var(--color-bg-card); border: 1px solid var(--color-line);
  border-radius: var(--radius-card); overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.mini-project-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.05); }
.mini-project-image { position: relative; height: 160px; overflow: hidden; background: var(--color-bg-card-solid); }
.mini-project-body { padding: 1.25rem; }
.mini-project-title { font-weight: 700; font-size: 0.95rem; color: var(--color-text); margin-bottom: 0.25rem; }
.mini-project-org { font-size: 0.78rem; color: var(--color-text-muted); margin-bottom: 0.5rem; }
.mini-project-desc { font-size: 0.8rem; color: var(--color-text-muted); line-height: 1.6; margin-bottom: 0.75rem; }
.mini-project-tags { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.mini-project-tag {
  font-size: 0.72rem; padding: 0.2rem 0.6rem; border-radius: 999px;
  background: var(--color-bg-card-solid); color: var(--color-text-muted);
  border: 1px solid var(--color-line);
}

/* ===== Minimalist — Skills Grid ===== */
.mini-skills-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 4rem; }
.mini-skill-card {
  background: var(--color-bg-card); border: 1px solid var(--color-line);
  border-radius: var(--radius-card); padding: 1.25rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.mini-skill-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.05); }
.mini-skill-title { font-weight: 700; font-size: 0.9rem; color: var(--color-text); margin-bottom: 0.75rem; }
.mini-skill-tags { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.mini-badge {
  font-size: 0.78rem; font-weight: 500; padding: 0.25rem 0.7rem; border-radius: 999px;
  background: var(--color-bg-card-solid); color: var(--color-text-muted);
  border: 1px solid var(--color-line); display: inline-block;
  transition: color 0.2s, background 0.2s, border-color 0.2s;
}
.mini-badge:hover { color: var(--color-text); background: var(--color-accent-soft); border-color: var(--color-text); }

/* ===== Minimalist — Education ===== */
.mini-edu-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 4rem; }
.mini-edu-card {
  background: var(--color-bg-card); border: 1px solid var(--color-line);
  border-radius: var(--radius-card); padding: 1.25rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.mini-edu-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.05); }

/* ===== Minimalist — Footer ===== */
.mini-footer {
  text-align: center; padding: 2rem; font-size: 0.8rem; color: var(--color-text-muted);
  border-top: 1px solid var(--color-line);
  max-width: 900px; margin: 0 auto;
}

/* ===== Minimalist — Dark Mode Card Overrides ===== */
[data-theme="dark"] .mini-stat-card:hover,
[data-theme="dark"] .mini-timeline-card:hover,
[data-theme="dark"] .mini-project-card:hover,
[data-theme="dark"] .mini-skill-card:hover,
[data-theme="dark"] .mini-edu-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.3); }
[data-theme="dark"] .mini-btn-primary { background: #f0f0f5; color: #0a0a0f; }
[data-theme="dark"] .mini-btn-secondary { border-color: rgba(255,255,255,0.15); color: #f0f0f5; }
[data-theme="dark"] .mini-btn-secondary:hover { border-color: rgba(255,255,255,0.4); }

/* ===== Minimalist — Mobile Responsive ===== */
@media (max-width: 768px) {
  .mini-nav { padding: 0 1rem; }
  .mini-nav-links { gap: 0.75rem; }
  .mini-nav-links a, .mini-nav-links button { font-size: 0.8rem; }
  .mini-hero { padding: 7rem 1.5rem 3rem; }
  .mini-hero h1 { font-size: 2.2rem; }
  .mini-stats { grid-template-columns: repeat(2, 1fr); gap: 0.75rem; padding: 0 1.5rem; }
  .mini-main { padding: 0 1.5rem 3rem; }
  .mini-about { grid-template-columns: 1fr; }
  .mini-projects-grid { grid-template-columns: 1fr; }
  .mini-skills-grid { grid-template-columns: 1fr; }
  .mini-edu-grid { grid-template-columns: 1fr; }
  .mini-hero-buttons { flex-direction: column; align-items: center; }
}
`;
  }

  // Style-specific typography & heading
  let headingStyle = "";
  if (theme === "brutalist") {
    headingStyle = `
h1, h2, h3 { font-family: var(--font-heading); letter-spacing: -0.01em; }
h1 { font-size: 2.5rem; line-height: 1.2; font-weight: 700; }
h2 { font-size: 1.75rem; }
`;
  } else if (theme === "cyberpunk") {
    headingStyle = `
h1, h2, h3 { font-family: var(--font-heading); letter-spacing: 0.05em; text-transform: uppercase; }
.section-heading { text-shadow: 0 0 20px rgba(0,255,240,0.3); }
`;
  } else if (theme === "retro") {
    headingStyle = `
h1, h2, h3 { font-family: var(--font-heading); }
`;
  } else if (theme === "cinematic") {
    headingStyle = `
h1, h2, h3 { font-family: var(--font-heading); letter-spacing: 0.02em; }
h1 { font-size: 3.5rem; line-height: 1.1; font-weight: 300; }
.section-heading { font-weight: 300; letter-spacing: 0.1em; text-transform: uppercase; }
`;
  } else if (theme === "bold-creative") {
    headingStyle = `
h1, h2, h3 { font-family: var(--font-heading); letter-spacing: -0.03em; }
h1 { font-size: 3.5rem; line-height: 1; font-weight: 900; }
`;
  } else if (theme === "editorial") {
    headingStyle = `
h1, h2, h3 { font-family: var(--font-heading); font-weight: 400; }
h1 { font-size: 3rem; line-height: 1.15; font-style: italic; }
.section-heading::after { content: ""; display: block; width: 40px; height: 2px; background: var(--color-accent); margin-top: 0.5rem; }
`;
  } else if (theme === "neo-tokyo") {
    headingStyle = `
h1, h2, h3 { font-family: var(--font-heading); letter-spacing: 0.04em; }
.section-heading { text-shadow: 0 0 15px rgba(255,46,99,0.3); }
`;
  }

  // Badge style per theme
  let badgeCSS = "";
  if (theme === "brutalist") {
    badgeCSS = `
.badge {
  font-size: 0.75rem; font-weight: 500; font-family: var(--font-sans);
  padding: 4px 10px; border-radius: 0;
  background: var(--color-bg-tag); color: var(--color-text-muted);
  border: 1px solid var(--color-line);
  display: inline-block;
}
.badge:hover { color: var(--color-accent); border-color: var(--color-accent); }
`;
  } else if (theme === "cyberpunk") {
    badgeCSS = `
.badge {
  font-size: 0.75rem; font-weight: 500; font-family: var(--font-mono);
  padding: 4px 12px; border-radius: 2px;
  background: rgba(0,255,240,0.06); color: var(--color-accent);
  border: 1px solid rgba(0,255,240,0.2);
  display: inline-block; transition: all 0.2s;
}
.badge:hover { background: rgba(0,255,240,0.12); box-shadow: 0 0 10px rgba(0,255,240,0.15); }
`;
  } else if (theme === "retro") {
    badgeCSS = `
.badge {
  font-size: 0.75rem; font-weight: 600; font-family: var(--font-heading);
  padding: 4px 12px; border-radius: 2px;
  background: var(--color-bg-tag); color: var(--color-text-muted);
  border: 1px solid var(--color-line);
  display: inline-block; transition: all 0.2s;
}
.badge:hover { color: var(--color-accent); border-color: var(--color-accent); }
`;
  } else {
    badgeCSS = `
.badge {
  font-size: 0.8rem; font-weight: 500;
  padding: 5px 12px; border-radius: ${theme === "minimalist" ? "999px" : "var(--radius-card)"};
  background: var(--color-bg-tag);
  color: var(--color-text-muted);
  border: 1px solid var(--color-line);
  transition: transform 0.2s, color 0.2s, background 0.2s, border-color 0.2s;
  display: inline-block;
}
.badge:hover {
  transform: translateY(-2px);
  color: var(--color-accent);
  background: var(--color-accent-soft);
  border-color: var(--color-accent);
}
`;
  }

  // Avatar glow
  const avatarGlow = theme === "cyberpunk"
    ? `.avatar-glow { position: absolute; inset: -8px; border-radius: 50%; background: var(--color-accent); filter: blur(30px); opacity: 0.4; }`
    : theme === "brutalist"
    ? `.avatar-glow { display: none; }`
    : `.avatar-glow { position: absolute; inset: -8px; border-radius: 50%; background: var(--color-accent); filter: blur(30px); opacity: 0.3; }`;

  const showcaseHeroCSS = `
.showcase-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr);
  gap: 32px;
  align-items: center;
}
.showcase-copy { min-width: 0; }
.showcase-kicker {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px; border-radius: 999px; font-size: 0.74rem; font-weight: 600;
  letter-spacing: 0.14em; text-transform: uppercase;
  border: 1px solid var(--color-line); background: var(--color-bg-card);
  color: var(--color-accent); margin-bottom: 18px;
}
.showcase-title {
  font-size: clamp(2.75rem, 6vw, 5.2rem);
  line-height: 0.95; letter-spacing: -0.05em; margin-bottom: 16px;
}
.showcase-subtitle {
  max-width: 640px; font-size: 1rem; line-height: 1.8;
  color: var(--color-text-muted); margin-bottom: 22px;
}
.showcase-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
.showcase-btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 132px; padding: 12px 18px; border-radius: 999px;
  font-size: 0.9rem; font-weight: 600; text-decoration: none; transition: all 0.25s ease;
}
.showcase-btn-primary { background: var(--color-text); color: var(--color-bg); }
.showcase-btn-primary:hover { transform: translateY(-2px); }
.showcase-btn-secondary { border: 1px solid var(--color-line); color: var(--color-text); background: transparent; }
.showcase-btn-secondary:hover { background: var(--color-accent-soft); border-color: var(--color-accent); }
.showcase-tag-row { display: flex; flex-wrap: wrap; gap: 8px; }
.showcase-visual {
  min-height: 360px; position: relative; display: flex; align-items: stretch; justify-content: center;
}
.showcase-terminal,
.showcase-poster-frame,
.showcase-retro-stack,
.showcase-nature-panel,
.showcase-tokyo-panel,
.showcase-orbital-panel {
  width: 100%;
  height: 100%;
}
.showcase-terminal {
  border: 1px solid var(--color-line); border-radius: 24px; overflow: hidden;
  background: rgba(0, 0, 0, 0.45); box-shadow: 0 20px 60px rgba(0,0,0,0.25);
}
.showcase-terminal-bar {
  display: flex; gap: 8px; padding: 14px 16px; border-bottom: 1px solid var(--color-line);
  background: rgba(255,255,255,0.03);
}
.showcase-terminal-bar span { width: 10px; height: 10px; border-radius: 999px; background: var(--color-accent); opacity: 0.75; }
.showcase-terminal-body { padding: 22px; display: flex; flex-direction: column; gap: 10px; font-family: var(--font-mono); }
.showcase-terminal-line { color: #a6f6ff; text-shadow: 0 0 10px rgba(0,255,240,0.3); }
.showcase-poster-frame {
  position: relative; padding: 28px; border-radius: 28px; overflow: hidden;
  border: 1px solid var(--color-line); background: linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
  display: flex; flex-direction: column; justify-content: flex-end; box-shadow: 0 24px 80px rgba(0,0,0,0.3);
}
.showcase-poster-noise {
  position: absolute; inset: 0; opacity: 0.18;
  background-image: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.45) 100%);
}
.showcase-poster-label,
.showcase-poster-title,
.showcase-poster-subtitle { position: relative; z-index: 1; }
.showcase-poster-label {
  margin-bottom: auto; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.2em; font-size: 0.72rem; color: var(--color-accent-alt);
}
.showcase-poster-title { font-size: clamp(2.1rem, 4vw, 3.4rem); line-height: 0.98; color: #fff; }
.showcase-poster-subtitle { margin-top: 10px; color: rgba(255,255,255,0.75); }
.showcase-retro-stack { position: relative; display: flex; align-items: center; justify-content: center; }
.showcase-retro-card {
  position: relative; width: min(100%, 340px); aspect-ratio: 0.9;
  border: 3px solid var(--color-text); background: #f7edd2; box-shadow: 14px 14px 0 rgba(45,45,45,0.2);
  transform: rotate(-4deg); display: flex; align-items: center; justify-content: center;
}
.showcase-retro-shadow {
  position: absolute; inset: auto 24px 24px auto; width: 72%; height: 72%;
  border: 2px dashed var(--color-line); transform: rotate(3deg);
}
.showcase-retro-sticker {
  position: absolute; top: 18px; right: 18px; padding: 8px 12px;
  background: var(--color-accent); color: #fff; font-family: var(--font-heading); transform: rotate(7deg);
}
.showcase-retro-initials {
  font-size: clamp(3.5rem, 9vw, 6rem); font-family: var(--font-heading); letter-spacing: -0.08em;
}
.showcase-nature-panel {
  position: relative; overflow: hidden; border-radius: 32px;
  background: linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0.2));
  border: 1px solid var(--color-line);
}
.showcase-nature-sun {
  position: absolute; top: 30px; right: 34px; width: 72px; height: 72px; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,0.8), rgba(255,255,255,0.1));
}
.showcase-nature-hill {
  position: absolute; left: -10%; right: -10%; border-radius: 50%;
}
.showcase-nature-hill.hill-1 { bottom: -14%; height: 48%; background: #7da06a; }
.showcase-nature-hill.hill-2 { bottom: -28%; height: 54%; background: #4d6d3e; }
.showcase-nature-copy {
  position: absolute; left: 28px; bottom: 28px; z-index: 2;
  padding: 10px 14px; border-radius: 16px; background: rgba(255,255,255,0.72);
  color: #355028; max-width: 70%;
}
.showcase-tokyo-panel {
  position: relative; overflow: hidden; border-radius: 28px;
  border: 1px solid var(--color-line); background: rgba(10, 6, 18, 0.75);
  box-shadow: inset 0 0 40px rgba(255,46,99,0.08), 0 18px 60px rgba(0,0,0,0.3);
}
.showcase-tokyo-grid {
  position: absolute; inset: 0;
  background-image: linear-gradient(rgba(255,46,99,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(8,217,214,0.08) 1px, transparent 1px);
  background-size: 26px 26px;
  mask-image: linear-gradient(180deg, rgba(0,0,0,1), rgba(0,0,0,0.2));
}
.showcase-tokyo-copy {
  position: absolute; inset: auto 24px 24px 24px;
  display: flex; flex-direction: column; gap: 8px; padding: 18px;
  border: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.45);
}
.showcase-tokyo-copy strong { font-size: 1.8rem; color: #fff; }
.showcase-tokyo-copy span { color: #cfc5dc; }
.showcase-tokyo-kicker { color: #08d9d6 !important; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.16em; font-size: 0.7rem; }
.showcase-orbital-panel {
  position: relative; border-radius: 28px; border: 1px solid var(--color-line);
  background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
  overflow: hidden; display: flex; align-items: center; justify-content: center;
}
.showcase-orbital-ring {
  position: absolute; border-radius: 50%; border: 1px solid var(--color-line);
}
.showcase-orbital-ring.ring-1 { width: 240px; height: 240px; }
.showcase-orbital-ring.ring-2 { width: 320px; height: 320px; opacity: 0.4; }
.showcase-orbital-core {
  width: 96px; height: 96px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-weight: 700; color: #fff; background: linear-gradient(135deg, var(--color-accent), var(--color-accent-alt));
}
.sidebar-theme-panel,
.split-theme-panel {
  position: relative; overflow: hidden; border: 1px solid var(--color-line);
  margin-bottom: 18px;
}
.sidebar-theme-panel {
  width: 100%; height: 110px; border-radius: 18px;
  background: linear-gradient(135deg, var(--color-accent-soft), transparent 70%);
}
.sidebar-panel-cyberpunk .sidebar-signal {
  position: absolute; top: 18px; left: 18px; width: 14px; height: 14px; border-radius: 50%;
  background: var(--color-accent); box-shadow: 0 0 16px rgba(0,255,240,0.4);
}
.sidebar-code-line {
  position: absolute; left: 18px; right: 18px; height: 2px; background: rgba(255,255,255,0.18);
}
.sidebar-code-line:nth-of-type(2) { top: 38px; }
.sidebar-code-line:nth-of-type(3) { top: 56px; }
.sidebar-code-line:nth-of-type(4) { top: 74px; }
.sidebar-code-line.short { right: 42%; }
.sidebar-panel-nature .sidebar-leaf {
  position: absolute; width: 58px; height: 28px; border-radius: 999px 999px 0 999px; background: rgba(90,114,71,0.38);
}
.sidebar-panel-nature .leaf-1 { top: 18px; right: 28px; transform: rotate(18deg); }
.sidebar-panel-nature .leaf-2 { top: 40px; right: 68px; transform: rotate(-8deg); }
.sidebar-panel-nature .sidebar-hill {
  position: absolute; left: -10%; right: -10%; bottom: -20px; height: 70px; border-radius: 50%; background: rgba(90,114,71,0.55);
}
.sidebar-panel-retro .sidebar-retro-stamp {
  position: absolute; inset: 50% auto auto 50%; transform: translate(-50%, -50%) rotate(-8deg);
  border: 2px solid var(--color-text); padding: 10px 16px; font-family: var(--font-heading); letter-spacing: 0.2em;
}
.sidebar-panel-tokyo .sidebar-tokyo-grid {
  position: absolute; inset: 0;
  background-image: linear-gradient(rgba(255,46,99,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(8,217,214,0.08) 1px, transparent 1px);
  background-size: 18px 18px;
}
.sidebar-panel-tokyo .sidebar-tokyo-label {
  position: absolute; left: 18px; bottom: 16px; font-family: var(--font-mono); color: #08d9d6; font-size: 0.72rem; letter-spacing: 0.14em;
}
.sidebar-panel-default .sidebar-orbit {
  position: absolute; inset: 20px; border-radius: 50%; border: 1px solid var(--color-line);
}
.sidebar-panel-default .sidebar-orbit::after {
  content: ""; position: absolute; inset: 28px; border-radius: 50%; background: linear-gradient(135deg, var(--color-accent), var(--color-accent-alt));
}
.split-theme-panel {
  width: min(100%, 320px); height: 150px; margin: 0 auto 24px; border-radius: 24px;
  background: linear-gradient(135deg, var(--color-accent-soft), transparent 72%);
}
.split-panel-cinematic .split-frame-line {
  position: absolute; left: 18px; right: 18px; height: 1px; background: rgba(255,255,255,0.18);
}
.split-panel-cinematic .split-frame-line.top { top: 18px; }
.split-panel-cinematic .split-frame-line.bottom { bottom: 18px; }
.split-scene-label {
  position: absolute; left: 18px; bottom: 18px; font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase;
}
.split-panel-orbital .split-orb {
  position: absolute; border-radius: 50%; filter: blur(2px);
}
.split-panel-orbital .orb-a { width: 78px; height: 78px; background: rgba(255,255,255,0.28); top: 18px; left: 26px; }
.split-panel-orbital .orb-b { width: 96px; height: 96px; background: rgba(255,255,255,0.14); bottom: 10px; right: 24px; }
.split-panel-orbital .orb-c { width: 42px; height: 42px; background: var(--color-accent); top: 34px; right: 80px; }
.split-panel-grid .split-grid-scan {
  position: absolute; inset: 0;
  background-image: linear-gradient(rgba(255,46,99,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(8,217,214,0.08) 1px, transparent 1px);
  background-size: 20px 20px;
}
.split-panel-default .split-panel-crest {
  position: absolute; inset: 24px; border-radius: 22px; border: 1px solid var(--color-line);
}
.split-panel-default .split-panel-crest::after {
  content: ""; position: absolute; inset: 24px; border-radius: 50%; background: linear-gradient(135deg, var(--color-accent), var(--color-accent-alt));
}
.theme-hero-cyberpunk .showcase-title,
.theme-hero-neo-tokyo .showcase-title { text-shadow: 0 0 16px rgba(255,255,255,0.1); }
.theme-hero-cyberpunk .showcase-btn-primary {
  background: linear-gradient(90deg, var(--color-accent), var(--color-accent-alt));
  color: #071014; box-shadow: 0 0 26px rgba(0,255,240,0.22);
}
.theme-hero-cinematic .showcase-kicker { background: rgba(255,255,255,0.04); color: var(--color-accent-alt); }
.theme-hero-cinematic .showcase-title { font-family: var(--font-heading); max-width: 8ch; }
.theme-hero-retro .showcase-btn-primary,
.theme-hero-retro .showcase-btn-secondary { border-radius: 10px; }
.theme-hero-retro .showcase-btn-primary { box-shadow: 5px 5px 0 rgba(45,45,45,0.4); }
.theme-hero-nature .showcase-kicker { background: rgba(255,255,255,0.8); color: #355028; }
.theme-hero-nature .showcase-title { max-width: 9ch; }
.theme-hero-gradient-mesh .showcase-btn-primary {
  background: linear-gradient(90deg, var(--color-accent), var(--color-accent-alt)); color: #140f24;
}
.theme-hero-neo-tokyo .showcase-btn-primary {
  background: linear-gradient(90deg, var(--color-accent), var(--color-accent-alt));
  box-shadow: 0 0 30px rgba(255,46,99,0.25);
}
.section-heading {
  position: relative;
}
.section-heading::before {
  content: "";
  display: block;
  width: 120px;
  height: 10px;
  margin-bottom: 14px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--color-accent-soft), transparent);
}
.theme-divider-cyberpunk .section-heading::before,
.theme-divider-neo-tokyo .section-heading::before {
  width: 140px;
  height: 1px;
  box-shadow: 0 0 18px rgba(255,255,255,0.08);
}
.theme-divider-retro .section-heading::before {
  width: 90px;
  height: 12px;
  border-radius: 0;
  background: repeating-linear-gradient(90deg, var(--color-accent), var(--color-accent) 16px, transparent 16px, transparent 24px);
}
.theme-divider-nature .section-heading::before {
  width: 84px;
  height: 16px;
  border-radius: 999px 999px 0 999px;
  background: linear-gradient(90deg, rgba(90,114,71,0.75), rgba(196,168,130,0.35));
}
.theme-divider-cinematic .section-heading::before {
  width: 160px;
  height: 2px;
  background: linear-gradient(90deg, rgba(233,69,96,0.75), rgba(201,169,110,0.2));
}
.theme-divider-glassmorphism .section-heading::before,
.theme-divider-gradient-mesh .section-heading::before {
  width: 112px;
  height: 12px;
  backdrop-filter: blur(10px);
}
@keyframes cyberpunkPulse {
  0%, 100% { transform: translateY(0); box-shadow: 0 0 18px rgba(0,255,240,0.15); }
  50% { transform: translateY(-3px); box-shadow: 0 0 32px rgba(0,255,240,0.24); }
}
@keyframes retroJitter {
  0%, 100% { transform: rotate(-4deg) translate(0, 0); }
  50% { transform: rotate(-5deg) translate(-2px, -2px); }
}
@keyframes natureDrift {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
@keyframes cinematicBreathe {
  0%, 100% { transform: scale(1); opacity: 0.95; }
  50% { transform: scale(1.02); opacity: 1; }
}
@keyframes tokyoSweep {
  0% { transform: translateX(-16px); opacity: 0.55; }
  100% { transform: translateX(16px); opacity: 1; }
}
.theme-hero-cyberpunk .showcase-terminal { animation: cyberpunkPulse 3.2s ease-in-out infinite; }
.theme-hero-retro .showcase-retro-card { animation: retroJitter 4s steps(2, end) infinite; }
.theme-hero-nature .showcase-nature-panel { animation: natureDrift 4.8s ease-in-out infinite; }
.theme-hero-cinematic .showcase-poster-frame { animation: cinematicBreathe 5s ease-in-out infinite; }
.theme-hero-neo-tokyo .showcase-tokyo-copy { animation: tokyoSweep 2.8s ease-in-out infinite alternate; }
@media (max-width: 900px) {
  .showcase-hero { grid-template-columns: 1fr; }
  .showcase-copy { text-align: center; }
  .showcase-actions, .showcase-tag-row { justify-content: center; }
  .showcase-visual { min-height: 280px; }
  .showcase-poster-title { font-size: 2.2rem; }
}
`;

  return bgEffects + headingStyle + badgeCSS + showcaseHeroCSS + `
${avatarGlow}
.timeline-line {
  position: absolute; left: 5px; top: 0; bottom: 0; width: 2px;
  background: linear-gradient(to bottom, var(--color-accent), var(--color-accent-alt), transparent);
}
.timeline-dot {
  width: 12px; height: 12px; border-radius: 50%;
  border: 2px solid var(--color-accent);
  background: var(--color-bg);
  flex-shrink: 0;
}
.timeline-dot-active {
  background: var(--color-accent);
  box-shadow: 0 0 0 4px var(--color-accent-soft);
}
.contact-icon {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  color: var(--color-text-muted); transition: color 0.3s, transform 0.3s;
  text-decoration: none;
}
.contact-icon:hover { color: var(--color-accent); transform: scale(1.15) rotate(5deg); }
`;
}

export function genChatCSS(): string {
  return `
@keyframes slide-in {
  from { opacity: 0; transform: translateY(16px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.animate-in { animation: slide-in 0.25s ease; }
.tooltip-wrapper { position: relative; }
.tooltip-wrapper .tooltip {
  position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%);
  white-space: nowrap; padding: 6px 12px; border-radius: 8px;
  font-size: 12px; font-weight: 500;
  background: var(--color-bg-card-solid); color: var(--color-text);
  border: 1px solid var(--color-line);
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  opacity: 0; pointer-events: none;
  transition: opacity 0.2s, transform 0.2s;
  transform: translateX(-50%) translateY(4px);
}
.tooltip-wrapper:hover .tooltip { opacity: 1; transform: translateX(-50%) translateY(0); }
`;
}

function buildDynamicSuggestions(data: WorkspaceData, _spec?: SiteSpec | null, isEnglish = false): string[] {
  const suggestions: string[] = [];
  const name = isEnglish ? (data.nameEn || data.name) : data.name;

  // Project-specific suggestions
  if (data.projects.length > 0) {
    const p = data.projects[0];
    suggestions.push(isEnglish ? `Tell me about the "${p.title}" project` : `介绍一下「${p.title}」这个项目`);
  }

  // Skill-specific suggestions
  if (data.skills.length > 0) {
    const topSkillGroup = data.skills[0];
    suggestions.push(isEnglish ? `What's your experience with ${topSkillGroup.skills.slice(0, 2).join(" and ")}?` : `你在${topSkillGroup.skills.slice(0, 2).join("和")}方面有什么经验？`);
  }

  // Experience-specific suggestions
  if (data.timeline.length > 0) {
    const latest = data.timeline[0];
    suggestions.push(isEnglish ? `What did you do at ${latest.title}?` : `你在${latest.title}做了什么？`);
  }

  // General fallbacks if we don't have enough
  if (suggestions.length < 3) {
    suggestions.push(isEnglish ? `What makes ${name} stand out?` : `${name}有什么独特之处？`);
  }
  if (suggestions.length < 3) {
    suggestions.push(isEnglish ? "Are you available for collaboration?" : "你现在接受合作吗？");
  }

  return suggestions.slice(0, 3);
}

export function genTranslations(data: WorkspaceData, spec?: SiteSpec | null): string {
  const sectionTitles = getSectionTitles(spec);
  const availableSections = getAvailableSections(data, spec);
  const purpose = spec?.product?.purpose;
  const audience = spec?.product?.targetAudience;
  const aboutSection = findSpecSection(spec, "about");
  const projectsSection = findSpecSection(spec, "projects");
  const timelineSection = findSpecSection(spec, "timeline");
  const contactSection = findSpecSection(spec, "contact");
  const heroSection = findSpecSection(spec, "hero");
  const aboutText = typeof aboutSection?.data?.bio === "string"
    ? aboutSection.data.bio
    : typeof aboutSection?.data?.text === "string"
      ? aboutSection.data.text
      : data.bio;
  const aboutTags = readStringArray(aboutSection?.data?.highlights).length > 0
    ? readStringArray(aboutSection?.data?.highlights)
    : data.bioTags;
  const specProjects = readProjectItems(projectsSection?.data?.items) || data.projects;
  const specProjectsEn = readProjectItems(projectsSection?.data?.items) || (data.projectsEn || data.projects);
  const specTimeline = readTimelineItems(timelineSection?.data?.items) || data.timeline;
  const specTimelineEn = readTimelineItems(timelineSection?.data?.items) || (data.timelineEn || data.timeline);
  const contactHeading = typeof contactSection?.data?.heading === "string" ? contactSection.data.heading : "";
  const contactCta = typeof contactSection?.data?.cta === "string" ? contactSection.data.cta : "";
  const heroTags = readStringArray(heroSection?.data?.highlights).length > 0
    ? readStringArray(heroSection?.data?.highlights)
    : (readStringArray(heroSection?.data?.keywords).length > 0 ? readStringArray(heroSection?.data?.keywords) : data.tags);
  const zh = {
    nav: { projects: "项目经验", timeline: "职业经历", skills: "专业技能", education: "教育背景", contact: "联系方式" },
    hero: {
      lines: buildHeroLines(data, spec, false),
      tags: heroTags,
    },
    sections: {
      about: sectionTitles.about || "关于我",
      projects: sectionTitles.projects || "项目经验",
      timeline: sectionTitles.timeline || "职业经历",
      skills: sectionTitles.skills || "专业技能",
      education: sectionTitles.education || "教育背景",
      contact: sectionTitles.contact || "联系方式",
      testimonials: sectionTitles.testimonials || "客户评价",
      certifications: sectionTitles.certifications || "资质证书",
      mediaMentions: sectionTitles.mediaMentions || "媒体报道",
      caseStudies: sectionTitles.caseStudies || "案例研究",
      awards: sectionTitles.awards || "荣誉奖项",
      publications: sectionTitles.publications || "学术论文",
      volunteer: sectionTitles.volunteer || "志愿服务",
      services: sectionTitles.services || "服务内容",
      pricing: sectionTitles.pricing || "价格方案",
      faq: sectionTitles.faq || "常见问题",
      gallery: sectionTitles.gallery || "作品展示",
      blog: sectionTitles.blog || "博客文章",
    },
    about: { text: aboutText, tags: aboutTags },
    projects: specProjects.map((p, i) => ({ title: p.title, org: p.org, desc: p.desc, tags: p.tags, image: p.image || `/images/project-${i + 1}.png`, link: p.link || "", badge: p.badge || "" })),
    timeline: specTimeline,
    skills: data.skills,
    education: data.education,
    footer: `\u00A9 ${new Date().getFullYear()} ${data.name}. 保留所有权利。`,
    chatbot: {
      title: `${data.name} AI`,
      subtitle: contactHeading || "有什么想问的？",
      welcome: `你好！可以问我关于${data.name}的经历和技能。${purpose ? ` 本站目标：${purpose}。` : ""}`,
      placeholder: "输入你的问题...",
      send: "发送",
      tooltip: "AI 对话",
      suggestions: buildDynamicSuggestions(data, spec, false),
    },
    share: {
      button: "分享",
      title: "邀请好友",
      invite: `欢迎来和 ${data.name} 的 AI 分身聊天`,
      desc: `这里有我的完整简历资料，包括项目经验、专业技能、职业经历等，你可以向我的 AI 分身提任何问题`,
      cta: "点击链接，开始对话 →",
      save: "保存海报",
      copy: "复制链接",
      copied: "已复制！",
      projectTags: data.projects.slice(0, 4).map(p => p.title),
      skillTags: data.skills.flatMap(g => g.skills).slice(0, 6),
    },
    ui: {
      heyIm: `嗨，我是 ${data.name}`,
      welcomeToSite: `欢迎来到 ${data.name} 的个人主页${audience ? `，面向${audience}` : ""}`,
      availableForHire: "开放合作机会",
      letsCollaborate: contactHeading || "一起合作",
      openForOpportunities: contactCta || "期待新机遇",
      contactMe: "联系我",
      scrollDown: "向下滚动",
      viewProject: "查看项目",
      sectionSubtitles: {
        about: "了解更多关于我的信息",
        projects: "我参与的项目和作品",
        timeline: "我的职业发展历程",
        skills: "我掌握的技术和工具",
        education: "我的教育背景",
        contact: "与我取得联系",
      },
      statLabels: {
        projects: "项目",
        skills: "技能",
        experiences: "工作经历",
        education: "教育",
      },
    },
    availableSections,
    links: (data.links || []).map(l => ({ label: l.label, url: l.url, icon: l.icon || "other" })),
  };
  const en = {
    nav: { projects: "Projects", timeline: "Experience", skills: "Skills", education: "Education", contact: "Contact" },
    hero: {
      lines: buildHeroLines(data, spec, true),
      tags: heroTags,
    },
    sections: {
      about: sectionTitles.about || "About Me",
      projects: sectionTitles.projects || "Projects",
      timeline: sectionTitles.timeline || "Experience",
      skills: sectionTitles.skills || "Skills",
      education: sectionTitles.education || "Education",
      contact: sectionTitles.contact || "Contact",
      testimonials: sectionTitles.testimonials || "Testimonials",
      certifications: sectionTitles.certifications || "Certifications",
      mediaMentions: sectionTitles.mediaMentions || "Media Mentions",
      caseStudies: sectionTitles.caseStudies || "Case Studies",
      awards: sectionTitles.awards || "Awards",
      publications: sectionTitles.publications || "Publications",
      volunteer: sectionTitles.volunteer || "Volunteering",
      services: sectionTitles.services || "Services",
      pricing: sectionTitles.pricing || "Pricing",
      faq: sectionTitles.faq || "FAQ",
      gallery: sectionTitles.gallery || "Gallery",
      blog: sectionTitles.blog || "Blog",
    },
    about: { text: aboutText || data.bioEn, tags: aboutTags.length > 0 ? aboutTags : data.bioTagsEn },
    projects: specProjectsEn.map((p, i) => ({ title: p.title, org: p.org, desc: p.desc, tags: p.tags, image: p.image || `/images/project-${i + 1}.png`, link: p.link || "", badge: p.badge || "" })),
    timeline: specTimelineEn,
    skills: data.skillsEn || data.skills,
    education: data.educationEn || data.education,
    footer: `\u00A9 ${new Date().getFullYear()} ${data.nameEn || data.name}. All rights reserved.`,
    chatbot: {
      title: `${data.nameEn || data.name} AI`,
      subtitle: contactHeading || "Ask me anything",
      welcome: `Hi! Ask me about ${data.nameEn || data.name}'s experience and skills.${purpose ? ` Site goal: ${purpose}.` : ""}`,
      placeholder: "Type your question...",
      send: "Send",
      tooltip: "Chat with AI",
      suggestions: buildDynamicSuggestions(data, spec, true),
    },
    share: {
      button: "Share",
      title: "Invite Friends",
      invite: `Chat with ${data.nameEn || data.name}'s AI Avatar`,
      desc: `Here's my full resume — projects, skills, career experience and more. Ask my AI avatar anything!`,
      cta: "Click the link to start chatting →",
      save: "Save Poster",
      copy: "Copy Link",
      copied: "Copied!",
      projectTags: (data.projectsEn || data.projects).slice(0, 4).map(p => p.title),
      skillTags: (data.skillsEn || data.skills).flatMap(g => g.skills).slice(0, 6),
    },
    ui: {
      heyIm: `Hey, I'm ${data.nameEn || data.name}`,
      welcomeToSite: `Welcome to ${(data.nameEn || data.name)}'s portfolio${audience ? ` for ${audience}` : ""}`,
      availableForHire: "Available for hire",
      letsCollaborate: contactHeading || "Let's collaborate",
      openForOpportunities: contactCta || "Open for opportunities",
      contactMe: "Contact Me",
      scrollDown: "Scroll down",
      viewProject: "View Project",
      sectionSubtitles: {
        about: "Learn more about me",
        projects: "Projects and work I've been involved in",
        timeline: "My career journey",
        skills: "Technologies and tools I work with",
        education: "My educational background",
        contact: "Get in touch with me",
      },
      statLabels: {
        projects: "Projects",
        skills: "Skills",
        experiences: "Experiences",
        education: "Education",
      },
    },
    availableSections,
    links: (data.links || []).map(l => ({ label: l.labelEn || l.label, url: l.url, icon: l.icon || "other" })),
  };

  return `
interface TranslationEdu { school: string; degree: string; highlights: string[]; }
interface TranslationProject { title: string; org: string; desc: string; tags: string[]; image: string; link: string; badge: string; }
interface TranslationTimeline { date: string; title: string; desc: string; active?: boolean; }
interface TranslationSkill { title: string; skills: string[]; }
interface TranslationChatbot { title: string; subtitle: string; welcome: string; placeholder: string; send: string; tooltip: string; suggestions: string[]; }
interface TranslationShare { button: string; title: string; invite: string; desc: string; cta: string; save: string; copy: string; copied: string; projectTags: string[]; skillTags: string[]; }
interface TranslationLink { label: string; url: string; icon: string; }
interface TranslationData {
  nav: Record<string, string>;
  hero: { lines: string[]; tags: string[] };
  sections: Record<string, string>;
  about: { text: string; tags: string[] };
  projects: TranslationProject[];
  timeline: TranslationTimeline[];
  skills: TranslationSkill[];
  education: TranslationEdu[];
  footer: string;
  chatbot: TranslationChatbot;
  share: TranslationShare;
  ui: { heyIm: string; welcomeToSite: string; availableForHire: string; letsCollaborate: string; openForOpportunities: string; contactMe: string; scrollDown: string; viewProject: string; sectionSubtitles: Record<string, string>; statLabels: Record<string, string>; };
  availableSections: string[];
  links: TranslationLink[];
}

export const translations: { zh: TranslationData; en: TranslationData } = {
  zh: ${JSON.stringify(zh, null, 2)},
  en: ${JSON.stringify(en, null, 2)},
};

export type Lang = keyof typeof translations;
export type Translations = TranslationData;
`;
}

export function genLanguageProvider(): string {
  return `"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { translations, Lang, Translations } from "@/i18n/translations";

interface LanguageContextType {
  lang: Lang;
  t: Translations;
  toggle: () => void;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "zh",
  t: translations.zh,
  toggle: () => {},
});

export function useLanguage() {
  return useContext(LanguageContext);
}

export default function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("zh");

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    if (saved && translations[saved]) setLang(saved);
  }, []);

  const toggle = () => {
    const next = lang === "zh" ? "en" : "zh";
    setLang(next);
    localStorage.setItem("lang", next);
  };

  return (
    <LanguageContext.Provider value={{ lang, t: translations[lang], toggle }}>
      {children}
    </LanguageContext.Provider>
  );
}
`;
}
