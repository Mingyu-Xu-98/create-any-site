import { exec } from "child_process";
import path from "path";
import type { DesignSystemData, DesignIntelligence } from "./types";

const SCRIPTS_DIR = path.join(process.cwd(), "ui-skill/scripts");
const SEARCH_SCRIPT = path.join(SCRIPTS_DIR, "search.py");

function runPython(args: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const cmd = `python3 "${SEARCH_SCRIPT}" ${args}`;
    exec(cmd, { timeout: 30_000, cwd: SCRIPTS_DIR }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

function runSearch(query: string, domain: string, n = 2): Promise<Record<string, string>[]> {
  return new Promise((resolve) => {
    const escaped = query.replace(/"/g, '\\"');
    const cmd = `python3 "${SEARCH_SCRIPT}" "${escaped}" --domain ${domain} -n ${n} --json`;
    exec(cmd, { timeout: 15_000, cwd: SCRIPTS_DIR }, (err, stdout) => {
      if (err) {
        resolve([]);
        return;
      }
      try {
        const data = JSON.parse(stdout);
        resolve(data.results || []);
      } catch {
        resolve([]);
      }
    });
  });
}

/**
 * Parse the markdown output of --design-system into structured sections.
 */
function parseDesignSystemMarkdown(md: string): {
  pattern: Record<string, string>;
  style: Record<string, string>;
  colors: Record<string, string>;
  typography: Record<string, string>;
  effects: string;
  antiPatterns: string[];
} {
  const sections: Record<string, string> = {};
  let currentSection = "";

  for (const line of md.split("\n")) {
    if (line.startsWith("### ")) {
      currentSection = line.replace("### ", "").trim();
      sections[currentSection] = "";
    } else if (currentSection) {
      sections[currentSection] += line + "\n";
    }
  }

  // Parse Pattern
  const pattern: Record<string, string> = {};
  const patternText = sections["Pattern"] || "";
  for (const line of patternText.split("\n")) {
    const m = line.match(/^- \*\*(.+?):\*\*\s*(.+)/);
    if (m) pattern[m[1].trim()] = m[2].trim();
  }

  // Parse Style
  const style: Record<string, string> = {};
  const styleText = sections["Style"] || "";
  for (const line of styleText.split("\n")) {
    const m = line.match(/^- \*\*(.+?):\*\*\s*(.+)/);
    if (m) style[m[1].trim()] = m[2].trim();
  }

  // Parse Colors from markdown table
  const colors: Record<string, string> = {};
  const colorText = sections["Colors"] || "";
  for (const line of colorText.split("\n")) {
    const m = line.match(/^\|\s*(\w[\w\s]*?)\s*\|\s*(#[0-9A-Fa-f]{6})\s*\|/);
    if (m) colors[m[1].trim()] = m[2].trim();
  }

  // Parse Typography
  const typography: Record<string, string> = {};
  const typoText = sections["Typography"] || "";
  for (const line of typoText.split("\n")) {
    const m = line.match(/^- \*\*(.+?):\*\*\s*(.+)/);
    if (m) typography[m[1].trim()] = m[2].trim();
  }

  // Parse Effects
  const effects = (sections["Key Effects"] || "").trim();

  // Parse Anti-patterns
  const antiPatterns: string[] = [];
  const avoidText = sections["Avoid (Anti-patterns)"] || "";
  for (const line of avoidText.split("\n")) {
    const m = line.match(/^- (.+)/);
    if (m) antiPatterns.push(m[1].trim());
  }

  return { pattern, style, colors, typography, effects, antiPatterns };
}

/**
 * Generate a complete design system using the ui-skill's BM25 engine
 * and reasoning rules. Returns structured data for the frontend.
 */
export async function generateDesignSystem(query: string): Promise<DesignSystemData> {
  // Run design system generation (applies reasoning rules)
  const mdOutput = await runPython(
    `"${query.replace(/"/g, '\\"')}" --design-system -f markdown`
  );

  const parsed = parseDesignSystemMarkdown(mdOutput);

  // Also get full color palette via direct domain search for richer data
  const [colorResults, typoResults, styleResults] = await Promise.all([
    runSearch(query, "color", 1),
    runSearch(query, "typography", 1),
    runSearch(query, "style", 1),
  ]);

  const c = colorResults[0] || {};
  const t = typoResults[0] || {};
  const s = styleResults[0] || {};

  // Merge: prefer design-system parsed data, supplement with domain search details
  return {
    query,
    pattern: {
      name: parsed.pattern["Name"] || "Hero + Features",
      sections: parsed.pattern["Sections"] || "",
      ctaPlacement: parsed.pattern["CTA Placement"] || "",
      colorStrategy: parsed.pattern["Color Strategy"] || "",
      conversionFocus: parsed.pattern["Conversion Focus"] || "",
    },
    style: {
      name: parsed.style["Name"] || s["Style Category"] || "",
      keywords: parsed.style["Keywords"] || s["Keywords"] || "",
      bestFor: parsed.style["Best For"] || s["Best For"] || "",
      cssKeywords: s["CSS/Technical Keywords"] || "",
      designVars: s["Design System Variables"] || "",
      effects: parsed.style["Effects"] || s["Effects & Animation"] || "",
      performance: parsed.style["Performance"] || s["Performance"] || "",
      accessibility: parsed.style["Accessibility"] || s["Accessibility"] || "",
    },
    colors: {
      primary: parsed.colors["Primary"] || c["Primary"] || "#2563EB",
      onPrimary: c["On Primary"] || "#FFFFFF",
      secondary: parsed.colors["Secondary"] || c["Secondary"] || "#3B82F6",
      onSecondary: c["On Secondary"] || "#FFFFFF",
      accent: parsed.colors["CTA"] || c["Accent"] || "#F97316",
      onAccent: c["On Accent"] || "#FFFFFF",
      background: parsed.colors["Background"] || c["Background"] || "#FAFAFA",
      foreground: parsed.colors["Text"] || c["Foreground"] || "#1E293B",
      card: c["Card"] || "#FFFFFF",
      cardForeground: c["Card Foreground"] || "#09090B",
      muted: c["Muted"] || "#E8ECF0",
      mutedForeground: c["Muted Foreground"] || "#64748B",
      border: c["Border"] || "#E4E4E7",
      destructive: c["Destructive"] || "#DC2626",
      onDestructive: c["On Destructive"] || "#FFFFFF",
      ring: c["Ring"] || "#18181B",
    },
    typography: {
      pairingName: t["Font Pairing Name"] || parsed.typography["Heading"] || "",
      headingFont: parsed.typography["Heading"] || t["Heading Font"] || "Inter",
      bodyFont: parsed.typography["Body"] || t["Body Font"] || "Inter",
      mood: t["Mood/Style Keywords"] || "",
      cssImport: t["CSS Import"] || "",
      tailwindConfig: t["Tailwind Config"] || "",
    },
    effects: parsed.effects,
    antiPatterns: parsed.antiPatterns,
  };
}

/**
 * Query design intelligence for a given site type + theme combination.
 * Returns style category and typography hints for the generator.
 */
export async function queryDesignIntelligence(
  siteType: string,
  theme: string,
  customTheme?: string,
): Promise<DesignIntelligence | null> {
  try {
    const query = customTheme || `${siteType} ${theme}`;
    const [styleResults, typoResults, colorResults] = await Promise.all([
      runSearch(query, "style", 1),
      runSearch(query, "typography", 1),
      runSearch(query, "color", 1),
    ]);

    const s = styleResults[0];
    const t = typoResults[0];
    const c = colorResults[0];

    if (!s && !t && !c) return null;

    // Build color overrides from BM25 search results
    const colorOverrides: Record<string, string> = {};
    if (c) {
      if (c["Primary"]) colorOverrides.accent = c["Primary"];
      if (c["Secondary"]) colorOverrides["accent-alt"] = c["Secondary"];
      if (c["Background"]) colorOverrides.bg = c["Background"];
      if (c["Foreground"]) colorOverrides.text = c["Foreground"];
      if (c["Muted Foreground"]) colorOverrides["text-muted"] = c["Muted Foreground"];
      if (c["Card"]) colorOverrides["bg-card"] = c["Card"];
      if (c["Border"]) colorOverrides.line = c["Border"];
    }

    return {
      style: s ? { category: s["Style Category"] || theme } : undefined,
      typography: t ? {
        bodyFont: t["Body Font"],
        headingFont: t["Heading Font"],
        cssImport: t["CSS Import"],
      } : undefined,
      colorOverrides: Object.keys(colorOverrides).length > 0 ? colorOverrides : undefined,
    } as DesignIntelligence & { colorOverrides?: Record<string, string> };
  } catch {
    return null;
  }
}

/**
 * Convert DesignSystemData (from generateDesignSystem) into a recipe layer
 * that can be merged with a base recipe via mergeRecipes().
 */
export function designSystemToRecipeLayer(ds: DesignSystemData): {
  colors: Record<string, string>;
  typography: { heading: string; body: string; import?: string };
  semantics: Record<string, string>;
} {
  const colors: Record<string, string> = {};
  if (ds.colors.primary) colors.accent = ds.colors.primary;
  if (ds.colors.secondary) colors["accent-alt"] = ds.colors.secondary;
  if (ds.colors.background) colors.bg = ds.colors.background;
  if (ds.colors.foreground) colors.text = ds.colors.foreground;
  if (ds.colors.mutedForeground) colors["text-muted"] = ds.colors.mutedForeground;
  if (ds.colors.card) colors["bg-card"] = ds.colors.card;
  if (ds.colors.border) colors.line = ds.colors.border;

  const semantics: Record<string, string> = {};
  if (ds.style.keywords) {
    const kw = ds.style.keywords.toLowerCase();
    if (kw.includes("minimal")) semantics.ornament = "none";
    if (kw.includes("bold") || kw.includes("dramatic")) semantics.ornament = "rich";
    if (kw.includes("luxury") || kw.includes("spacious")) semantics.density = "spacious";
    if (kw.includes("compact") || kw.includes("dense")) semantics.density = "compact";
  }

  return {
    colors,
    typography: {
      heading: ds.typography.headingFont || "",
      body: ds.typography.bodyFont || "",
      import: ds.typography.cssImport || undefined,
    },
    semantics,
  };
}
