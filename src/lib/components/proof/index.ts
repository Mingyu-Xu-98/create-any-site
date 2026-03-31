// proof/index.ts — Registration for social proof section variants.
import { registerSection } from "../registry";
import { proofTestimonials } from "./testimonials";
import { proofStats } from "./stats";
import { proofLogos } from "./logos";

registerSection("proof", "testimonials", proofTestimonials);
registerSection("proof", "stats", proofStats);
registerSection("proof", "logos", proofLogos);
