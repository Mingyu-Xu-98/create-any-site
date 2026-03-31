/**
 * Style configuration, layout family mapping, and design intelligence integration.
 * Extracted from generator.ts — Phase 1 refactor.
 */
import type { ThemeStyle, LayoutType, DesignIntelligence } from "./types";

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
