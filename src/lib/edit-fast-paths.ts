/**
 * Edit Fast Paths — deterministic edits that skip the LLM.
 *
 * Each fast-path function receives the current fileMap, applies a focused
 * regex-based transform, and returns { changes, summary } or null if
 * it cannot handle the instruction.
 *
 * Principles:
 *  - High confidence only: never guess — return null when unsure.
 *  - Safe fallback: the caller (edit-runtime) falls back to Edit Agent on null.
 *  - Build guard: even fast-path output goes through guardrails + build.
 */

import type { EditIntent } from "@/lib/edit-classifier";
import type { FileChange } from "@/lib/edit-agent";

// ---------------------------------------------------------------------------
// Color presets
// ---------------------------------------------------------------------------

interface ColorPreset {
  name: string;
  accent: string;
  label: string;
}

const COLOR_PRESETS: ColorPreset[] = [
  { name: "indigo",  accent: "#6366f1", label: "靛蓝" },
  { name: "blue",    accent: "#3b82f6", label: "蓝色" },
  { name: "emerald", accent: "#10b981", label: "翠绿" },
  { name: "purple",  accent: "#8b5cf6", label: "紫色" },
  { name: "rose",    accent: "#f43f5e", label: "玫红" },
  { name: "orange",  accent: "#f97316", label: "橙色" },
  { name: "cyan",    accent: "#06b6d4", label: "青色" },
  { name: "amber",   accent: "#f59e0b", label: "琥珀" },
  { name: "teal",    accent: "#14b8a6", label: "蓝绿" },
  { name: "pink",    accent: "#ec4899", label: "粉色" },
];

/** Map Chinese/English color keywords → preset name */
const COLOR_KEYWORD_MAP: Record<string, string> = {
  "蓝": "blue", "blue": "blue",
  "红": "rose", "red": "rose",
  "绿": "emerald", "green": "emerald",
  "紫": "purple", "purple": "purple",
  "橙": "orange", "orange": "orange",
  "粉": "pink", "pink": "pink",
  "青": "cyan", "cyan": "cyan", "teal": "teal",
  "黄": "amber", "yellow": "amber", "gold": "amber",
  "靛": "indigo", "indigo": "indigo",
};

// ---------------------------------------------------------------------------
// Dark/light mode variable maps
// ---------------------------------------------------------------------------

/** Swap to dark mode — replaces common bg/text/card CSS variables */
const DARK_MODE_VARS: Record<string, string> = {
  "--color-bg": "#0f0f1a",
  "--color-background": "#0f0f1a",
  "--color-text": "#e4e4e7",
  "--color-foreground": "#e4e4e7",
  "--color-text-muted": "#a1a1aa",
  "--color-muted": "#a1a1aa",
  "--color-bg-card": "rgba(255, 255, 255, 0.06)",
  "--color-card": "rgba(255, 255, 255, 0.06)",
  "--color-bg-card-solid": "#1a1a2e",
  "--color-line": "rgba(255, 255, 255, 0.1)",
  "--color-border": "rgba(255, 255, 255, 0.1)",
};

