// faq/index.ts — Registration for FAQ section variants.
import { registerSection } from "../registry";
import { faqAccordion } from "./accordion";
import { faqGrid } from "./grid";

registerSection("faq", "accordion", faqAccordion);
registerSection("faq", "grid", faqGrid);
