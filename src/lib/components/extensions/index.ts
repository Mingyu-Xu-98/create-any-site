/**
 * Extensions entry point — importing this registers all extension slots.
 */
import "./svg-animation";
import "./video-background";
import "./video-embed";
import "./three-scene";
import "./canvas-animation";
import "./digital-human";

export { registerExtension, getExtension, getExtensionRenderer, listExtensions, listExtensionIds } from "./registry";
export type { ExtensionOutput, ExtensionConfig, ExtensionRenderer, ExtensionDefinition } from "./types";
