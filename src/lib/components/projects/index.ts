// projects/index.ts
// Re-exports all project section variants and registers them with the component registry.

export { projectsGrid } from "./grid";
export { projectsShowcase } from "./showcase";
export { projectsBlogGrid } from "./blog-grid";
export { projectsParchment } from "./parchment";
export { projectsList } from "./list";
export { projectsGlassMinimal } from "./glass-minimal";
export { projectsBento } from "./bento";
export { projectsMasonry } from "./masonry";
export { projectsMagazine } from "./magazine";
export { projectsStandard } from "./standard";
export { projectsZigzag } from "./zigzag";
export { projectsSidebar } from "./sidebar";
export { projectsSplit } from "./split";

import { registerProjects } from "../registry";
import { projectsGrid } from "./grid";
import { projectsShowcase } from "./showcase";
import { projectsBlogGrid } from "./blog-grid";
import { projectsParchment } from "./parchment";
import { projectsList } from "./list";
import { projectsGlassMinimal } from "./glass-minimal";
import { projectsBento } from "./bento";
import { projectsMasonry } from "./masonry";
import { projectsMagazine } from "./magazine";
import { projectsStandard } from "./standard";
import { projectsZigzag } from "./zigzag";
import { projectsSidebar } from "./sidebar";
import { projectsSplit } from "./split";

// Register all variants
registerProjects("grid", projectsGrid);
registerProjects("showcase", projectsShowcase);
registerProjects("blog-grid", projectsBlogGrid);
registerProjects("parchment", projectsParchment);
registerProjects("list", projectsList);
registerProjects("glass-minimal", projectsGlassMinimal);
registerProjects("bento", projectsBento);
registerProjects("masonry", projectsMasonry);
registerProjects("magazine", projectsMagazine);
registerProjects("standard", projectsStandard);
registerProjects("zigzag", projectsZigzag);
registerProjects("sidebar", projectsSidebar);
registerProjects("split", projectsSplit);
