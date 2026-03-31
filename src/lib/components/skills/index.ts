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

registerSkills("grouped", skillsGrouped);
registerSkills("flat", skillsFlat);
registerSkills("bars", skillsBars);
registerSkills("chips", skillsChips);
registerSkills("staggered", skillsStaggered);
registerSkills("parchment", skillsParchment);
registerSkills("mini-grid", skillsMiniGrid);