/** Swap to light mode — replaces common bg/text/card CSS variables */
const LIGHT_MODE_VARS: Record<string, string> = {
  "--color-bg": "#f8f9fc",
  "--color-background": "#ffffff",
  "--color-text": "#111827",
  "--color-foreground": "#111827",
  "--color-text-muted": "#64748b",
  "--color-muted": "#6b7280",
  "--color-bg-card": "rgba(255, 255, 255, 0.85)",
  "--color-card": "rgba(255, 255, 255, 0.85)",
  "--color-bg-card-solid": "#ffffff",
  "--color-line": "rgba(0, 0, 0, 0.08)",
  "--color-border": "rgba(0, 0, 0, 0.08)",
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Convert hex like #3b82f6 to rgba(59,130,246,alpha) */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Detect current accent color from globals.css @theme block */
function detectCurrentAccent(css: string): string | null {
  const m = css.match(/--color-accent:\s*(#[0-9a-fA-F]{6})/);
  return m ? m[1].toLowerCase() : null;
}

/** Detect if the site is currently dark-themed (bg color is dark) */
function isDarkTheme(css: string): boolean {
  // Look for --color-bg or --color-background with a dark value
  const bgMatch = css.match(/--color-(?:bg|background):\s*(#[0-9a-fA-F]{6})/);
  if (!bgMatch) return false;
  const hex = bgMatch[1];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.4;
}

/**
 * Replace a CSS variable's value inside a @theme { ... } block.
 * Returns the modified CSS, or the original if the variable isn't found.
 */
function replaceCSSVar(css: string, varName: string, newValue: string): string {
  // Match the variable inside @theme { } block
  const pattern = new RegExp(`(${varName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}:\\s*)([^;]+)(;)`, "g");
  return css.replace(pattern, `$1${newValue}$3`);
}

// ---------------------------------------------------------------------------
// Fast-path: color change
// ---------------------------------------------------------------------------

const QUICK_ACTION_COLOR_INSTRUCTION = "换一套配色方案，保持整体风格协调";

const COLOR_KEYWORD_PATTERN = /(?:主色|配色|accent|颜色|色调|改.*?色).*?(蓝|红|绿|紫|橙|粉|青|黄|靛|blue|red|green|purple|orange|pink|cyan|teal|yellow|gold|amber|indigo)/i;
const HEX_COLOR_PATTERN = /(?:改|换|设|用|变).*?(?:颜色|配色|accent|色).*?(#[0-9a-fA-F]{6})/i;

function tryColorChange(
  instruction: string,
  fileMap: Record<string, string>,
): { changes: FileChange[]; summary: string } | null {
  const css = fileMap["src/app/globals.css"];
  if (!css) return null;

  let targetAccent: string | undefined;
  let chosenLabel: string | undefined;

  if (instruction === QUICK_ACTION_COLOR_INSTRUCTION) {
    // Quick action button: pick a random preset different from current
    const currentAccent = detectCurrentAccent(css)?.toLowerCase();
    const candidates = COLOR_PRESETS.filter(
      (p) => p.accent.toLowerCase() !== currentAccent,
    );
    if (candidates.length === 0) return null;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    targetAccent = pick.accent;
    chosenLabel = pick.label;
  } else {
    // Free-form: try to extract hex directly
    const hexMatch = instruction.match(HEX_COLOR_PATTERN);
    if (hexMatch) {
      targetAccent = hexMatch[1];
      chosenLabel = targetAccent;
    } else {
      // Try keyword match
      const kwMatch = instruction.match(COLOR_KEYWORD_PATTERN);
      if (!kwMatch) return null;
      const keyword = kwMatch[1].toLowerCase();
      const presetName = COLOR_KEYWORD_MAP[keyword];
      if (!presetName) return null;
      const preset = COLOR_PRESETS.find((p) => p.name === presetName);
      if (!preset) return null;
      targetAccent = preset.accent;
      chosenLabel = preset.label;
    }
  }

  if (!targetAccent) return null;

  // Apply color changes
  let newCss = css;

  // Replace --color-accent
  newCss = replaceCSSVar(newCss, "--color-accent", targetAccent);

  // Replace --color-accent-soft (rgba version with 0.08 alpha)
  const accentSoft = hexToRgba(targetAccent, 0.08);
  if (newCss.includes("--color-accent-soft")) {
    newCss = replaceCSSVar(newCss, "--color-accent-soft", accentSoft);
  }

  // Replace --color-bg-tag (some templates use this for tag backgrounds)
  if (newCss.includes("--color-bg-tag")) {
    newCss = replaceCSSVar(newCss, "--color-bg-tag", hexToRgba(targetAccent, 0.06));
  }

  // Also update any accent-related shadow variables
  if (newCss.includes("--shadow-accent")) {
    newCss = replaceCSSVar(newCss, "--shadow-accent", `0 4px 24px ${hexToRgba(targetAccent, 0.15)}`);
  }

  if (newCss === css) return null; // nothing changed

  return {
    changes: [{ path: "src/app/globals.css", content: newCss }],
    summary: `配色已更新为${chosenLabel}（${targetAccent}）`,
  };
}

// ---------------------------------------------------------------------------
// Fast-path: dark/light mode toggle
// ---------------------------------------------------------------------------

const DARK_MODE_PATTERN = /(?:暗色|深色|dark\s*mode|夜间|暗黑|黑色主题)/i;
const LIGHT_MODE_PATTERN = /(?:亮色|浅色|light\s*mode|白天|明亮|白色主题)/i;

function tryDarkLightToggle(
  instruction: string,
  fileMap: Record<string, string>,
): { changes: FileChange[]; summary: string } | null {
  const css = fileMap["src/app/globals.css"];
  if (!css) return null;

  const wantDark = DARK_MODE_PATTERN.test(instruction);
  const wantLight = LIGHT_MODE_PATTERN.test(instruction);

  if (!wantDark && !wantLight) return null;

  // Don't apply if already in the requested mode
  const currentlyDark = isDarkTheme(css);
  if (wantDark && currentlyDark) return null;
  if (wantLight && !currentlyDark) return null;

  const varMap = wantDark ? DARK_MODE_VARS : LIGHT_MODE_VARS;
  let newCss = css;

  for (const [varName, value] of Object.entries(varMap)) {
    // Only replace if the variable exists in the CSS
    if (newCss.includes(varName + ":")) {
      newCss = replaceCSSVar(newCss, varName, value);
    }
  }

  if (newCss === css) return null;

  return {
    changes: [{ path: "src/app/globals.css", content: newCss }],
    summary: wantDark ? "已切换到暗色模式" : "已切换到亮色模式",
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Try to handle an edit instruction via a deterministic fast path.
 *
 * Returns { changes, summary } on success, or null if no fast path applies.
 * The caller should fall back to the full Edit Agent flow on null.
 */
export function tryFastPath(
  instruction: string,
  _intent: EditIntent,
  fileMap: Record<string, string>,
): { changes: FileChange[]; summary: string } | null {
  // Try each fast path in order of specificity
  return (
    tryColorChange(instruction, fileMap) ??
    tryDarkLightToggle(instruction, fileMap) ??
    null
  );
}
