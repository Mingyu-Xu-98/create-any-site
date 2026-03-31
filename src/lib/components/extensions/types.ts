/**
 * Extension slot interface for advanced components.
 * Extensions are pluggable components that can be inserted into any position in a page.
 */
import type { SectionContext } from "../types";

/** Output of an extension renderer */
export interface ExtensionOutput {
  /** JSX string to insert into the page */
  jsx: string;
  /** CSS string to append to globals.css */
  css: string;
  /** Import statements needed at the top of page.tsx */
  imports: string[];
  /** Additional npm packages to add to package.json */
  dependencies?: Record<string, string>;
  /** Additional component files to generate: { "src/components/Foo.tsx": "content..." } */
  files?: Record<string, string>;
}

/** Extension slot configuration passed from the CompositionPlan */
export interface ExtensionConfig {
  slot: string;
  config: Record<string, unknown>;
}

/** Extension renderer function */
export type ExtensionRenderer = (ctx: SectionContext, config: Record<string, unknown>) => ExtensionOutput;

/** Extension registration metadata */
export interface ExtensionDefinition {
  /** Unique slot name, e.g. "svg-animation", "video-bg" */
  id: string;
  /** Human-readable label */
  label: string;
  /** Where this extension can be placed */
  type: "background" | "section" | "widget" | "overlay";
  /** The renderer function */
  render: ExtensionRenderer;
}
