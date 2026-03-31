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

registerContact("center", contactCenter);
registerContact("chips", contactChips);
registerContact("blog-center", contactBlogCenter);
registerContact("minimal", contactMinimal);
registerContact("card", contactCard);
