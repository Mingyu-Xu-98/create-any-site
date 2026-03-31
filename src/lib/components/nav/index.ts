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

registerNav("sticky", navSticky);
registerNav("hamburger", navHamburger);
registerNav("sidebar", navSidebar);
registerNav("split-panel", navSplitPanel);
registerNav("minimal", navMinimal);
registerNav("bold", navBold);
registerNav("blog", navBlog);
registerNav("mini", navMini);
