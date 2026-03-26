import type { WorkspaceData, UserSelections, ThemeStyle, LayoutType, FeatureFlags, DesignIntelligence } from "./types";

/** Resolve "custom" selections to the closest preset for actual generation */
function resolveSelections(selections: UserSelections): { theme: ThemeStyle; layout: LayoutType } {
  const theme: ThemeStyle = selections.theme === "custom" ? "minimalist" : (selections.theme || "cyberpunk");
  const layout: LayoutType = selections.layout === "custom" ? "card-grid" : (selections.layout || "card-grid");
  return { theme, layout };
}

/** Map each layout to a rendering family for page template selection */
type LayoutFamily = "single" | "sidebar" | "grid" | "split";
const LAYOUT_FAMILY: Record<LayoutType, LayoutFamily> = {
  "two-column": "sidebar",
  "split-screen": "split",
  "asymmetric": "sidebar",
  "f-shape": "single",
  "z-shape": "single",
  "card-grid": "grid",
  "hero-media": "single",
  "masonry": "grid",
  "magazine": "grid",
  "fixed-nav": "single",
  "hidden-nav": "single",
  "interactive": "single",
  "custom": "single",
};

/**
 * Generate all website file contents as a Record<path, content>.
 * Pure function — no I/O side effects. Used both client-side and server-side.
 */
