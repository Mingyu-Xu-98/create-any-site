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

registerFooter("standard", footerStandard, { description: "Centered copyright + name with border-top", bestFor: ["any", "light-clean"] });
registerFooter("minimal", footerMinimal, { description: "Single-line text-only footer", bestFor: ["dark-tech", "brutalist", "compact"] });
registerFooter("blog", footerBlog, { description: "Footer with links and categories for blog sites", bestFor: ["editorial-refined", "blog"] });
registerFooter("bold", footerBold, { description: "Strong typography bold footer", bestFor: ["bold-creative"] });
