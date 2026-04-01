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

// Register all variants with metadata
registerProjects("grid", projectsGrid, { description: "Clean 2-column card grid with images, tags, and GitHub links", bestFor: ["light-clean", "minimalist", "any"], dataShape: "projects[] with title, desc, tags, image?" });
registerProjects("showcase", projectsShowcase, { description: "Bold numbered section with large preview cards", bestFor: ["bold-creative", "dark-tech"], dataShape: "projects[] with title, desc, tags" });
registerProjects("blog-grid", projectsBlogGrid, { description: "Blog-focused grid with date, title, excerpt", bestFor: ["editorial-refined", "blog"], dataShape: "projects[] with title, desc, date?" });
registerProjects("parchment", projectsParchment, { description: "Vintage parchment-style cards with warm paper texture", bestFor: ["warm-organic", "ghibli", "ink-wash"], dataShape: "projects[]" });
registerProjects("list", projectsList, { description: "Minimal vertical list format, text-only", bestFor: ["dark-tech", "brutalist", "compact"], dataShape: "projects[]" });
registerProjects("glass-minimal", projectsGlassMinimal, { description: "Glassmorphic translucent cards with blur backdrop", bestFor: ["luxury-glass", "neon-cyber", "dark-tech"], dataShape: "projects[]" });
registerProjects("bento", projectsBento, { description: "Bento box grid with varied card sizes, visual-heavy", bestFor: ["bold-creative", "neon-cyber", "dark-tech"], dataShape: "projects[] with images" });
registerProjects("masonry", projectsMasonry, { description: "Pinterest-style masonry with varied heights", bestFor: ["creative", "portfolio", "any"], dataShape: "projects[] with images" });
registerProjects("magazine", projectsMagazine, { description: "Magazine layout: large featured + supporting grid", bestFor: ["editorial-refined", "luxury"], dataShape: "projects[] with images" });
registerProjects("standard", projectsStandard, { description: "Default 2-column card grid with badge and org", bestFor: ["any"], dataShape: "projects[] with title, desc, org?, badge?" });
registerProjects("zigzag", projectsZigzag, { description: "Alternating left-right layout for storytelling", bestFor: ["editorial-refined", "narrative"], dataShape: "projects[] with images" });
registerProjects("sidebar", projectsSidebar, { description: "Sidebar-integrated compact project list", bestFor: ["sidebar-layout"], dataShape: "projects[]" });
registerProjects("split", projectsSplit, { description: "Split-layout projects for two-panel designs", bestFor: ["split-layout"], dataShape: "projects[]" });
