// layouts/index.ts — Re-exports and registry registrations for layout wrappers.
export { layoutSingle } from "./single";
export { layoutSidebar } from "./sidebar";
export { layoutSplit } from "./split";
export { layoutGrid } from "./grid";

import { registerLayout } from "../registry";
import { layoutSingle } from "./single";
import { layoutSidebar } from "./sidebar";
import { layoutSplit } from "./split";
import { layoutGrid } from "./grid";

registerLayout("single", layoutSingle);
registerLayout("sidebar", layoutSidebar);
registerLayout("split", layoutSplit);
registerLayout("grid", layoutGrid);
