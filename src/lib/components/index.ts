/**
 * Component library entry point.
 * Importing this file registers all section variants into the registry.
 */

// Import all section indexes to trigger registration
import "./hero/index";
import "./projects/index";
import "./skills/index";
import "./timeline/index";
import "./education/index";
import "./contact/index";
import "./proof/index";
import "./gallery/index";
import "./cta-section/index";
import "./pricing/index";
import "./faq/index";
import "./nav/index";
import "./footer/index";
import "./layouts/index";
import "./extensions/index";

// Re-export core APIs
export { assemblePage, listVariants, listLayouts, listEffects } from "./registry";
export { buildCompositionPlan } from "./plan-builder";
export { getExtensionRenderer, listExtensions, listExtensionIds } from "./extensions";
export type { SectionContext, CompositionPlan, SectionVariantFn, LayoutWrapperFn, EffectFn } from "./types";
export type { ExtensionOutput, ExtensionConfig, ExtensionDefinition } from "./extensions";
