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

// Register all variants
registerHero("centered", heroCentered);
registerHero("split", heroSplit);
registerHero("minimal", heroMinimal);
registerHero("editorial", heroEditorial);
registerHero("landscape", heroLandscape);
registerHero("neon", heroNeon);
registerHero("brutalist", heroBrutalist);
registerHero("split-panel", heroSplitPanel);
registerHero("sidebar-card", heroSidebarCard);
