// nav/index.ts — Re-exports and registry registrations for nav variants.
export { navSticky } from "./sticky";
export { navHamburger } from "./hamburger";
export { navSidebar } from "./sidebar";
export { navSplitPanel } from "./split-panel";
export { navMinimal } from "./minimal";
export { navBold } from "./bold";
export { navBlog } from "./blog";
export { navMini } from "./mini";

import { registerNav } from "../registry";
import { navSticky } from "./sticky";
import { navHamburger } from "./hamburger";
import { navSidebar } from "./sidebar";
import { navSplitPanel } from "./split-panel";
import { navMinimal } from "./minimal";
import { navBold } from "./bold";
import { navBlog } from "./blog";
import { navMini } from "./mini";

registerNav("sticky", navSticky, { description: "Fixed top navbar with name, section links, language toggle", bestFor: ["any", "light-clean", "dark-tech"] });
registerNav("hamburger", navHamburger, { description: "Collapsible hamburger menu for mobile-first", bestFor: ["any", "mobile"] });
registerNav("sidebar", navSidebar, { description: "Full-height vertical sidebar navigation", bestFor: ["sidebar-layout", "luxury-glass"] });
registerNav("split-panel", navSplitPanel, { description: "Navigation for split-panel layouts", bestFor: ["split-layout"] });
registerNav("minimal", navMinimal, { description: "Text-only minimal navigation, no styling", bestFor: ["dark-tech", "brutalist"] });
registerNav("bold", navBold, { description: "Thick border bold typography nav", bestFor: ["bold-creative", "tpl-resume-bold"] });
registerNav("blog", navBlog, { description: "Blog-style nav with categories", bestFor: ["editorial-refined", "blog"] });
registerNav("mini", navMini, { description: "Compact ultra-clean nav for minimalist themes", bestFor: ["light-clean", "minimalist"] });
