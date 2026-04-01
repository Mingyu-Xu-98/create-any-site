---
id: tpl-resume-dark
name: Resume Dark
category: luxury-glass
mood: [dark, sleek, professional, polished]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #050506 |
| bg-card | rgba(17,17,24,0.8) |
| bg-card-solid | #111118 |
| bg-tag | rgba(94,106,210,0.1) |
| text | #e0e0e8 |
| text-muted | #6b6b80 |
| accent | #5E6AD2 |
| accent-soft | rgba(94,106,210,0.12) |
| accent-alt | #8b5cf6 |
| line | rgba(94,106,210,0.12) |
| green | #34d399 |

## Typography
- heading: "Inter", -apple-system, sans-serif
- body: "Inter", -apple-system, sans-serif
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.25
- import: https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap

## Radius
- sm: 8px
- md: 16px
- lg: 999px
- full: 999px

## Spacing
- unit: 8

## Shadows
- sm: 0 1px 4px rgba(94,106,210,0.15)
- md: 0 4px 16px rgba(94,106,210,0.12)
- lg: 0 8px 32px rgba(94,106,210,0.18)

## Semantics
- ornament: moderate
- edge: pill
- density: normal
- hero-visual: orbital
- card-hover: lift
- divider: gradient
- motion: moderate
- transition: normal

## Card CSS
```css
.card {
  background: var(--color-bg-card);
  backdrop-filter: blur(20px) saturate(1.3);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  transition: transform 0.4s, border-color 0.4s, box-shadow 0.4s;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}
.card:hover {
  transform: translateY(-4px);
  border-color: var(--color-accent);
  box-shadow: 0 16px 48px rgba(94,106,210,0.2), 0 0 0 1px var(--color-accent);
}
.card::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(94,106,210,0.05) 0%, transparent 50%);
  pointer-events: none;
  z-index: 1;
}
```

## Design Notes
A near-black canvas with indigo-violet accents inspired by Linear's design language, creating a polished and premium dark resume experience. Pill-shaped elements and glass-like card blur give it a refined, app-like feel.
