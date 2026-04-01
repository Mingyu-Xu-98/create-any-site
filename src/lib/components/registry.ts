/**
 * Component registry and page assembler.
 * Uses kind-based lookup: agent specifies kind + optional variant,
 * runtime finds the best renderer.
 */
import type { SectionKind, SectionVariantFn, LayoutWrapperFn, EffectFn, SectionContext, CompositionPlan, PageParts, EffectOutput } from "./types";
import { getExtensionRenderer } from "./extensions/registry";
import type { ExtensionOutput } from "./extensions/types";
import { resolveVisualDirection } from "../assets/registry";
import "../assets"; // Register all assets

// ---- Kind-based registry ----
// Each kind maps to a set of named variants.

const kindRegistry: Record<string, Record<string, SectionVariantFn>> = {};
const navRegistry: Record<string, SectionVariantFn> = {};
const footerRegistry: Record<string, SectionVariantFn> = {};
const layoutRegistry: Record<string, LayoutWrapperFn> = {};
const effectRegistry: Record<string, EffectFn> = {};

function ensureKind(kind: string) {
  if (!kindRegistry[kind]) kindRegistry[kind] = {};
}

// ---- Registration ----

/** Register a section variant under a kind */
export function registerSection(kind: string, variant: string, fn: SectionVariantFn) {
  ensureKind(kind);
  kindRegistry[kind][variant] = fn;
}

// Legacy helpers — delegate to registerSection with appropriate kind
export function registerHero(name: string, fn: SectionVariantFn) { registerSection("hero", name, fn); }
export function registerProjects(name: string, fn: SectionVariantFn) { registerSection("showcase", name, fn); }
export function registerSkills(name: string, fn: SectionVariantFn) { registerSection("skills", name, fn); }
export function registerTimeline(name: string, fn: SectionVariantFn) { registerSection("timeline", name, fn); }
export function registerEducation(name: string, fn: SectionVariantFn) { registerSection("content", `education-${name}`, fn); }
export function registerContact(name: string, fn: SectionVariantFn) { registerSection("cta", name, fn); }
export function registerNav(name: string, fn: SectionVariantFn) { navRegistry[name] = fn; }
export function registerFooter(name: string, fn: SectionVariantFn) { footerRegistry[name] = fn; }
export function registerLayout(name: string, fn: LayoutWrapperFn) { layoutRegistry[name] = fn; }
export function registerEffect(name: string, fn: EffectFn) { effectRegistry[name] = fn; }

// ---- Queries ----

export function listVariants(kind: string): string[] {
  return Object.keys(kindRegistry[kind] || {});
}

export function listKinds(): string[] {
  return Object.keys(kindRegistry);
}

export function listLayouts(): string[] {
  return Object.keys(layoutRegistry);
}

export function listEffects(): string[] {
  return Object.keys(effectRegistry);
}

// ---- Resolve a section ----

/**
 * Generic fallback renderer — renders a section as a simple content card.
 * Used when no registered component matches the kind/variant.
 */
const fallbackRenderer: SectionVariantFn = (ctx) => {
  const data = ctx.sectionData || {};
  const title = (data.title as string) || "";
  const content = (data.description as string) || (data.content as string) || "";
  return `
        <section className="max-w-[1100px] mx-auto px-6 py-16">
          ${title ? `<h2 className="text-2xl font-bold mb-6">${title}</h2>` : ""}
          ${content ? `<p className="text-text-muted leading-relaxed">${content}</p>` : ""}
        </section>`;
};

/**
 * Find the best renderer for a section.
 * Priority: exact kind+variant → kind default → legacy id lookup → fallback card
 * NEVER returns null — always falls back to a generic renderer.
 */
function resolveSection(
  kind: SectionKind | string,
  variant?: string,
  legacyId?: string,
): SectionVariantFn {
  const kindMap = kindRegistry[kind];

  // 1. Exact variant match
  if (kindMap && variant && kindMap[variant]) {
    return kindMap[variant];
  }

  // 2. First available variant in the kind (default)
  if (kindMap) {
    const variants = Object.values(kindMap);
    if (variants.length > 0) return variants[0];
  }

  // 3. Legacy fallback: try looking up by section id across all kinds
  if (legacyId) {
    for (const km of Object.values(kindRegistry)) {
      if (km[legacyId]) return km[legacyId];
    }
  }

  // 4. Generic fallback — never silently drop a section
  return fallbackRenderer;
}

