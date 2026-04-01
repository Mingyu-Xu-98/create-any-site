/**
 * Theme Semantics — maps theme names to semantic design properties.
 *
 * Components read semantics to decide rendering behavior instead of
 * switching on theme name strings. This means new themes only need
 * a semantics entry here (or a recipe with ## Semantics), and all
 * components automatically adapt.
 *
 * When a DesignRecipe is available, its semantics take precedence.
 */
import type { ThemeStyle } from "../types";
import type { DesignRecipe } from "../recipes/loader";
import type { SectionContext } from "./types";

export interface ThemeSemantics {
  /** Visual atmosphere */
  mood: string;
  /** Decoration density */
  ornament: "none" | "minimal" | "moderate" | "rich";
  /** Corner style */
  edge: "sharp" | "soft" | "round" | "pill";
  /** Spacing preference */
  density: "compact" | "normal" | "spacious";
  /** Hero visual type */
  heroVisual: "terminal" | "poster" | "orbital" | "nature" | "geometric" | "none";
  /** Card hover effect */
  cardHover: "lift" | "glow" | "border" | "rotate" | "scale" | "none";
  /** Section divider style */
  divider: "line" | "gradient" | "wave" | "dots" | "none";
  /** Motion level */
  motion: "none" | "subtle" | "moderate" | "rich";
  /** Transition speed */
  transition: "fast" | "normal" | "slow";
}

const DEFAULTS: ThemeSemantics = {
  mood: "light-clean",
  ornament: "none",
  edge: "soft",
  density: "normal",
  heroVisual: "none",
  cardHover: "lift",
  divider: "line",
  motion: "subtle",
  transition: "normal",
};

/** Static semantics for legacy themes (when no recipe is available) */
const THEME_SEMANTICS: Partial<Record<ThemeStyle, Partial<ThemeSemantics>>> = {
  cyberpunk:        { mood: "neon-cyber",       ornament: "rich",     edge: "sharp",  density: "compact",  heroVisual: "terminal", cardHover: "glow",   divider: "line",     motion: "moderate", transition: "fast" },
  minimalist:       { mood: "light-clean",      ornament: "none",     edge: "soft",   density: "normal",   heroVisual: "none",     cardHover: "lift",   divider: "line",     motion: "subtle",   transition: "normal" },
  ghibli:           { mood: "warm-organic",      ornament: "rich",     edge: "round",  density: "spacious", heroVisual: "nature",   cardHover: "rotate", divider: "wave",     motion: "moderate", transition: "slow" },
  glassmorphism:    { mood: "luxury-glass",      ornament: "moderate", edge: "round",  density: "normal",   heroVisual: "orbital",  cardHover: "lift",   divider: "gradient", motion: "moderate", transition: "normal" },
  retro:            { mood: "retro-vintage",     ornament: "moderate", edge: "sharp",  density: "normal",   heroVisual: "none",     cardHover: "lift",   divider: "line",     motion: "subtle",   transition: "fast" },
  brutalist:        { mood: "dark-tech",         ornament: "none",     edge: "sharp",  density: "compact",  heroVisual: "none",     cardHover: "border", divider: "none",     motion: "none",     transition: "fast" },
  cinematic:        { mood: "editorial-refined", ornament: "moderate", edge: "sharp",  density: "spacious", heroVisual: "poster",   cardHover: "scale",  divider: "gradient", motion: "moderate", transition: "slow" },
  "bold-creative":  { mood: "bold-creative",     ornament: "moderate", edge: "round",  density: "normal",   heroVisual: "none",     cardHover: "rotate", divider: "dots",     motion: "moderate", transition: "normal" },
  editorial:        { mood: "editorial-refined", ornament: "minimal",  edge: "sharp",  density: "spacious", heroVisual: "poster",   cardHover: "border", divider: "line",     motion: "subtle",   transition: "normal" },
  nature:           { mood: "warm-organic",      ornament: "moderate", edge: "round",  density: "spacious", heroVisual: "nature",   cardHover: "lift",   divider: "wave",     motion: "moderate", transition: "slow" },
  "gradient-mesh":  { mood: "neon-cyber",        ornament: "moderate", edge: "soft",   density: "normal",   heroVisual: "orbital",  cardHover: "lift",   divider: "gradient", motion: "rich",     transition: "normal" },
  "neo-tokyo":      { mood: "neon-cyber",        ornament: "rich",     edge: "sharp",  density: "compact",  heroVisual: "geometric", cardHover: "glow",  divider: "gradient", motion: "moderate", transition: "fast" },
  watercolor:       { mood: "warm-organic",      ornament: "rich",     edge: "pill",   density: "spacious", heroVisual: "none",     cardHover: "lift",   divider: "wave",     motion: "moderate", transition: "slow" },
  "terminal-green": { mood: "dark-tech",         ornament: "none",     edge: "sharp",  density: "compact",  heroVisual: "terminal", cardHover: "border", divider: "line",     motion: "none",     transition: "fast" },
  vaporwave:        { mood: "neon-cyber",        ornament: "rich",     edge: "soft",   density: "normal",   heroVisual: "geometric", cardHover: "glow",  divider: "gradient", motion: "rich",     transition: "normal" },
  "craft-paper":    { mood: "warm-organic",      ornament: "rich",     edge: "soft",   density: "normal",   heroVisual: "none",     cardHover: "lift",   divider: "wave",     motion: "subtle",   transition: "normal" },
  aurora:           { mood: "neon-cyber",        ornament: "moderate", edge: "soft",   density: "normal",   heroVisual: "orbital",  cardHover: "glow",   divider: "gradient", motion: "rich",     transition: "normal" },
  "ink-wash":       { mood: "editorial-refined", ornament: "moderate", edge: "sharp",  density: "spacious", heroVisual: "none",     cardHover: "border", divider: "line",     motion: "subtle",   transition: "slow" },
  "tpl-business":   { mood: "dark-tech",         ornament: "minimal",  edge: "soft",   density: "normal",   heroVisual: "orbital",  cardHover: "lift",   divider: "line",     motion: "subtle",   transition: "normal" },
  "tpl-resume-bold":{ mood: "bold-creative",     ornament: "moderate", edge: "sharp",  density: "normal",   heroVisual: "none",     cardHover: "lift",   divider: "dots",     motion: "moderate", transition: "fast" },
  "tpl-resume-dark":{ mood: "luxury-glass",      ornament: "moderate", edge: "pill",   density: "normal",   heroVisual: "orbital",  cardHover: "lift",   divider: "gradient", motion: "moderate", transition: "normal" },
  "tpl-blog":       { mood: "editorial-refined", ornament: "minimal",  edge: "soft",   density: "spacious", heroVisual: "none",     cardHover: "lift",   divider: "line",     motion: "subtle",   transition: "normal" },
};

/**
 * Get theme semantics. Prefers recipe semantics, falls back to static map.
 */
export function getThemeSemantics(theme: ThemeStyle, recipe?: DesignRecipe | null): ThemeSemantics {
  // Recipe semantics take priority
  if (recipe?.semantics && Object.keys(recipe.semantics).length > 0) {
    return {
      ...DEFAULTS,
      ...recipe.semantics,
    } as ThemeSemantics;
  }
  // Static fallback
  return { ...DEFAULTS, ...(THEME_SEMANTICS[theme] || {}) };
}

/** Convenience: extract semantics from a SectionContext */
export function getSemanticsFromContext(ctx: SectionContext): ThemeSemantics {
  return getThemeSemantics(ctx.theme, ctx.recipe);
}
