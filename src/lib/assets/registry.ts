/**
 * Visual Asset Registry — central catalog of all visual assets.
 * Design Agent reads the manifest to choose assets.
 * Asset Resolver converts asset IDs to actual CSS/SVG/component code.
 */

export type AssetCategory = "texture" | "shape" | "motion" | "hero-system" | "card-style" | "mockup";

export interface Asset {
  id: string;
  category: AssetCategory;
  name: string;
  nameCn: string;
  description: string;
  /** Tags for mood matching: "dark", "light", "editorial", "tech", "organic", etc. */
  mood: string[];
  /** CSS/SVG/component output — resolved by Asset Resolver */
  resolve: () => AssetOutput;
}

export interface AssetOutput {
  /** CSS to inject into globals.css */
  css?: string;
  /** CSS class names to apply to elements */
  classes?: Record<string, string>;
  /** Inline SVG strings */
  svgs?: Record<string, string>;
  /** Extra component code to generate */
  components?: Record<string, string>;
}

// ---- Registry ----

const assets: Record<string, Asset> = {};

export function registerAsset(asset: Asset) {
  assets[asset.id] = asset;
}

export function getAsset(id: string): Asset | undefined {
  return assets[id];
}

export function getAssetsByCategory(category: AssetCategory): Asset[] {
  return Object.values(assets).filter(a => a.category === category);
}

export function getAssetsByMood(mood: string): Asset[] {
  return Object.values(assets).filter(a => a.mood.includes(mood));
}

/**
 * Generate a compact manifest for the Design Agent prompt.
 * Lists all available assets with their IDs and descriptions.
 */
export function getAssetManifest(): string {
  const categories: AssetCategory[] = ["texture", "hero-system", "card-style", "motion", "mockup", "shape"];
  const sections: string[] = [];

  for (const cat of categories) {
    const items = getAssetsByCategory(cat);
    if (items.length === 0) continue;
    const lines = items.map(a => `  - ${a.id}: ${a.description} [${a.mood.join(", ")}]`);
    sections.push(`### ${cat}\n${lines.join("\n")}`);
  }

  return `## Available Visual Assets\n\n${sections.join("\n\n")}`;
}

/**
 * Resolve a full visual direction into concrete CSS/SVG/components.
 */
export interface VisualDirection {
  mood?: string;
  texture?: string;
  heroSystem?: string;
  cardStyle?: string;
  motionLevel?: "none" | "subtle" | "moderate" | "rich";
  motionPresets?: string[];
  mockupStyle?: string;
  shapes?: string[];
}

export function resolveVisualDirection(dir: VisualDirection): AssetOutput {
  const combined: AssetOutput = { css: "", classes: {}, svgs: {}, components: {} };

  const merge = (output: AssetOutput) => {
    if (output.css) combined.css += "\n" + output.css;
    if (output.classes) Object.assign(combined.classes!, output.classes);
    if (output.svgs) Object.assign(combined.svgs!, output.svgs);
    if (output.components) Object.assign(combined.components!, output.components);
  };

  if (dir.texture) {
    const a = assets[dir.texture];
    if (a) merge(a.resolve());
  }
  if (dir.heroSystem) {
    const a = assets[dir.heroSystem];
    if (a) merge(a.resolve());
  }
  if (dir.cardStyle) {
    const a = assets[dir.cardStyle];
    if (a) merge(a.resolve());
  }
  for (const preset of dir.motionPresets || []) {
    const a = assets[preset];
    if (a) merge(a.resolve());
  }
  if (dir.mockupStyle) {
    const a = assets[dir.mockupStyle];
    if (a) merge(a.resolve());
  }
  for (const shape of dir.shapes || []) {
    const a = assets[shape];
    if (a) merge(a.resolve());
  }

  return combined;
}
