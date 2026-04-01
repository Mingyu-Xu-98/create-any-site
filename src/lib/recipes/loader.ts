/**
 * Recipe Loader — parse Markdown design recipes and merge layers.
 *
 * A DesignRecipe is a complete set of design tokens parsed from a .md file.
 * Recipes can be layered: base + N layers + agent overrides → final recipe.
 */
import fs from "fs";
import path from "path";

// ---- Types ----

export interface DesignRecipe {
  id: string;
  name?: string;
  category?: string;
  mood?: string[];
  type?: "base" | "layer";

  colors: Record<string, string>;
  typography: {
    heading: string;
    body: string;
    mono: string;
    scaleRatio: number;
    import?: string;
  };
  radius: { sm: string; md: string; lg: string; full: string };
  spacing: { unit: number };
  shadows: { sm: string; md: string; lg: string };
  semantics: Record<string, string>;
  cardCSS: string;
  designNotes: string;
  compositionSuggestion?: string;
}

export interface RecipeIndex {
  id: string;
  name: string;
  category?: string;
  mood?: string[];
  type: "base" | "layer";
  description?: string;
}

// ---- Frontmatter Parser (lightweight, no deps) ----

function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^(\w[\w-]*):\s*(.+)/);
    if (!m) continue;
    const [, key, val] = m;
    // Array: [a, b, c]
    if (val.startsWith("[") && val.endsWith("]")) {
      meta[key] = val.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, ""));
    } else {
      meta[key] = val.trim().replace(/^["']|["']$/g, "");
    }
  }
  return { meta, body: match[2] };
}

// ---- Markdown Section Extractors ----

