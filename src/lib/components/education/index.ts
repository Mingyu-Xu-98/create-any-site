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

registerEducation("cards", educationCards);
registerEducation("list", educationList);
registerEducation("blog", educationBlog);
registerEducation("parchment", educationParchment);
registerEducation("grouped", educationGrouped);
registerEducation("grid", educationGrid);
