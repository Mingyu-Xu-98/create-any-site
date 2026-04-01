---
id: tpl-resume-bold
name: Resume Bold
category: bold-creative
mood: [light, bold, expressive, modern]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #FDF2F8 |
| bg-card | #ffffff |
| bg-card-solid | #ffffff |
| bg-tag | rgba(236,72,153,0.08) |
| text | #0F172A |
| text-muted | #64748B |
| accent | #EC4899 |
| accent-soft | rgba(236,72,153,0.1) |
| accent-alt | #0891B2 |
| line | rgba(0,0,0,0.12) |
| green | #34D399 |

## Typography
- heading: "Syne", -apple-system, sans-serif
- body: "Manrope", -apple-system, sans-serif
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.25
- import: https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Manrope:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap

## Radius
- sm: 0px
- md: 0px
- lg: 0px
- full: 999px

## Spacing
- unit: 8

## Shadows
- sm: 0 1px 4px rgba(0,0,0,0.06)
- md: 0 4px 16px rgba(0,0,0,0.08)
- lg: 0 8px 32px rgba(0,0,0,0.12)

## Semantics
- ornament: moderate
- edge: sharp
- density: normal
- hero-visual: none
- card-hover: lift
- divider: dots
- motion: moderate
- transition: fast

## Card CSS
```css
.card {
  background: var(--color-bg-card);
  border: 3px solid var(--color-text);
  border-radius: 0;
  overflow: hidden;
  position: relative;
  box-shadow: 6px 6px 0 var(--color-accent);
  transition: transform 0.2s, box-shadow 0.2s;
}
.card:hover {
  transform: translate(-3px, -3px);
  box-shadow: 9px 9px 0 var(--color-accent), 12px 12px 0 var(--color-accent-alt);
}
.card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  background: linear-gradient(180deg, var(--color-accent), var(--color-accent-alt));
  z-index: 2;
}
```

## Design Notes
A blush-pink canvas with hot pink and teal accents, using thick borders and layered drop-shadows for a bold, neo-brutalist resume style. The Syne display heading font and sharp edges make a strong visual statement.
