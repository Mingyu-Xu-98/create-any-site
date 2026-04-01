---
id: aurora
name: Aurora
category: neon-cyber
mood: [dark, atmospheric, luminous, modern]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #060d1f |
| bg-card | rgba(0,212,170,0.06) |
| bg-card-solid | #0a1a30 |
| bg-tag | rgba(0,212,170,0.1) |
| text | #e0f0f8 |
| text-muted | #6090a8 |
| accent | #00d4aa |
| accent-soft | rgba(0,212,170,0.1) |
| accent-alt | #7b68ee |
| line | rgba(0,212,170,0.12) |
| green | #00d4aa |

## Typography
- heading: "Outfit", -apple-system, sans-serif
- body: "Outfit", -apple-system, BlinkMacSystemFont, sans-serif
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.25
- import: https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap

## Radius
- sm: 8px
- md: 16px
- lg: 24px
- full: 999px

## Spacing
- unit: 8

## Shadows
- sm: 0 1px 4px rgba(0,212,170,0.15)
- md: 0 4px 16px rgba(0,212,170,0.12)
- lg: 0 8px 32px rgba(0,212,170,0.18)

## Semantics
- ornament: moderate
- edge: soft
- density: normal
- hero-visual: orbital
- card-hover: glow
- divider: gradient
- motion: rich
- transition: normal

## Card CSS
```css
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  transition: transform 0.3s, box-shadow 0.3s;
}
.card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
}
```

## Design Notes
A midnight-blue sky illuminated by teal and violet aurora light, creating an otherworldly atmospheric glow. Soft edges and rich motion effects simulate the gentle shimmer of northern lights.
