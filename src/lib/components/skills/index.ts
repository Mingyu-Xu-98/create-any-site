// skills/index.ts — re-exports and registry registrations
export { skillsGrouped } from "./grouped";
export { skillsFlat } from "./flat";
export { skillsBars } from "./bars";
export { skillsChips } from "./chips";
export { skillsStaggered } from "./staggered";
export { skillsParchment } from "./parchment";
export { skillsMiniGrid } from "./mini-grid";

import { registerSkills } from "../registry";
import { skillsGrouped } from "./grouped";
import { skillsFlat } from "./flat";
import { skillsBars } from "./bars";
import { skillsChips } from "./chips";
import { skillsStaggered } from "./staggered";
import { skillsParchment } from "./parchment";
import { skillsMiniGrid } from "./mini-grid";

registerSkills("grouped", skillsGrouped, { description: "3-column grid of skill groups with badge chips", bestFor: ["light-clean", "any"], dataShape: "skills[]{title, skills[]}" });
registerSkills("flat", skillsFlat, { description: "Flat list of all skills, minimal styling", bestFor: ["dark-tech", "brutalist", "compact"], dataShape: "skills[]" });
registerSkills("bars", skillsBars, { description: "Horizontal progress bars visualization", bestFor: ["dark-tech", "neon-cyber"], dataShape: "skills[]{title, skills[]}" });
registerSkills("chips", skillsChips, { description: "Inline wrapping chip badges, all skills flat", bestFor: ["bold-creative", "any"], dataShape: "skills[]" });
registerSkills("staggered", skillsStaggered, { description: "Staggered reveal animation on scroll", bestFor: ["editorial-refined", "blog"], dataShape: "skills[]" });
registerSkills("parchment", skillsParchment, { description: "Vintage parchment-style skill cards", bestFor: ["warm-organic", "ghibli", "ink-wash"], dataShape: "skills[]" });
registerSkills("mini-grid", skillsMiniGrid, { description: "Compact 2-column minimal grid", bestFor: ["light-clean", "minimalist"], dataShape: "skills[]{title, skills[]}" });
