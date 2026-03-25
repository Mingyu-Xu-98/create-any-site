---
name: ui-skill
description: >
  Design system search engine and generator powered by BM25 with 15 CSV knowledge bases covering UI styles,
  color palettes, typography, charts, landing pages, UX guidelines, icons, app interface specs, and performance
  best practices. Generates complete design systems (colors, fonts, patterns, effects, anti-patterns) for any
  product type. Use this skill whenever the user needs to design a new page or component, choose colors or fonts,
  generate a design system, review UI for accessibility or UX issues, implement dark mode, add charts or data
  visualization, optimize mobile or responsive layout, or follow platform-specific design guidelines (iOS HIG,
  Material Design). Also trigger when someone asks about UI styles (glassmorphism, minimalism, brutalism, etc.),
  wants professional UI quality checks, needs a pre-delivery checklist, or asks for design recommendations for
  any product type (SaaS, e-commerce, fintech, healthcare, beauty, entertainment, etc.). Even if the user
  doesn't explicitly say "design system", trigger whenever they are building or modifying anything visual —
  if the task changes how something looks, moves, or gets interacted with, this skill applies.
---

# UI Skill — Design System Search & Generation Engine

## Overview

UI Skill is a BM25-based design knowledge search engine + intelligent design system generator. It contains 15 CSV knowledge bases covering styles, colors, typography, charts, landing pages, UX guidelines, and more. It supports domain-specific search and cross-domain reasoning to automatically generate complete design systems for any product type.

## Architecture

```
User request → BM25 Search Engine (core.py) → Design System Reasoner (design_system.py) → Structured Recommendations
                                              ↓
                                   15 CSV Knowledge Bases (data/)
```

## When to Use

**Must use** when:
- Designing new pages (Landing Page, Dashboard, Admin, SaaS, Mobile App)
- Creating or refactoring UI components (buttons, modals, forms, tables, charts)
- Choosing color schemes, typography, spacing, or layout systems
- Reviewing UI code for UX, accessibility, or visual consistency
- Implementing navigation, motion, or responsive behavior
- Making product-level design decisions (style, hierarchy, brand expression)

**Skip** when:
- Pure backend logic, API/database design, infrastructure/DevOps work
- Non-visual scripts or automation tasks

**Rule of thumb:** If the task changes how something **looks, feels, moves, or gets interacted with**, use this skill.

## Core Workflow

### Step 1: Analyze Requirements

Extract from the user request:
- **Product type**: SaaS, e-commerce, fintech, healthcare, beauty, entertainment, tool, etc.
- **Target audience**: Age group, usage context (commute, work, leisure)
- **Style keywords**: minimalist, vibrant, dark mode, glassmorphism, etc.
- **Tech stack**: React, React Native, Next.js, etc.

### Step 2: Generate Design System (Primary Function)

Always start here for new projects or pages:

```bash
python3 scripts/search.py "<product_type> <industry> <keywords>" --design-system [-p "Project Name"]
```

This command:
1. Searches 5 domains in parallel (product, style, color, landing, typography)
2. Applies reasoning rules from `ui-reasoning.csv` to select best matches
3. Returns a complete design system: colors, fonts, patterns, effects, anti-patterns

**Persist for reuse across sessions:**
```bash
# Create global design rules
python3 scripts/search.py "<query>" --design-system --persist -p "ProjectName"

# Create page-specific overrides
python3 scripts/search.py "<query>" --design-system --persist -p "ProjectName" --page "dashboard"
```

Creates `design-system/MASTER.md` (global) and `design-system/pages/<page>.md` (overrides).

### Step 3: Supplement with Domain Searches

After the design system, use targeted searches for deeper details:

```bash
python3 scripts/search.py "<keyword>" --domain <domain> [-n <max_results>]
```

| Need | Domain | Example |
|------|--------|---------|
| Product type patterns | `product` | `"entertainment social"` |
| UI style options | `style` | `"glassmorphism dark"` |
| Color palettes | `color` | `"fintech trust"` |
| Font pairings | `typography` | `"playful modern"` |
| Chart recommendations | `chart` | `"real-time dashboard"` |
| UX best practices | `ux` | `"animation accessibility"` |
| Landing page structure | `landing` | `"hero social-proof"` |
| Google Fonts | `google-fonts` | `"serif display"` |
| Icons | `icons` | `"navigation action"` |
| App interface specs | `app-interface` | `"iOS navigation safe-areas"` |

### Step 4: Stack-Specific Guidelines

```bash
python3 scripts/search.py "<keyword>" --stack react-native
```

## Design System Output

