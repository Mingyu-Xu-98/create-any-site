/**
 * Style configuration, layout family mapping, and design intelligence integration.
 * Extracted from generator.ts — Phase 1 refactor.
 *
 * Supports two paths:
 *   1. Legacy: STYLE_CONFIG[theme] → ResolvedStyle (existing, always works)
 *   2. Recipe: DesignRecipe → ResolvedStyle (new, richer tokens, layerable)
 */
import type { ThemeStyle, LayoutType, DesignIntelligence } from "./types";
import type { DesignRecipe } from "./recipes/loader";

// ---- Layout family mapping ----

export type LayoutFamily = "single" | "sidebar" | "grid" | "split";

export const LAYOUT_FAMILY: Record<LayoutType, LayoutFamily> = {
  "two-column": "sidebar",
  "split-screen": "split",
  asymmetric: "sidebar",
  "f-shape": "single",
  "z-shape": "single",
  "card-grid": "grid",
  "hero-media": "single",
  masonry: "grid",
  magazine: "grid",
  "fixed-nav": "single",
  "hidden-nav": "single",
  interactive: "single",
  custom: "single",
};

// ---- Resolved style after design intelligence merge ----

export interface ResolvedStyle {
  colors: Record<string, string>;
  fontSans: string;
  fontHeading: string;
  fontImport: string;
  borderRadius: string;
}

// ---- Per-theme style config ----

export const STYLE_CONFIG: Record<
  ThemeStyle,
  { colors: Record<string, string>; fontSans: string; fontHeading: string; borderRadius: string }
> = {
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
    fontSans: '"Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontHeading: '"Cormorant Garamond", Georgia, serif',
    borderRadius: "20px",
  },
  retro: {
    colors: {
      bg: "#f4e8c1", "bg-card": "rgba(244,232,193,0.8)", "bg-card-solid": "#efe0b8",
      "bg-tag": "rgba(160,82,45,0.1)", text: "#2d2d2d", "text-muted": "#6b5b4b",
      accent: "#c0392b", "accent-soft": "rgba(192,57,43,0.1)", "accent-alt": "#d4881c",
      line: "rgba(100,80,50,0.2)", green: "#27ae60",
    },
    fontSans: '"IBM Plex Serif", Georgia, "Times New Roman", serif',
    fontHeading: '"Space Mono", "Courier New", monospace',
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
  watercolor: {
    colors: {
      bg: "#faf6f1", "bg-card": "rgba(255,255,255,0.7)", "bg-card-solid": "#fff8f2",
      "bg-tag": "rgba(155,142,196,0.1)", text: "#3a3550", "text-muted": "#8a82a0",
      accent: "#9b8ec4", "accent-soft": "rgba(155,142,196,0.12)", "accent-alt": "#e8a0bf",
      line: "rgba(155,142,196,0.18)", green: "#7dab8e",
    },
    fontSans: '"Lora", Georgia, "Times New Roman", serif',
    fontHeading: '"Caveat", "Comic Sans MS", cursive',
    borderRadius: "28px",
  },
  "terminal-green": {
    colors: {
      bg: "#0a0a0a", "bg-card": "rgba(0,255,65,0.04)", "bg-card-solid": "#0d1a0d",
      "bg-tag": "rgba(0,255,65,0.08)", text: "#00ff41", "text-muted": "#00aa2a",
      accent: "#00ff41", "accent-soft": "rgba(0,255,65,0.1)", "accent-alt": "#39ff14",
      line: "rgba(0,255,65,0.15)", green: "#00ff41",
    },
    fontSans: '"VT323", "Courier New", monospace',
    fontHeading: '"VT323", "Courier New", monospace',
    borderRadius: "0px",
  },
  vaporwave: {
    colors: {
      bg: "#1a0a2e", "bg-card": "rgba(255,113,206,0.06)", "bg-card-solid": "#2a1040",
      "bg-tag": "rgba(255,113,206,0.1)", text: "#f0e0ff", "text-muted": "#a080c0",
      accent: "#ff71ce", "accent-soft": "rgba(255,113,206,0.12)", "accent-alt": "#01cdfe",
      line: "rgba(255,113,206,0.15)", green: "#05ffa1",
    },
    fontSans: '"Quicksand", -apple-system, BlinkMacSystemFont, sans-serif',
    fontHeading: '"Audiowide", Impact, sans-serif',
    borderRadius: "8px",
  },
  "craft-paper": {
    colors: {
      bg: "#e8d5b7", "bg-card": "rgba(255,248,235,0.8)", "bg-card-solid": "#f0e0c8",
      "bg-tag": "rgba(139,69,19,0.1)", text: "#3e2723", "text-muted": "#795548",
      accent: "#8b4513", "accent-soft": "rgba(139,69,19,0.1)", "accent-alt": "#c0392b",
      line: "rgba(139,69,19,0.2)", green: "#558b2f",
    },
    fontSans: '"Patrick Hand", "Comic Sans MS", cursive',
    fontHeading: '"Permanent Marker", Impact, cursive',
    borderRadius: "4px",
  },
  aurora: {
    colors: {
      bg: "#060d1f", "bg-card": "rgba(0,212,170,0.06)", "bg-card-solid": "#0a1a30",
      "bg-tag": "rgba(0,212,170,0.1)", text: "#e0f0f8", "text-muted": "#6090a8",
      accent: "#00d4aa", "accent-soft": "rgba(0,212,170,0.1)", "accent-alt": "#7b68ee",
      line: "rgba(0,212,170,0.12)", green: "#00d4aa",
    },
    fontSans: '"Outfit", -apple-system, BlinkMacSystemFont, sans-serif',
    fontHeading: '"Outfit", -apple-system, sans-serif',
    borderRadius: "16px",
  },
  "ink-wash": {
    colors: {
      bg: "#f5f0e8", "bg-card": "rgba(255,252,245,0.85)", "bg-card-solid": "#efe8d8",
      "bg-tag": "rgba(44,44,44,0.06)", text: "#2c2c2c", "text-muted": "#6b6560",
      accent: "#2c2c2c", "accent-soft": "rgba(44,44,44,0.08)", "accent-alt": "#c0392b",
      line: "rgba(44,44,44,0.15)", green: "#5a7247",
    },
    fontSans: '"Noto Serif SC", Georgia, "Times New Roman", serif',
    fontHeading: '"Ma Shan Zheng", "STKaiti", "KaiTi", cursive',
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
    fontHeading: "-apple-system, sans-serif",
    borderRadius: "12px",
  },
};

