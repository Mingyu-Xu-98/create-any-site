// education/index.ts — re-exports and registry registrations
export { educationCards } from "./cards";
export { educationList } from "./list";
export { educationBlog } from "./blog";
export { educationParchment } from "./parchment";
export { educationGrouped } from "./grouped";
export { educationGrid } from "./grid";

import { registerEducation } from "../registry";
import { educationCards } from "./cards";
import { educationList } from "./list";
import { educationBlog } from "./blog";
import { educationParchment } from "./parchment";
import { educationGrouped } from "./grouped";
import { educationGrid } from "./grid";

registerEducation("cards", educationCards, { description: "2-column card grid with school, degree, highlights", bestFor: ["any", "light-clean"], dataShape: "education[]{school, degree, highlights[]}" });
registerEducation("list", educationList, { description: "Vertical list format", bestFor: ["compact", "dark-tech"], dataShape: "education[]" });
registerEducation("blog", educationBlog, { description: "Blog-style education entries", bestFor: ["editorial-refined", "blog"], dataShape: "education[]" });
registerEducation("parchment", educationParchment, { description: "Vintage parchment-style education cards", bestFor: ["warm-organic", "ghibli", "ink-wash"], dataShape: "education[]" });
registerEducation("grouped", educationGrouped, { description: "Grouped by category education display", bestFor: ["any"], dataShape: "education[]" });
registerEducation("grid", educationGrid, { description: "3-column compact grid", bestFor: ["light-clean", "minimalist"], dataShape: "education[]" });