// ---- Page assembler ----

/** Get CSS from visual direction for injection into globals.css */
export function getVisualAssetCSS(plan: CompositionPlan): string {
  if (!plan.visualDirection) return "";
  const output = resolveVisualDirection(plan.visualDirection);
  return output.css || "";
}

/** Get extra component files from visual direction */
export function getVisualAssetComponents(plan: CompositionPlan): Record<string, string> {
  if (!plan.visualDirection) return {};
  const output = resolveVisualDirection(plan.visualDirection);
  return output.components || {};
}

export function assemblePage(plan: CompositionPlan, ctx: SectionContext): string {
  // Resolve nav
  const navFn = navRegistry[plan.nav];
  const navContent = navFn ? navFn(ctx) : "";

  // Resolve hero (kind = "hero")
  const heroFn = resolveSection("hero", plan.hero);
  const heroContent = heroFn ? heroFn(ctx) : "";

  // Resolve sections by kind
  const sections = plan.sections.map((section) => {
    const sectionCtx = section.data ? { ...ctx, sectionData: section.data } : ctx;
    const fn = resolveSection(section.kind, section.variant, section.id);
    return { id: section.id, content: fn ? fn(sectionCtx) : "" };
  }).filter(s => s.content);

  // Resolve footer
  const footerFn = footerRegistry[plan.footer];
  const footerContent = footerFn ? footerFn(ctx) : "";

  // Resolve effects
  const effects: EffectOutput[] = plan.effects
    .map(name => effectRegistry[name])
    .filter((fn): fn is EffectFn => Boolean(fn))
    .map(fn => fn(ctx));

  // Resolve extensions
  const extensionOutputs: ExtensionOutput[] = [];
  for (const ext of plan.extensions || []) {
    const renderer = getExtensionRenderer(ext.slot);
    if (renderer) {
      extensionOutputs.push(renderer(ctx, ext.config));
    }
  }

  const parts: PageParts = {
    nav: navContent,
    hero: heroContent,
    sections,
    footer: footerContent,
    effects,
  };

  // Resolve layout wrapper
  const layoutFn = layoutRegistry[plan.layout];
  if (layoutFn) {
    return layoutFn(ctx, parts);
  }

  // Resolve visual assets
  const assetOutput = plan.visualDirection ? resolveVisualDirection(plan.visualDirection) : null;
  const assetCss = assetOutput?.css || "";

  // Fallback: simple concatenation
  const allImports = extensionOutputs.flatMap(e => e.imports);
  const extensionJsx = extensionOutputs.map(e => e.jsx).filter(Boolean).join("\n");
  const effectJsx = effects.map(e => e.jsx).filter(Boolean).join("\n");
  const sectionJsx = sections.map(s => s.content).join("\n\n");

  // Texture overlay JSX (if texture asset is active)
  const textureJsx = assetCss.includes("texture-overlay") ? `<div className="texture-overlay" />` : "";
  const bokehJsx = assetCss.includes("bokeh-bg") ? `<div className="bokeh-bg"><div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" /></div>` : "";

  return `"use client";
import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import Image from "next/image";
import ChatBot from "@/components/ChatBot";
import SharePoster from "@/components/SharePoster";
${allImports.join("\n")}

export default function Home() {
  const { lang, t, toggle } = useLanguage();

  return (
    <div className="min-h-screen relative bg-bg text-text">
      ${bokehJsx}
      ${textureJsx}
      ${effectJsx}
      <div className="relative z-10">
        ${navContent}
        ${heroContent}
        ${sectionJsx}
        ${extensionJsx}
        ${footerContent}
      </div>
      <ChatBot />
      <SharePoster />
    </div>
  );
}

`;
}
