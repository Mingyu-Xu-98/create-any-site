// pricing/index.ts — Registration for pricing section variants.
import { registerSection } from "../registry";
import { pricingCards } from "./cards";
import { pricingToggle } from "./toggle";
import { pricingComparison } from "./comparison";

registerSection("pricing", "cards", pricingCards);
registerSection("pricing", "toggle", pricingToggle);
registerSection("pricing", "comparison", pricingComparison);
