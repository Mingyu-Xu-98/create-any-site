---
id: nature
name: Nature
category: warm-organic
mood: [light, organic, earthy, calm]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #f0ebe3 |
| bg-card | rgba(255,252,245,0.85) |
| bg-card-solid | #f5f0e8 |
| bg-tag | rgba(45,80,22,0.1) |
| text | #2d3a1e |
| text-muted | #6b7a5e |
| accent | #2d5016 |
| accent-soft | rgba(45,80,22,0.1) |
| accent-alt | #c4a882 |
| line | rgba(45,80,22,0.15) |
| green | #5a7247 |

## Typography
- heading: "Nunito", -apple-system, sans-serif
- body: "Nunito", -apple-system, BlinkMacSystemFont, sans-serif
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.333
- import: https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700&display=swap

## Radius
- sm: 12px
- md: 24px
- lg: 32px
- full: 999px

## Spacing
- unit: 12

## Shadows
- sm: 0 1px 4px rgba(0,0,0,0.06)
- md: 0 4px 16px rgba(0,0,0,0.08)
- lg: 0 8px 32px rgba(0,0,0,0.12)

## Semantics
- ornament: moderate
- edge: round
- density: spacious
- hero-visual: nature
- card-hover: lift
- divider: wave
- motion: moderate
- transition: slow

## Card CSS
```css
.card {
  background: var(--color-bg-card);
  backdrop-filter: blur(6px);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  box-shadow: 0 4px 16px rgba(45,80,22,0.06);
  transition: transform 0.4s cubic-bezier(0.4,0,0.2,1), box-shadow 0.4s;
}
.card:hover {
  transform: translateY(-6px);
  box-shadow: 0 16px 40px rgba(45,80,22,0.12);
}
```

## Design Notes
An earthy, forest-inspired palette with deep greens and warm sand tones that feel grounded and serene. Generous rounded corners and organic motion create a gentle, nature-walk atmosphere.