function extractSection(body: string, heading: string): string {
  const re = new RegExp(`## ${heading}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, "i");
  const m = body.match(re);
  return m ? m[1].trim() : "";
}

function parseMarkdownTable(section: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of section.split("\n")) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/);
    if (m && !m[1].includes("--") && m[1].trim() !== "token" && m[1].trim() !== "key") {
      result[m[1].trim()] = m[2].trim();
    }
  }
  return result;
}

function parseListSection(section: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of section.split("\n")) {
    const m = line.match(/^-\s+(\w[\w-]*):\s*(.+)/);
    if (m) result[m[1].trim()] = m[2].trim();
  }
  return result;
}

function extractCodeBlock(section: string, lang?: string): string {
  const re = lang
    ? new RegExp("```" + lang + "\\s*\\n([\\s\\S]*?)```")
    : /```\w*\s*\n([\s\S]*?)```/;
  const m = section.match(re);
  return m ? m[1].trim() : "";
}

// ---- Recipe Parser ----

export function parseRecipe(raw: string): DesignRecipe {
  const { meta, body } = parseFrontmatter(raw);

  // Colors
  const colorSection = extractSection(body, "Colors");
  const colors = parseMarkdownTable(colorSection);

  // Typography
  const typoSection = extractSection(body, "Typography");
  const typo = parseListSection(typoSection);

  // Radius
  const radiusSection = extractSection(body, "Radius");
  const rad = parseListSection(radiusSection);

  // Spacing
  const spacingSection = extractSection(body, "Spacing");
  const sp = parseListSection(spacingSection);

  // Shadows
  const shadowSection = extractSection(body, "Shadows");
  const sh = parseListSection(shadowSection);

  // Semantics
  const semSection = extractSection(body, "Semantics");
  const sem = parseListSection(semSection);

  // Card CSS
  const cardSection = extractSection(body, "Card CSS");
  const cardCSS = extractCodeBlock(cardSection, "css") || extractCodeBlock(body, "css") || "";

  // Design Notes
  const notesSection = extractSection(body, "Design Notes");

  // Composition Suggestion
  const compSection = extractSection(body, "Composition Suggestion");

  return {
    id: (meta.id as string) || "unknown",
    name: meta.name as string | undefined,
    category: meta.category as string | undefined,
    mood: (meta.mood as string[]) || [],
    type: (meta.type as "base" | "layer") || "base",
    colors,
    typography: {
      heading: typo.heading || typo.fontHeading || "",
      body: typo.body || typo.fontBody || "",
      mono: typo.mono || '"SF Mono", "Fira Code", Menlo, Consolas, monospace',
      scaleRatio: parseFloat(typo["scale-ratio"] || typo.scaleRatio || "1.25"),
      import: typo.import || undefined,
    },
    radius: {
      sm: rad.sm || "4px",
      md: rad.md || "8px",
      lg: rad.lg || "16px",
      full: rad.full || "999px",
    },
    spacing: { unit: parseInt(sp.unit || "8", 10) },
    shadows: {
      sm: sh.sm || "0 1px 3px rgba(0,0,0,0.1)",
      md: sh.md || "0 4px 12px rgba(0,0,0,0.1)",
      lg: sh.lg || "0 8px 24px rgba(0,0,0,0.15)",
    },
    semantics: sem,
    cardCSS,
    designNotes: notesSection,
    compositionSuggestion: compSection || undefined,
  };
}

// ---- Recipe Merging (base + layers + overrides) ----

export function mergeRecipes(base: DesignRecipe, ...layers: Partial<DesignRecipe>[]): DesignRecipe {
  let result: DesignRecipe = JSON.parse(JSON.stringify(base));
  for (const layer of layers) {
    if (layer.colors) result.colors = { ...result.colors, ...layer.colors };
    if (layer.typography) {
      result.typography = {
        ...result.typography,
        ...Object.fromEntries(
          Object.entries(layer.typography).filter(([, v]) => v !== undefined && v !== ""),
        ),
      };
    }
    if (layer.radius) result.radius = { ...result.radius, ...layer.radius };
    if (layer.spacing?.unit) result.spacing = { ...result.spacing, ...layer.spacing };
    if (layer.shadows) result.shadows = { ...result.shadows, ...layer.shadows };
    if (layer.semantics) result.semantics = { ...result.semantics, ...layer.semantics };
    if (layer.cardCSS) result.cardCSS = layer.cardCSS;
    if (layer.designNotes) result.designNotes = (result.designNotes || "") + "\n" + layer.designNotes;
    if (layer.mood) result.mood = [...(result.mood || []), ...layer.mood];
  }
  return result;
}

// ---- File-based loading ----

const RECIPES_DIR = path.join(process.cwd(), "src/lib/recipes");

let recipeCache: Map<string, DesignRecipe> | null = null;

export function clearRecipeCache() {
  recipeCache = null;
}

function ensureCache(): Map<string, DesignRecipe> {
  if (recipeCache) return recipeCache;
  recipeCache = new Map();
  for (const subdir of ["base", "layers"]) {
    const dir = path.join(RECIPES_DIR, subdir);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".md")) continue;
      try {
        const raw = fs.readFileSync(path.join(dir, file), "utf-8");
        const recipe = parseRecipe(raw);
        recipeCache.set(recipe.id, recipe);
      } catch {
        // skip malformed files
      }
    }
  }
  return recipeCache;
}

export function getRecipe(id: string): DesignRecipe | undefined {
  return ensureCache().get(id);
}

export function listRecipes(type?: "base" | "layer"): RecipeIndex[] {
  const cache = ensureCache();
  const result: RecipeIndex[] = [];
  for (const r of cache.values()) {
    if (type && r.type !== type) continue;
    result.push({
      id: r.id,
      name: r.name || r.id,
      category: r.category,
      mood: r.mood,
      type: r.type || "base",
      description: r.designNotes?.split("\n")[0] || undefined,
    });
  }
  return result;
}

/**
 * Resolve a design plan into a final DesignRecipe.
 * Agent output: { recipe: "cyberpunk", layers: ["warm-tint"], overrides: {...} }
 */
export function resolveDesignPlan(plan: {
  recipe: string;
  layers?: string[];
  overrides?: Partial<DesignRecipe>;
}): DesignRecipe | null {
  const base = getRecipe(plan.recipe);
  if (!base) return null;

  const layerRecipes: Partial<DesignRecipe>[] = [];
  for (const layerId of plan.layers || []) {
    const layer = getRecipe(layerId);
    if (layer) layerRecipes.push(layer);
  }
  if (plan.overrides) layerRecipes.push(plan.overrides);

  return mergeRecipes(base, ...layerRecipes);
}

/**
 * Generate a compact index for the Design Agent prompt.
 */
export function getRecipeManifest(): string {
  const bases = listRecipes("base");
  const layers = listRecipes("layer");
  const lines: string[] = ["## Available Design Recipes\n"];

  lines.push("### Base Recipes");
  for (const r of bases) {
    lines.push(`- **${r.id}**: ${r.description || r.name} [${(r.mood || []).join(", ")}]`);
  }

  lines.push("\n### Composable Layers");
  for (const r of layers) {
    lines.push(`- **${r.id}**: ${r.description || r.name}`);
  }

  return lines.join("\n");
}

// ---- Typography helpers ----

export function generateTypeScale(ratio: number, base: number = 16) {
  return {
    xs:    `${(base / ratio / ratio).toFixed(2)}px`,
    sm:    `${(base / ratio).toFixed(2)}px`,
    base:  `${base}px`,
    lg:    `${(base * ratio).toFixed(2)}px`,
    xl:    `${(base * ratio * ratio).toFixed(2)}px`,
    "2xl": `${(base * ratio ** 3).toFixed(2)}px`,
    "3xl": `${(base * ratio ** 4).toFixed(2)}px`,
    "4xl": `${(base * ratio ** 5).toFixed(2)}px`,
  };
}

export function generateSpacingScale(unit: number) {
  return {
    1:  `${unit}px`,
    2:  `${unit * 2}px`,
    3:  `${unit * 3}px`,
    4:  `${unit * 4}px`,
    6:  `${unit * 6}px`,
    8:  `${unit * 8}px`,
    12: `${unit * 12}px`,
    16: `${unit * 16}px`,
  };
}
