// contact/index.ts — Re-exports and registry registrations for contact variants.
export { contactCenter } from "./center";
export { contactChips } from "./chips";
export { contactBlogCenter } from "./blog-center";
export { contactMinimal } from "./minimal";
export { contactCard } from "./card";

import { registerContact } from "../registry";
import { contactCenter } from "./center";
import { contactChips } from "./chips";
import { contactBlogCenter } from "./blog-center";
import { contactMinimal } from "./minimal";
import { contactCard } from "./card";

registerContact("center", contactCenter, { description: "Centered icon buttons for email and social links", bestFor: ["any", "light-clean"], dataShape: "email, github" });
registerContact("chips", contactChips, { description: "Chip-button contact links", bestFor: ["bold-creative"], dataShape: "email, github" });
registerContact("blog-center", contactBlogCenter, { description: "Newsletter signup for blog sites", bestFor: ["editorial-refined", "blog"], dataShape: "email" });
registerContact("minimal", contactMinimal, { description: "Text + link only, brutalist minimal", bestFor: ["dark-tech", "brutalist"], dataShape: "email" });
registerContact("card", contactCard, { description: "Card-based contact form", bestFor: ["light-clean", "minimalist"], dataShape: "email" });
