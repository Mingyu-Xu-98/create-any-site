// footer/index.ts — Re-exports and registry registrations for footer variants.
export { footerStandard } from "./standard";
export { footerMinimal } from "./minimal";
export { footerBlog } from "./blog";
export { footerBold } from "./bold";

import { registerFooter } from "../registry";
import { footerStandard } from "./standard";
import { footerMinimal } from "./minimal";
import { footerBlog } from "./blog";
import { footerBold } from "./bold";

registerFooter("standard", footerStandard);
registerFooter("minimal", footerMinimal);
registerFooter("blog", footerBlog);
registerFooter("bold", footerBold);