// ---- Design intelligence merge ----

export function applyDesignIntelligence(
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

  // ★ Color overrides from design intelligence (new)
  const c = (intel as any).colorOverrides as Record<string, string> | undefined;
  if (c) {
    for (const [key, val] of Object.entries(c)) {
      if (val && typeof val === "string") colors[key] = val;
    }
  }

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

// ---- Recipe → ResolvedStyle bridge ----

/**
 * Convert a DesignRecipe into a ResolvedStyle compatible with the existing pipeline.
 * This allows recipes to slot into generateFileMap without rewriting everything.
 */
export function recipeToResolvedStyle(recipe: DesignRecipe): ResolvedStyle {
  return {
    colors: { ...recipe.colors },
    fontSans: recipe.typography.body || "-apple-system, sans-serif",
    fontHeading: recipe.typography.heading || "-apple-system, sans-serif",
    fontImport: recipe.typography.import
      ? (recipe.typography.import.startsWith("@import")
        ? recipe.typography.import
        : `@import url('${recipe.typography.import}');`)
      : "",
    borderRadius: recipe.radius.md || "12px",
  };
}

/**
 * Generate extra CSS variables from a recipe (beyond what ResolvedStyle provides).
 * Appended after the base @theme block in genGlobalCSS.
 */
export function recipeExtraCSS(recipe: DesignRecipe): string {
  const lines: string[] = [];

  // Multi-level radius
  lines.push(`  --radius-sm: ${recipe.radius.sm};`);
  lines.push(`  --radius-md: ${recipe.radius.md};`);
  lines.push(`  --radius-lg: ${recipe.radius.lg};`);
  lines.push(`  --radius-full: ${recipe.radius.full};`);

  // Shadows
  lines.push(`  --shadow-sm: ${recipe.shadows.sm};`);
  lines.push(`  --shadow-md: ${recipe.shadows.md};`);
  lines.push(`  --shadow-lg: ${recipe.shadows.lg};`);

  // Mono font
  lines.push(`  --font-mono: ${recipe.typography.mono};`);

  // Type scale
  const ratio = recipe.typography.scaleRatio || 1.25;
  const base = 16;
  lines.push(`  --text-xs: ${(base / ratio / ratio).toFixed(2)}px;`);
  lines.push(`  --text-sm: ${(base / ratio).toFixed(2)}px;`);
  lines.push(`  --text-base: ${base}px;`);
  lines.push(`  --text-lg: ${(base * ratio).toFixed(2)}px;`);
  lines.push(`  --text-xl: ${(base * ratio * ratio).toFixed(2)}px;`);
  lines.push(`  --text-2xl: ${(base * ratio ** 3).toFixed(2)}px;`);
  lines.push(`  --text-3xl: ${(base * ratio ** 4).toFixed(2)}px;`);

  // Spacing scale
  const unit = recipe.spacing.unit || 8;
  lines.push(`  --space-1: ${unit}px;`);
  lines.push(`  --space-2: ${unit * 2}px;`);
  lines.push(`  --space-4: ${unit * 4}px;`);
  lines.push(`  --space-6: ${unit * 6}px;`);
  lines.push(`  --space-8: ${unit * 8}px;`);
  lines.push(`  --space-12: ${unit * 12}px;`);

  return lines.join("\n");
}
