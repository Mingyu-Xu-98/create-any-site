/**
 * Extension registry — register and resolve extension slots.
 */
import type { ExtensionDefinition, ExtensionRenderer } from "./types";

const extensions: Record<string, ExtensionDefinition> = {};

export function registerExtension(def: ExtensionDefinition) {
  extensions[def.id] = def;
}

export function getExtension(id: string): ExtensionDefinition | undefined {
  return extensions[id];
}

export function getExtensionRenderer(id: string): ExtensionRenderer | undefined {
  return extensions[id]?.render;
}

export function listExtensions(): ExtensionDefinition[] {
  return Object.values(extensions);
}

export function listExtensionIds(): string[] {
  return Object.keys(extensions);
}