export function generateFileMap(
  data: WorkspaceData,
  selections: UserSelections,
  designIntel?: DesignIntelligence | null,
): Record<string, string> {
  const { theme, layout } = resolveSelections(selections);
  const features = selections.features;
  const files: Record<string, string> = {};

  // If we have design intelligence from ui-ux-pro-max, apply it to override colors/fonts
  const styleConfig = applyDesignIntelligence(theme, designIntel);

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

  files["src/app/layout.tsx"] = genLayout(data, theme, features, styleConfig);
  files["src/app/globals.css"] = customHeader + genGlobalCSS(theme, layout, features, styleConfig);
  files["src/app/page.tsx"] = genPage(data, layout, theme, features);
  files["src/i18n/translations.ts"] = genTranslations(data);
  files["src/components/LanguageProvider.tsx"] = genLanguageProvider();

  files["src/components/ChatBot.tsx"] = genChatBot();
  files["src/app/api/chat/route.ts"] = genChatRoute(data);
  files["src/components/SharePoster.tsx"] = genSharePoster();

  // Dynamic knowledge base for AI chatbot
  files["src/data/knowledge.json"] = JSON.stringify(
    buildKnowledgeChunks(data),
    null,
    2,
  );

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

function genPackageJson(): string {
  return JSON.stringify({
    name: "my-resume",
    version: "1.0.0",
    type: "module",
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: {
      "@tailwindcss/postcss": "^4.2.1",
      "@types/node": "^25.4.0",
      "@types/react": "^19.2.14",
      next: "^16.1.6",
      postcss: "^8.5.8",
      react: "^19.2.4",
      "react-dom": "^19.2.4",
      qrcode: "^1.5.4",
      "@types/qrcode": "^1.5.5",
      tailwindcss: "^4.2.1",
      typescript: "^5.9.3",
    },
  }, null, 2);
}

function genTsConfig(): string {
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

/** Return style-specific background JSX markup */
function getStyleBgMarkup(theme: ThemeStyle): string {
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

function genLayout(data: WorkspaceData, theme: ThemeStyle, features: FeatureFlags, resolved?: ResolvedStyle): string {
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
      minimalist: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
      cinematic: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=Playfair+Display:wght@300;400;700&display=swap",
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
  title: "${data.name} - Resume",
  description: "${data.title}",
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

function genGlobalCSS(theme: ThemeStyle, layout: LayoutType, features: FeatureFlags, resolved?: ResolvedStyle): string {
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

interface ResolvedStyle {
  colors: Record<string, string>;
  fontSans: string;
  fontHeading: string;
  fontImport: string;
  borderRadius: string;
}


/**
 * Merge hardcoded STYLE_CONFIG with DesignIntelligence from ui-ux-pro-max skill.
 */
function applyDesignIntelligence(
  theme: ThemeStyle,
  intel?: DesignIntelligence | null,
): ResolvedStyle {
  const base = STYLE_CONFIG[theme] || STYLE_CONFIG.minimalist;
  if (!intel) return { ...base, fontImport: "" };
  const colors = { ...base.colors };
  const t = intel.typography;
  let fontSans = base.fontSans;
  let fontHeading = base.fontHeading;
  let fontImport = "";

  if (t?.bodyFont) {
    fontSans = `"${t.bodyFont}", ${base.fontSans}`;
  }
  if (t?.headingFont) {
    fontHeading = `"${t.headingFont}", ${base.fontHeading}`;
  }
  if (t?.cssImport) {
    fontImport = t.cssImport;
  }

  return { colors, fontSans, fontHeading, fontImport, borderRadius: base.borderRadius };
}

const STYLE_CONFIG: Record<ThemeStyle, {
  colors: Record<string, string>;
  fontSans: string;
  fontHeading: string;
  borderRadius: string;
}> = {
  cyberpunk: {
    colors: {
      bg: "#0a0a1a", "bg-card": "rgba(10,15,30,0.7)", "bg-card-solid": "#0e1225",
      "bg-tag": "rgba(0,255,240,0.08)", text: "#e0e8f0", "text-muted": "#6b7fa0",
      accent: "#00fff0", "accent-soft": "rgba(0,255,240,0.1)", "accent-alt": "#ff00ff",
      line: "rgba(0,255,240,0.12)", green: "#00ff88",
    },
    fontSans: '"JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace',
    fontHeading: '"JetBrains Mono", "Fira Code", monospace',
    borderRadius: "4px",
  },
  minimalist: {
    colors: {
      bg: "#ffffff", "bg-card": "#f9fafb", "bg-card-solid": "#f3f4f6",
      "bg-tag": "rgba(0,0,0,0.05)", text: "#111827", "text-muted": "#6b7280",
      accent: "#111827", "accent-soft": "rgba(17,24,39,0.06)", "accent-alt": "#4b5563",
      line: "rgba(0,0,0,0.08)", green: "#10b981",
    },
    fontSans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif',
    fontHeading: '"Inter", -apple-system, sans-serif',
    borderRadius: "12px",
  },
  ghibli: {
    colors: {
      bg: "#f5efe6", "bg-card": "rgba(255,253,247,0.78)", "bg-card-solid": "#fffdf7",
      "bg-tag": "rgba(125,155,95,0.12)", text: "#3d3929", "text-muted": "#8a7f6e",
      accent: "#7d9b5f", "accent-soft": "rgba(125,155,95,0.15)", "accent-alt": "#e8a87c",
      line: "rgba(139,119,90,0.18)", green: "#7d9b5f",
    },
    fontSans: '"Noto Serif SC", Georgia, "Times New Roman", serif',
    fontHeading: '"Noto Serif SC", Georgia, serif',
    borderRadius: "20px",
  },
  glassmorphism: {
    colors: {
      bg: "#1a1225", "bg-card": "rgba(255,255,255,0.07)", "bg-card-solid": "rgba(30,20,45,0.9)",
      "bg-tag": "rgba(180,130,200,0.12)", text: "#f0e8f5", "text-muted": "#b0a0c0",
      accent: "#c89bda", "accent-soft": "rgba(180,130,200,0.15)", "accent-alt": "#e8b88a",
      line: "rgba(255,255,255,0.1)", green: "#34d399",
    },
    fontSans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontHeading: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    borderRadius: "20px",
  },
  retro: {
    colors: {
      bg: "#f4e8c1", "bg-card": "rgba(244,232,193,0.8)", "bg-card-solid": "#efe0b8",
      "bg-tag": "rgba(160,82,45,0.1)", text: "#2d2d2d", "text-muted": "#6b5b4b",
      accent: "#c0392b", "accent-soft": "rgba(192,57,43,0.1)", "accent-alt": "#d4881c",
      line: "rgba(100,80,50,0.2)", green: "#27ae60",
    },
    fontSans: 'Georgia, "Times New Roman", "Noto Serif SC", serif',
    fontHeading: '"Courier New", Courier, monospace',
    borderRadius: "2px",
  },
  brutalist: {
    colors: {
      bg: "#1d1d1d", "bg-card": "rgba(255,255,255,0.04)", "bg-card-solid": "#252525",
      "bg-tag": "rgba(255,255,255,0.08)", text: "#e0e0e0", "text-muted": "#888888",
      accent: "#4493f8", "accent-soft": "rgba(68,147,248,0.1)", "accent-alt": "#79c0ff",
      line: "rgba(255,255,255,0.1)", green: "#4493f8",
    },
    fontSans: '"Fira Code", "JetBrains Mono", "SF Mono", Consolas, monospace',
    fontHeading: '"Fira Code", "JetBrains Mono", monospace',
    borderRadius: "0px",
  },
  cinematic: {
    colors: {
      bg: "#0a0a14", "bg-card": "rgba(26,26,46,0.85)", "bg-card-solid": "#1a1a2e",
      "bg-tag": "rgba(233,69,96,0.1)", text: "#e8e0d4", "text-muted": "#7a7580",
      accent: "#e94560", "accent-soft": "rgba(233,69,96,0.12)", "accent-alt": "#c9a96e",
      line: "rgba(233,69,96,0.12)", green: "#c9a96e",
    },
    fontSans: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
    fontHeading: '"Playfair Display", Georgia, serif',
    borderRadius: "4px",
  },
  "bold-creative": {
    colors: {
      bg: "#fffbeb", "bg-card": "#ffffff", "bg-card-solid": "#fff5d6",
      "bg-tag": "rgba(255,107,107,0.12)", text: "#1a1a2e", "text-muted": "#666666",
      accent: "#ff6b6b", "accent-soft": "rgba(255,107,107,0.1)", "accent-alt": "#4d96ff",
      line: "rgba(0,0,0,0.08)", green: "#6bcb77",
    },
    fontSans: '"Space Grotesk", -apple-system, sans-serif',
    fontHeading: '"Space Grotesk", Impact, sans-serif',
    borderRadius: "16px",
  },
  editorial: {
    colors: {
      bg: "#faf9f6", "bg-card": "#ffffff", "bg-card-solid": "#f5f2ec",
      "bg-tag": "rgba(120,100,80,0.08)", text: "#2c2c2c", "text-muted": "#8a8078",
      accent: "#b8860b", "accent-soft": "rgba(184,134,11,0.08)", "accent-alt": "#6b4e3d",
      line: "rgba(120,100,80,0.15)", green: "#6b4e3d",
    },
    fontSans: '"Libre Baskerville", Georgia, "Times New Roman", serif',
    fontHeading: '"Playfair Display", Georgia, serif',
    borderRadius: "2px",
  },
  nature: {
    colors: {
      bg: "#f0ebe3", "bg-card": "rgba(255,252,245,0.85)", "bg-card-solid": "#f5f0e8",
      "bg-tag": "rgba(45,80,22,0.1)", text: "#2d3a1e", "text-muted": "#6b7a5e",
      accent: "#2d5016", "accent-soft": "rgba(45,80,22,0.1)", "accent-alt": "#c4a882",
      line: "rgba(45,80,22,0.15)", green: "#5a7247",
    },
    fontSans: '"Nunito", -apple-system, BlinkMacSystemFont, sans-serif',
    fontHeading: '"Nunito", -apple-system, sans-serif',
    borderRadius: "24px",
  },
  "gradient-mesh": {
    colors: {
      bg: "#0f0f1a", "bg-card": "rgba(255,255,255,0.06)", "bg-card-solid": "rgba(20,15,40,0.9)",
      "bg-tag": "rgba(161,140,209,0.15)", text: "#f0eaf8", "text-muted": "#a090c0",
      accent: "#a18cd1", "accent-soft": "rgba(161,140,209,0.12)", "accent-alt": "#ff9a9e",
      line: "rgba(255,255,255,0.08)", green: "#96fbc4",
    },
    fontSans: '"Plus Jakarta Sans", -apple-system, sans-serif',
    fontHeading: '"Plus Jakarta Sans", -apple-system, sans-serif',
    borderRadius: "16px",
  },
  "neo-tokyo": {
    colors: {
      bg: "#0d0d0d", "bg-card": "rgba(26,10,46,0.8)", "bg-card-solid": "#1a0a2e",
      "bg-tag": "rgba(255,46,99,0.1)", text: "#e0d8f0", "text-muted": "#7a6b90",
      accent: "#ff2e63", "accent-soft": "rgba(255,46,99,0.12)", "accent-alt": "#08d9d6",
      line: "rgba(255,46,99,0.15)", green: "#08d9d6",
    },
    fontSans: '"Noto Sans JP", "JetBrains Mono", sans-serif',
    fontHeading: '"Noto Sans JP", "JetBrains Mono", sans-serif',
    borderRadius: "4px",
  },
  "tpl-business": {
    colors: {
      bg: "#0a0a1a", "bg-card": "rgba(26,16,64,0.7)", "bg-card-solid": "#1a1040",
      "bg-tag": "rgba(108,99,255,0.1)", text: "#e0e0f0", "text-muted": "#8080a0",
      accent: "#6c63ff", "accent-soft": "rgba(108,99,255,0.12)", "accent-alt": "#a855f7",
      line: "rgba(108,99,255,0.15)", green: "#22d3ee",
    },
    fontSans: '"Inter", -apple-system, sans-serif',
    fontHeading: '"Inter", -apple-system, sans-serif',
    borderRadius: "12px",
  },
"tpl-resume-bold": {
    colors: {
      bg: "#FDF2F8", "bg-card": "#ffffff", "bg-card-solid": "#ffffff",
      "bg-tag": "rgba(236,72,153,0.08)", text: "#0F172A", "text-muted": "#64748B",
      accent: "#EC4899", "accent-soft": "rgba(236,72,153,0.1)", "accent-alt": "#0891B2",
      line: "rgba(0,0,0,0.12)", green: "#34D399",
    },
    fontSans: '"Manrope", -apple-system, sans-serif',
    fontHeading: '"Syne", -apple-system, sans-serif',
    borderRadius: "0px",
  },
  "tpl-resume-dark": {
    colors: {
      bg: "#050506", "bg-card": "rgba(17,17,24,0.8)", "bg-card-solid": "#111118",
      "bg-tag": "rgba(94,106,210,0.1)", text: "#e0e0e8", "text-muted": "#6b6b80",
      accent: "#5E6AD2", "accent-soft": "rgba(94,106,210,0.12)", "accent-alt": "#8b5cf6",
      line: "rgba(94,106,210,0.12)", green: "#34d399",
    },
    fontSans: '"Inter", -apple-system, sans-serif',
    fontHeading: '"Inter", -apple-system, sans-serif',
    borderRadius: "999px",
  },
  "tpl-blog": {
    colors: {
      bg: "#fdfbf7", "bg-card": "#ffffff", "bg-card-solid": "#ffffff",
      "bg-tag": "rgba(184,92,56,0.08)", text: "#1c1917", "text-muted": "#57534e",
      accent: "#b85c38", "accent-soft": "rgba(184,92,56,0.12)", "accent-alt": "#d4825e",
      line: "rgba(28,25,23,0.1)", green: "#57534e",
    },
    fontSans: '"Inter", -apple-system, sans-serif',
    fontHeading: '"Fraunces", Georgia, serif',
    borderRadius: "16px",
  },
  custom: {
    colors: {
      bg: "#ffffff", "bg-card": "#f8f8f8", "bg-card-solid": "#f5f5f5",
      "bg-tag": "rgba(0,0,0,0.04)", text: "#111111", "text-muted": "#888888",
      accent: "#111111", "accent-soft": "rgba(0,0,0,0.04)", "accent-alt": "#555555",
      line: "rgba(0,0,0,0.08)", green: "#111111",
    },
    fontSans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontHeading: '-apple-system, sans-serif',
    borderRadius: "12px",
  },
};

function genLightThemeOverride(theme: ThemeStyle): string {
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

function genCardStyle(theme: ThemeStyle): string {
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

function genLayoutCSS(layout: LayoutType, theme: ThemeStyle = "minimalist"): string {
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

function genAnimationCSS(theme: ThemeStyle): string {
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

  return bgEffects + headingStyle + badgeCSS + `
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

function genChatCSS(): string {
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

// ---- Page Generation ----

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
  const needsUseState = layout === "hidden-nav";
  const needsUseEffect = layout === "interactive";
  const reactHooks: string[] = [];
  if (needsUseState) reactHooks.push("useState");
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
    hero = `
        {/* Hero */}
        <section className="max-w-[1100px] mx-auto px-6 pt-20 pb-12${sectionClass ? ` ${sectionClass}` : ""}">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-10">
            <div className="relative w-[120px] h-[120px] shrink-0">
              <div className="avatar-glow" />
              <div className="w-[120px] h-[120px] rounded-full overflow-hidden relative z-10 border-2 border-line">
                <Image src="/images/avatar.png" alt="" width={120} height={120} className="w-full h-full object-cover" unoptimized />
              </div>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{lang === "zh" ? "${data.name}" : "${data.nameEn}"}</h1>
              <p className="text-text-muted">{lang === "zh" ? "${data.title}" : "${data.titleEn}"}</p>
              <div className="flex flex-wrap gap-2 mt-6">
                {t.hero.tags.map((tag) => (<span key={tag} className="badge">{tag}</span>))}
              </div>
            </div>
          </div>
        </section>`;
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
                  <p className="text-sm text-text-muted mb-3 leading-relaxed line-clamp-3">{p.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.tags.map((tag) => (<span key={tag} className="badge text-xs">{tag}</span>))}
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

  return (
    <div className="min-h-screen relative bg-bg text-text">
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

        <main className="content-panel">
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
    <div className="min-h-screen relative bg-bg text-text">
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

        <section className="max-w-[1100px] mx-auto px-6 pt-20 pb-12">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-10">
            <div className="relative w-[120px] h-[120px] shrink-0">
              <div className="avatar-glow" />
              <div className="w-[120px] h-[120px] rounded-full overflow-hidden relative z-10 border-2 border-line">
                <Image src="/images/avatar.png" alt="" width={120} height={120} className="w-full h-full object-cover" unoptimized />
              </div>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{lang === "zh" ? "${data.name}" : "${data.nameEn}"}</h1>
              <p className="text-text-muted">{lang === "zh" ? "${data.title}" : "${data.titleEn}"}</p>
              <div className="flex flex-wrap gap-2 mt-6">
                {t.hero.tags.map((tag) => (<span key={tag} className="badge">{tag}</span>))}
              </div>
            </div>
          </div>
        </section>

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
      <div className="split-layout">
        <div className="split-left">
          <div className="text-center">
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

// ---- Component generators ----

function genTranslations(data: WorkspaceData): string {
  const zh = {
    nav: { projects: "项目经验", timeline: "职业经历", skills: "专业技能", education: "教育背景", contact: "联系方式" },
    hero: {
      lines: [`> Hello World`, `> ${data.name}`, `> ${data.title}`, `> ${data.location} · ${data.email}`],
      tags: data.tags,
    },
    sections: { about: "关于我", projects: "项目经验", timeline: "职业经历", skills: "专业技能", education: "教育背景", contact: "联系方式" },
    about: { text: data.bio, tags: data.bioTags },
    projects: data.projects.map((p, i) => ({ title: p.title, org: p.org, desc: p.desc, tags: p.tags, image: p.image || `/images/project-${i + 1}.png`, link: p.link || "", badge: p.badge || "" })),
    timeline: data.timeline,
    skills: data.skills,
    education: data.education,
    footer: `\u00A9 ${new Date().getFullYear()} ${data.name}. 保留所有权利。`,
    chatbot: {
      title: `${data.name} AI`,
      subtitle: "有什么想问的？",
      welcome: `你好！可以问我关于${data.name}的经历和技能。`,
      placeholder: "输入你的问题...",
      send: "发送",
      tooltip: "AI 对话",
      suggestions: ["你是做什么的？", "介绍一下你的工作经历", "你有哪些专业技能？"],
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
      welcomeToSite: `欢迎来到 ${data.name} 的个人主页`,
      availableForHire: "开放合作机会",
      letsCollaborate: "一起合作",
      openForOpportunities: "期待新机遇",
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
    availableSections: data.visibleSections && data.visibleSections.length > 0
      ? data.visibleSections.filter(s => s !== "links")
      : [
        "about",
        ...(data.projects.length > 0 ? ["projects"] : []),
        ...(data.timeline.length > 0 ? ["timeline"] : []),
        ...(data.skills.length > 0 ? ["skills"] : []),
        ...(data.education.length > 0 ? ["education"] : []),
        "contact",
      ],
    links: (data.links || []).map(l => ({ label: l.label, url: l.url, icon: l.icon || "other" })),
  };
  const en = {
    nav: { projects: "Projects", timeline: "Experience", skills: "Skills", education: "Education", contact: "Contact" },
    hero: {
      lines: [`> Hello World`, `> ${data.nameEn || data.name}`, `> ${data.titleEn || data.title}`, `> ${data.locationEn || data.location} · ${data.email}`],
      tags: data.tagsEn || data.tags,
    },
    sections: { about: "About Me", projects: "Projects", timeline: "Experience", skills: "Skills", education: "Education", contact: "Contact" },
    about: { text: data.bioEn, tags: data.bioTagsEn },
    projects: (data.projectsEn || data.projects).map((p, i) => ({ title: p.title, org: p.org, desc: p.desc, tags: p.tags, image: p.image || `/images/project-${i + 1}.png`, link: p.link || "", badge: p.badge || "" })),
    timeline: data.timelineEn || data.timeline,
    skills: data.skillsEn || data.skills,
    education: data.educationEn || data.education,
    footer: `\u00A9 ${new Date().getFullYear()} ${data.nameEn || data.name}. All rights reserved.`,
    chatbot: {
      title: `${data.nameEn || data.name} AI`,
      subtitle: "Ask me anything",
      welcome: `Hi! Ask me about ${data.nameEn || data.name}'s experience and skills.`,
      placeholder: "Type your question...",
      send: "Send",
      tooltip: "Chat with AI",
      suggestions: ["What do you do?", "Tell me about your projects", "What are your skills?"],
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
      welcomeToSite: `Welcome to ${data.nameEn || data.name}'s portfolio`,
      availableForHire: "Available for hire",
      letsCollaborate: "Let's collaborate",
      openForOpportunities: "Open for opportunities",
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
    availableSections: data.visibleSections && data.visibleSections.length > 0
      ? data.visibleSections.filter(s => s !== "links")
      : [
        "about",
        ...((data.projectsEn || data.projects).length > 0 ? ["projects"] : []),
        ...((data.timelineEn || data.timeline).length > 0 ? ["timeline"] : []),
        ...((data.skillsEn || data.skills).length > 0 ? ["skills"] : []),
        ...((data.educationEn || data.education).length > 0 ? ["education"] : []),
        "contact",
      ],
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

function genLanguageProvider(): string {
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

function genTypewriterHero(): string {
  return `"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "./LanguageProvider";

export default function TypewriterHero() {
  const { t } = useLanguage();
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [done, setDone] = useState(false);
  const lines = t.hero.lines;

  useEffect(() => {
    setDisplayedLines([]); setCurrentLine(0); setCurrentChar(0); setDone(false);
  }, [t]);

  useEffect(() => {
    if (done) return;
    if (currentLine >= lines.length) { setDone(true); return; }
    const line = lines[currentLine];
    if (currentChar < line.length) {
      const timer = setTimeout(() => {
        setDisplayedLines(prev => { const u = [...prev]; u[currentLine] = line.slice(0, currentChar + 1); return u; });
        setCurrentChar(c => c + 1);
      }, 40);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => { setCurrentLine(l => l + 1); setCurrentChar(0); setDisplayedLines(prev => [...prev, ""]); }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentLine, currentChar, done, lines]);

  return (
    <div className="font-mono text-sm md:text-base space-y-1 min-h-[160px]">
      {displayedLines.map((line, i) => (
        <div key={i} className="flex items-start">
          <span className={line.startsWith(">") ? "text-accent" : "text-text-muted"}>
            {line.startsWith("> ") ? (<><span className="text-green mr-2">&gt;</span><span className="text-text">{line.slice(2)}</span></>) : line}
          </span>
          {i === currentLine && !done && <span className="inline-block w-2.5 h-5 bg-accent ml-0.5 animate-pulse" />}
        </div>
      ))}
      {done && <div className="flex items-center"><span className="text-green mr-2">&gt;</span><span className="inline-block w-2.5 h-5 bg-accent animate-pulse" /></div>}
    </div>
  );
}
`;
}

function genThemeToggle(): string {
  return `"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved) { setDark(saved === "dark"); document.documentElement.setAttribute("data-theme", saved); }
  }, []);

  const toggle = () => {
    const next = dark ? "light" : "dark";
    setDark(!dark);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  return (
    <button onClick={toggle} className="text-text-muted hover:text-text p-2 rounded-full border border-line transition-colors" aria-label="Toggle theme">
      {dark ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" strokeWidth={2}/><path strokeWidth={2} d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
      )}
    </button>
  );
}
`;
}

function genParticleBackground(): string {
  return `"use client";

import { useEffect, useRef } from "react";

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; a: number }[] = [];
    const COUNT = 80;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
        a: Math.random() * 0.5 + 0.1,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = \`rgba(0,255,240,\${p.a})\`;
        ctx.fill();
      }
      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = \`rgba(0,255,240,\${0.08 * (1 - dist / 120)})\`;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}
`;
}

function genGrainOverlay(): string {
  return `"use client";

export default function GrainOverlay() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-50 opacity-[0.06]"
      style={{
        backgroundImage: \`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")\`,
        backgroundRepeat: "repeat",
      }}
    />
  );
}
`;
}

function genSharePoster(): string {
  return `"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import QRCode from "qrcode";
import { useLanguage } from "./LanguageProvider";

export default function SharePoster() {
  const { t, lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const share = t.share;

  const drawPoster = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 540;
    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    // --- Read CSS variables for theme-aware rendering ---
    const s = getComputedStyle(document.documentElement);
    const accent = s.getPropertyValue("--color-accent").trim() || "#6366f1";
    const bg = s.getPropertyValue("--color-bg").trim() || "#0a0a0f";
    const textColor = s.getPropertyValue("--color-text").trim() || "#ffffff";
    const mutedColor = s.getPropertyValue("--color-text-muted").trim() || "#9ca3af";
    const fontFamily = s.getPropertyValue("--font-sans").trim() || "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    const fontBase = fontFamily.split(",").slice(0, 2).join(",");
    const cx = W / 2;
    const cardX = 32, cardW = W - 64, cardY = 40;

    // --- Pre-calculate content height ---
    // Use an offscreen measurement pass
    const measureCanvas = document.createElement("canvas");
    measureCanvas.width = W; measureCanvas.height = 100;
    const mCtx = measureCanvas.getContext("2d")!;

    const avatarR = 32;
    // avatar top to name: cardY(40) + 50(avatarY offset) + avatarR(32) + 28 = 150
    let contentH = 50 + avatarR * 2 + 28; // start from cardY
    contentH += 26 + 46; // title + gap to divider
    contentH += 34; // invite text
    contentH += 30; // gap to desc

    mCtx.font = \`13px \${fontBase}\`;
    const descLines = wrapText(mCtx, share.desc, cardW - 80);
    const descLineCount = Math.min(descLines.length, 2);
    contentH += descLineCount * 20 + 20; // desc lines + gap

    const skillTags = (share.skillTags || []).slice(0, 6);
    if (skillTags.length > 0) {
      contentH += 18; // "Skills" header
      mCtx.font = \`12px \${fontBase}\`;
      const maxLineW = cardW - 60;
      let lineW = 0;
      let tagRows = 1;
      skillTags.forEach((tag) => {
        const tw = mCtx.measureText(tag).width + 20 + 5;
        if (lineW + tw > maxLineW && lineW > 0) { tagRows++; lineW = tw; }
        else { lineW += tw; }
      });
      contentH += tagRows * 28 + 12; // tag rows + gap
    }

    // QR code block: 8 padding + 90 qr + 8 padding + 20 text + 24 bottom
    contentH += 8 + 90 + 8 + 20 + 24;

    const cardH = contentH;
    const H = cardY * 2 + cardH;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.scale(dpr, dpr);

    // --- Background gradient ---
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, bg);
    bgGrad.addColorStop(0.5, mixColor(bg, accent, 0.12));
    bgGrad.addColorStop(1, mixColor(bg, accent, 0.2));
    ctx.fillStyle = bgGrad;
    roundRect(ctx, 0, 0, W, H, 0);

    // --- Decorative circles ---
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(W * 0.85, H * 0.1, 110, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W * 0.08, H * 0.8, 80, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // --- Glass card ---
    ctx.save();
    ctx.fillStyle = isLight(bg) ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.06)";
    ctx.strokeStyle = isLight(bg) ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    roundRect(ctx, cardX, cardY, cardW, cardH, 20);
    ctx.stroke();
    ctx.restore();

    // --- Draw rest after avatar loads ---
    const drawContent = (avatarImg?: HTMLImageElement) => {
      const avatarY = cardY + 50;

      if (avatarImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, avatarY, avatarR, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImg, cx - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
        ctx.restore();
        ctx.strokeStyle = isLight(bg) ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.15)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, avatarY, avatarR, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.save();
        ctx.fillStyle = mixColor(accent, bg, 0.3);
        ctx.beginPath(); ctx.arc(cx, avatarY, avatarR, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.arc(cx, avatarY - 6, 13, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx, avatarY + 18, 20, 14, 0, Math.PI, 0, true); ctx.fill();
        ctx.restore();
      }

      // --- Name ---
      const nameY = avatarY + avatarR + 28;
      ctx.fillStyle = textColor;
      ctx.font = \`bold 26px \${fontBase}\`;
      ctx.textAlign = "center";
      const name = lang === "zh" ? t.hero.lines[1]?.replace("> ", "") : t.hero.lines[1]?.replace("> ", "");
      ctx.fillText(name || "", cx, nameY);

      // --- Title ---
      ctx.fillStyle = mutedColor;
      ctx.font = \`14px \${fontBase}\`;
      const title = t.hero.lines[2]?.replace("> ", "") || "";
      ctx.fillText(title, cx, nameY + 26);

      // --- Divider ---
      const divY = nameY + 46;
      const divGrad = ctx.createLinearGradient(cardX + 40, divY, cardX + cardW - 40, divY);
      divGrad.addColorStop(0, "transparent");
      divGrad.addColorStop(0.3, accent);
      divGrad.addColorStop(0.7, accent);
      divGrad.addColorStop(1, "transparent");
      ctx.strokeStyle = divGrad;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cardX + 40, divY);
      ctx.lineTo(cardX + cardW - 40, divY);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // --- Invite text ---
      const inviteY = divY + 34;
      ctx.fillStyle = textColor;
      ctx.font = \`bold 18px \${fontBase}\`;
      ctx.fillText(share.invite, cx, inviteY);

      // --- Description ---
      ctx.fillStyle = mutedColor;
      ctx.font = \`13px \${fontBase}\`;
      const drawnDescLines = wrapText(ctx, share.desc, cardW - 80);
      drawnDescLines.slice(0, 2).forEach((line, i) => {
        ctx.fillText(line, cx, inviteY + 30 + i * 20);
      });

      // --- Skill tags (compact) ---
      let nextY = inviteY + 30 + Math.min(drawnDescLines.length, 2) * 20 + 20;
      if (skillTags.length > 0) {
        ctx.fillStyle = mutedColor;
        ctx.font = \`bold 12px \${fontBase}\`;
        ctx.textAlign = "center";
        ctx.fillText(lang === "zh" ? "\\u{2B50} 专业技能" : "\\u{2B50} Skills", cx, nextY);
        nextY += 18;
        ctx.font = \`12px \${fontBase}\`;
        let totalW = 0;
        const widths = skillTags.map((tag) => { const w = ctx.measureText(tag).width + 20; totalW += w + 5; return w; });
        totalW -= 5;
        const maxLineW = cardW - 60;
        let lineX = cx - Math.min(totalW, maxLineW) / 2;
        let lineW = 0;
        skillTags.forEach((tag, i) => {
          if (lineW + widths[i] > maxLineW && lineW > 0) {
            nextY += 28;
            lineW = 0;
            const remaining = skillTags.slice(i).reduce((s2, _, j) => s2 + widths[i + j] + 5, -5);
            lineX = cx - Math.min(remaining, maxLineW) / 2;
          }
          ctx.fillStyle = isLight(bg) ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)";
          roundRect(ctx, lineX + lineW, nextY, widths[i], 24, 12);
          ctx.fillStyle = textColor;
          ctx.textAlign = "center";
          ctx.fillText(tag, lineX + lineW + widths[i] / 2, nextY + 16);
          lineW += widths[i] + 5;
        });
        nextY += 36;
      }

      // --- QR Code ---
      const qrY = nextY;
      const url = typeof window !== "undefined" ? window.location.href : "";
      if (url) {
        QRCode.toDataURL(url, { width: 200, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
          .then((dataUrl: string) => {
            const qrImg = new Image();
            qrImg.onload = () => {
              const qrSize = 90;
              const qrX = cx - qrSize / 2;
              ctx.fillStyle = "#ffffff";
              roundRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 12);
              ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
              ctx.fillStyle = mutedColor;
              ctx.font = \`12px \${fontBase}\`;
              ctx.textAlign = "center";
              ctx.globalAlpha = 0.6;
              ctx.fillText(lang === "zh" ? "扫码访问" : "Scan to visit", cx, qrY + qrSize + 20);
              ctx.globalAlpha = 1;
            };
            qrImg.src = dataUrl;
          })
          .catch(() => {});
      }
    };

    // Load avatar image, then draw content
    const avatarImg = new Image();
    avatarImg.crossOrigin = "anonymous";
    avatarImg.onload = () => drawContent(avatarImg);
    avatarImg.onerror = () => drawContent();
    avatarImg.src = "/images/avatar.png";
  }, [open, lang, t, share]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(drawPoster, 50);
      return () => clearTimeout(timer);
    }
  }, [open, drawPoster]);

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "share-poster.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <>
      {/* Floating share button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-50 w-12 h-12 rounded-full bg-accent text-white shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:scale-110 transition-all flex items-center justify-center group"
        title={share.button}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        <span className="absolute left-full ml-3 px-3 py-1 bg-bg-card-solid text-text text-sm rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-line">
          {share.button}
        </span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-bg-card-solid rounded-2xl shadow-2xl max-w-[340px] w-full max-h-[90vh] flex flex-col border border-line"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "fadeSlideUp 0.3s ease forwards" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
              <h3 className="font-bold text-lg text-text">{share.title}</h3>
              <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text p-1 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Canvas poster */}
            <div className="px-4 flex justify-center min-h-0 flex-1 overflow-hidden">
              <canvas
                ref={canvasRef}
                className="rounded-xl shadow-inner object-contain"
                style={{ width: "100%", height: "auto", maxHeight: "100%" }}
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 p-4 shrink-0">
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                {share.save}
              </button>
              <button
                onClick={handleCopy}
                className={\`flex-1 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 border \${copied ? "bg-green/10 border-green/30 text-green" : "border-line text-text hover:border-accent/30"}\`}
              >
                {copied ? (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>{share.copied}</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>{share.copy}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// --- Canvas helpers ---

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split("");
  const lines: string[] = [];
  let line = "";
  for (const char of words) {
    const test = line + char;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = char;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function hexToRgb(hex: string): [number, number, number] {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r,g,b].map(v => Math.round(v).toString(16).padStart(2,"0")).join("");
}

function mixColor(c1: string, c2: string, ratio: number): string {
  try {
    const [r1,g1,b1] = hexToRgb(c1);
    const [r2,g2,b2] = hexToRgb(c2);
    return rgbToHex(r1+(r2-r1)*ratio, g1+(g2-g1)*ratio, b1+(b2-b1)*ratio);
  } catch { return c1; }
}

function isLight(hex: string): boolean {
  try {
    const [r,g,b] = hexToRgb(hex);
    return (r*299 + g*587 + b*114) / 1000 > 128;
  } catch { return false; }
}

`;
}

function genChatBot(): string {
  return `"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "./LanguageProvider";

interface Message { role: "user" | "assistant"; content: string; }

export default function ChatBot() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs); setInput(""); setLoading(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: newMsgs }) });
      if (!res.ok) throw new Error();
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let content = "";
      setMessages([...newMsgs, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        content += decoder.decode(value, { stream: true });
        setMessages([...newMsgs, { role: "assistant", content }]);
      }
    } catch {
      setMessages([...newMsgs, { role: "assistant", content: "Sorry, something went wrong." }]);
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <button onClick={() => setOpen(!open)} className="w-14 h-14 rounded-full shadow-lg bg-accent flex items-center justify-center text-white transition-transform hover:scale-105">
          {open ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          )}
        </button>
      </div>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-h-[520px] bg-bg-card-solid border border-line rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in">
          <div className="px-4 py-3 border-b border-line">
            <p className="text-sm font-semibold">{t.chatbot.title}</p>
            <p className="text-xs text-text-muted">{t.chatbot.subtitle}</p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[300px]">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-text-muted text-center py-2">{t.chatbot.welcome}</p>
                <div className="space-y-2">
                  {t.chatbot.suggestions.map((s) => (
                    <button key={s} onClick={() => send(s)} className="w-full text-left text-sm bg-bg-tag hover:bg-accent/10 text-text-muted hover:text-accent px-3 py-2 rounded-lg border border-line hover:border-accent/30 transition-colors">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={\`flex \${msg.role === "user" ? "justify-end" : "justify-start"}\`}>
                <div className={\`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap \${msg.role === "user" ? "bg-accent text-white rounded-br-sm" : "bg-bg-tag text-text rounded-bl-sm"}\`}>
                  {msg.content || (loading && i === messages.length - 1 ? "..." : "")}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="px-4 py-3 border-t border-line">
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t.chatbot.placeholder} disabled={loading} className="flex-1 bg-bg text-text text-sm px-3 py-2 rounded-lg border border-line focus:border-accent focus:outline-none placeholder:text-text-muted disabled:opacity-50" />
              <button type="submit" disabled={loading || !input.trim()} className="bg-accent hover:bg-accent/80 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm transition-colors">{t.chatbot.send}</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
`;
}

function buildKnowledgeChunks(data: WorkspaceData): { chunks: { topic: string; content: string }[] } {
  const chunks: { topic: string; content: string }[] = [];

  // Personal info chunk
  chunks.push({
    topic: "personal",
    content: `Name: ${data.name} (${data.nameEn})\nTitle: ${data.title} (${data.titleEn})\nEmail: ${data.email}\nLocation: ${data.location}\nBio: ${data.bio}\nBio (EN): ${data.bioEn}`,
  });

  // Skills chunk
  if (data.skills.length > 0) {
    chunks.push({
      topic: "skills",
      content: data.skills.map(g => `${g.title}: ${g.skills.join(", ")}`).join("\n"),
    });
  }

  // Projects chunk
  if (data.projects.length > 0) {
    chunks.push({
      topic: "projects",
      content: data.projects.map(p => `${p.title} (${p.org}): ${p.desc} [${p.tags.join(", ")}]`).join("\n"),
    });
  }

  // Work experience chunk
  if (data.timeline.length > 0) {
    chunks.push({
      topic: "experience",
      content: data.timeline.map(t => `${t.date} - ${t.title}: ${t.desc}`).join("\n"),
    });
  }

  // Education chunk
  if (data.education.length > 0) {
    chunks.push({
      topic: "education",
      content: data.education.map(e => `${e.school}, ${e.degree}${e.highlights.length ? ": " + e.highlights.join("; ") : ""}`).join("\n"),
    });
  }

  // Links chunk
  if (data.links && data.links.length > 0) {
    chunks.push({
      topic: "links",
      content: data.links.map(l => `${l.label}: ${l.url}`).join("\n"),
    });
  }

  // Raw knowledge from uploaded files (the full chatbotContext)
  if (data.chatbotContext) {
    // Split into manageable chunks (~2000 chars each)
    const raw = data.chatbotContext;
    const sections = raw.split(/\n## /);
    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed || trimmed.length < 20) continue;
      const firstLine = trimmed.split("\n")[0] || "raw";
      chunks.push({
        topic: firstLine.slice(0, 50).replace(/[^a-zA-Z0-9\u4e00-\u9fff _.-]/g, ""),
        content: trimmed.slice(0, 3000),
      });
    }
  }

  return { chunks };
}

function genChatRoute(data: WorkspaceData): string {
  return `import { NextRequest } from "next/server";
import knowledgeData from "@/data/knowledge.json";

interface KnowledgeChunk {
  topic: string;
  content: string;
}

function findRelevantChunks(question: string, chunks: KnowledgeChunk[]): string {
  const q = question.toLowerCase();

  // Keywords for each topic
  const topicKeywords: Record<string, string[]> = {
    personal: ["name", "who", "介绍", "你是谁", "叫什么", "姓名", "邮箱", "email", "位置", "location"],
    skills: ["skill", "技能", "会什么", "擅长", "技术", "能力", "tools", "framework"],
    projects: ["project", "项目", "做过", "作品", "portfolio", "开发了"],
    experience: ["experience", "work", "经历", "工作", "公司", "company", "career", "job"],
    education: ["education", "school", "学校", "学历", "学位", "university", "毕业"],
    links: ["link", "链接", "github", "网站", "blog", "contact", "联系"],
  };

  // Score each chunk by relevance
  const scored = chunks.map(chunk => {
    let score = 0;
    const keywords = topicKeywords[chunk.topic] || [];
    for (const kw of keywords) {
      if (q.includes(kw)) score += 3;
    }
    // Also check if the question words appear in the content
    const words = q.split(/\\s+/).filter(w => w.length > 1);
    for (const word of words) {
      if (chunk.content.toLowerCase().includes(word)) score += 1;
    }
    return { chunk, score };
  });

  // Sort by score descending, take top relevant chunks
  scored.sort((a, b) => b.score - a.score);

  // Always include personal info + top 3 relevant chunks
  const personal = chunks.find(c => c.topic === "personal");
  const relevant = scored.filter(s => s.score > 0).slice(0, 3).map(s => s.chunk);

  // If no relevant chunks found, include everything (short context fallback)
  if (relevant.length === 0) {
    return chunks.map(c => c.content).join("\\n\\n");
  }

  const selected = personal ? [personal, ...relevant.filter(c => c.topic !== "personal")] : relevant;
  return selected.map(c => c.content).join("\\n\\n");
}

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured. Set SILICONFLOW_API_KEY in .env.local" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  // Dynamic knowledge retrieval — find chunks relevant to the user's question
  const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === "user")?.content || "";
  const relevantKnowledge = findRelevantChunks(lastUserMsg, (knowledgeData as { chunks: KnowledgeChunk[] }).chunks);

  const systemPrompt = \`You are ${data.name}'s AI avatar. Answer based on the following profile knowledge. Use first person. Be concise (under 200 words). If the user speaks Chinese, reply in Chinese. If in English, reply in English.

\${relevantKnowledge}\`;

  const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: \`Bearer \${apiKey}\` },
    body: JSON.stringify({
      model: "Pro/zai-org/GLM-5",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.7, max_tokens: 1024, stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return new Response(JSON.stringify({ error: err }), { status: response.status, headers: { "Content-Type": "application/json" } });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") { controller.close(); return; }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) controller.enqueue(encoder.encode(content));
          } catch {}
        }
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
`;
}

/**
 * Generate the Ghibli image generation script using SiliconFlow's image API.
 * Creates: ghibli-background, avatar, chatbot-spirit, and per-project images.
 */
function genGhibliImageScript(data: WorkspaceData): string {
  // Build project image entries from data
  const projectImages = data.projects.slice(0, 8).map((p, i) => {
    const safeName = `project-${i + 1}.png`;
    const keywords = p.tags.slice(0, 3).join(", ");
    return `  {
    name: "${safeName}",
    prompt: "A Studio Ghibli style watercolor illustration related to ${p.title.replace(/"/g, '\\"')}. Keywords: ${keywords.replace(/"/g, '\\"')}. Warm color palette with sage greens, sky blues, warm creams and golden tones. Hayao Miyazaki inspired painting. Dreamy atmosphere, painterly texture. No characters, no text. 16:9 aspect ratio.",
  },`;
  }).join("\n");

  return `import fs from "fs";
import path from "path";

const API_KEY = process.env.SILICONFLOW_API_KEY || "";
const OUT_DIR = path.resolve("public/images");

const IMAGES = [
  {
    name: "ghibli-background.png",
    prompt: "A wide panoramic Studio Ghibli style landscape painting. Rolling green hills covered in wildflowers, a winding dirt path through meadows, fluffy white cumulus clouds in a soft blue sky, distant mountains with snow-capped peaks, golden sunset light filtering through clouds. Warm watercolor style, dreamy atmosphere, soft color palette with sage greens, sky blues, warm creams and golden tones. Hayao Miyazaki inspired painting. No characters, no text. 16:9 aspect ratio, high resolution.",
  },
  {
    name: "avatar.png",
    prompt: "A cute Studio Ghibli style watercolor painting of an adorable fluffy orange tabby cat sitting upright. The cat has big expressive round eyes, wearing a tiny green leaf scarf. Soft warm lighting, dreamy pastel background with floating dandelion seeds. Miyazaki watercolor illustration style. Circular portrait crop. No text. Square 1:1 ratio.",
  },
  {
    name: "chatbot-spirit.png",
    prompt: "A cute Studio Ghibli style small forest spirit character, round and fluffy, similar to a kodama or small totoro. Soft sage green and white colors, big friendly sparkling eyes, tiny leaf on top of its head. Clean illustration on a warm cream background with soft glow. Kawaii Miyazaki style. No text. Square 1:1 ratio.",
  },
${projectImages}
];

async function generateImage(item) {
  console.log(\`Generating: \${item.name}...\`);
  try {
    const res = await fetch("https://api.siliconflow.cn/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: \`Bearer \${API_KEY}\`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "black-forest-labs/FLUX.1-schnell",
        prompt: item.prompt,
        image_size: item.name === "avatar.png" || item.name === "chatbot-spirit.png" ? "1024x1024" : "1024x576",
        num_inference_steps: 20,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(\`API error for \${item.name}: \${res.status} \${errText}\`);
      return false;
    }

    const data = await res.json();
    const imageUrl = data.images?.[0]?.url;
    if (!imageUrl) {
      console.error(\`No image URL in response for \${item.name}\`);
      return false;
    }

    // Download the image
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      console.error(\`Failed to download image for \${item.name}\`);
      return false;
    }
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const outPath = path.join(OUT_DIR, item.name);
    fs.writeFileSync(outPath, buffer);
    console.log(\`Saved: \${outPath} (\${buffer.length} bytes)\`);
    return true;
  } catch (err) {
    console.error(\`Error generating \${item.name}:\`, err.message);
    return false;
  }
}

async function main() {
  if (!API_KEY) {
    console.error("Please set SILICONFLOW_API_KEY in .env.local");
    process.exit(1);
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const item of IMAGES) {
    const ok = await generateImage(item);
    if (!ok) console.log("  -> Failed, continuing...");
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log("\\nDone! Check public/images/");
}

main();
`;
}