Generated systems include:
- **Color scheme**: Primary, Secondary, Accent, Background, Surface, semantic colors (success/error/warning)
- **Typography**: Heading Font + Body Font + mood keywords + CSS Import
- **Design patterns**: Layout patterns, component styles suited to product type
- **Effects**: Shadows, motion, hover states
- **Anti-pattern warnings**: Design mistakes to avoid for the given product type

## Knowledge Bases (15 CSVs)

| File | Content | Size |
|------|---------|------|
| products.csv | Product type recommendations (SaaS/e-commerce/fintech etc.) | 58KB |
| styles.csv | Full UI style database with tech keywords and design variables | 143KB |
| colors.csv | Color palettes by product type with semantic tokens | 32KB |
| typography.csv | Font pairing database with mood/style keywords | 50KB |
| charts.csv | Chart type recommendations with accessibility and library guidance | 20KB |
| landing.csv | Landing page patterns with CTA strategies and conversion optimization | 17KB |
| ux-guidelines.csv | UX best practices with Do's/Don'ts and code examples | 19KB |
| google-fonts.csv | Complete Google Fonts database | 745KB |
| icons.csv | Icon recommendations and semantic meanings | 21KB |
| design.csv | Comprehensive design knowledge base | 106KB |
| app-interface.csv | App interface specs (iOS/Android/React Native) | 10KB |
| react-performance.csv | React/Next.js performance optimization | 15KB |
| ui-reasoning.csv | AI reasoning rules for design system generation | 53KB |
| draft.csv | Alternative recommendations | 106KB |
| stacks/react-native.csv | React Native specific guidelines | — |

## Quick Reference: UI Quality Checklist

For the full checklist with 190+ rules across 10 categories, read `templates/base/quick-reference.md`. Summary of priority categories:

| Priority | Category | Impact | Key Checks |
|----------|----------|--------|------------|
| 1 | Accessibility | CRITICAL | Contrast 4.5:1, alt text, keyboard nav, ARIA labels |
| 2 | Touch & Interaction | CRITICAL | Min 44×44px targets, 8px+ spacing, loading feedback |
| 3 | Performance | HIGH | WebP/AVIF, lazy loading, CLS < 0.1, virtualized lists |
| 4 | Style Selection | HIGH | Match product type, consistency, SVG icons (no emoji) |
| 5 | Layout & Responsive | HIGH | Mobile-first, no horizontal scroll, consistent breakpoints |
| 6 | Typography & Color | MEDIUM | Base 16px, line-height 1.5, semantic color tokens |
| 7 | Animation | MEDIUM | 150–300ms duration, respect reduced-motion, spring physics |
| 8 | Forms & Feedback | MEDIUM | Visible labels, inline validation, progressive disclosure |
| 9 | Navigation | HIGH | Bottom nav ≤5, predictable back, deep linking |
| 10 | Charts & Data | LOW | Legends, tooltips, accessible colors, responsive reflow |

## Professional UI Rules

Read `templates/base/skill-content.md` for the complete implementation guide including:
- Detailed usage scenarios and trigger examples
- Step-by-step workflow with examples
- Common sticking points and solutions
- Pre-delivery checklist (visual quality, interaction, light/dark mode, layout, accessibility)
- Professional icon, interaction, contrast, and layout rules

### Quick Checks Before Delivery

- [ ] Icons: vector SVG only, no emoji, consistent icon family, brand logos from official sources
- [ ] Interaction: tap feedback <100ms, animations 150–300ms, disabled states clear
- [ ] Contrast: text ≥4.5:1, interactive elements ≥3:1, tested in both light and dark mode
- [ ] Layout: safe areas respected, 8dp spacing rhythm, text max-width 65–75ch
- [ ] Dark mode: token-driven, no pure black #000, semantic colors adapted
- [ ] Accessibility: labels, focus order, reduced-motion support, Dynamic Type support

## Platform Adapters

Templates for 20+ development platforms available in `templates/platforms/`:
Claude Code, Cursor, Copilot, Windsurf, Codebuddy, Gemini, Agent, Kiro, Qoder, Droid, Codex, OpenCode, RooCode, Trae, Continue, and more.

## Tips for Better Results

- Use **multi-dimensional keywords**: combine product + industry + tone + density (e.g., `"entertainment social vibrant content-dense"` not just `"app"`)
- Use `--design-system` first for full recommendations, then `--domain` to deep-dive any dimension
- When stuck on style/color decisions, re-run `--design-system` with different keywords
- Always run through Quick Reference §1–§3 (CRITICAL + HIGH) as final review before delivery
