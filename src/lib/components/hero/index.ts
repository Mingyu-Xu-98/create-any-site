// hero/index.ts
// Barrel export + registry registration for all hero section variants.
import { registerHero } from "../registry";

import { heroCentered } from "./centered";
import { heroSplit } from "./split";
import { heroMinimal } from "./minimal";
import { heroEditorial } from "./editorial";
import { heroLandscape } from "./landscape";
import { heroNeon } from "./neon";
import { heroBrutalist } from "./brutalist";
import { heroSplitPanel } from "./split-panel";
import { heroSidebarCard } from "./sidebar-card";

// Re-exports
export { heroCentered } from "./centered";
export { heroSplit } from "./split";
export { heroMinimal } from "./minimal";
export { heroEditorial } from "./editorial";
export { heroLandscape } from "./landscape";
export { heroNeon } from "./neon";
export { heroBrutalist } from "./brutalist";
export { heroSplitPanel } from "./split-panel";
export { heroSidebarCard } from "./sidebar-card";

// Register all variants with metadata
registerHero("centered", heroCentered, { description: "Two-column hero with theme-adaptive visual accent on right (terminal, poster, orbital, nature)", bestFor: ["dark-tech", "neon-cyber", "light-clean", "any"], dataShape: "tags[], name, title" });
registerHero("split", heroSplit, { description: "Resume-style split: info left, avatar+tags right, CTA buttons", bestFor: ["bold-creative", "any"], dataShape: "name, title, tags[], avatar" });
registerHero("minimal", heroMinimal, { description: "Centered avatar + badge + stat cards below, scroll indicator", bestFor: ["light-clean", "warm-organic", "any"], dataShape: "name, title, bio, projects, skills" });
registerHero("editorial", heroEditorial, { description: "Magazine-style framed poster with large serif title", bestFor: ["editorial-refined", "warm-organic", "luxury"], dataShape: "name, title" });
registerHero("landscape", heroLandscape, { description: "Illustrated landscape scene, Ghibli-inspired", bestFor: ["warm-organic", "ghibli"], dataShape: "name, title" });
registerHero("neon", heroNeon, { description: "Glassmorphic neon gradient text with glow effects", bestFor: ["luxury-glass", "neon-cyber", "dark-tech"], dataShape: "name, title" });
registerHero("brutalist", heroBrutalist, { description: "Bold oversized monospace typography, minimal decoration", bestFor: ["dark-tech", "brutalist"], dataShape: "name, title" });
registerHero("split-panel", heroSplitPanel, { description: "Full-height split panel layout, info left, visual right", bestFor: ["bold-creative", "split-layout"], dataShape: "name, title" });
registerHero("sidebar-card", heroSidebarCard, { description: "Compact card positioned in sidebar, avatar + bio", bestFor: ["sidebar-layout"], dataShape: "name, title, bio, avatar" });
