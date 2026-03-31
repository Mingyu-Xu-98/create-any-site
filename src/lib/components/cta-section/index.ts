// cta-section/index.ts — Registration for CTA section variants.
import { registerSection } from "../registry";
import { ctaSimple } from "./simple";
import { ctaSplit } from "./split";
import { ctaBanner } from "./banner";

registerSection("cta", "simple", ctaSimple);
registerSection("cta", "split", ctaSplit);
registerSection("cta", "banner", ctaBanner);
