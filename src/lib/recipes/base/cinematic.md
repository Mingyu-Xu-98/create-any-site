---
id: cinematic
name: Cinematic
category: editorial-refined
mood: [dark, dramatic, luxurious, cinematic]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #0a0a14 |
| bg-card | rgba(26,26,46,0.85) |
| bg-card-solid | #1a1a2e |
| bg-tag | rgba(233,69,96,0.1) |
| text | #e8e0d4 |
| text-muted | #7a7580 |
| accent | #e94560 |
| accent-soft | rgba(233,69,96,0.12) |
| accent-alt | #c9a96e |
| line | rgba(233,69,96,0.12) |
| green | #c9a96e |

## Typography
- heading: "Playfair Display", Georgia, serif
- body: "DM Sans", -apple-system, BlinkMacSystemFont, sans-serif
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.333
- import: https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&family=Playfair+Display:wght@300;400;700&display=swap

## Radius
- sm: 2px
- md: 4px
- lg: 8px
- full: 999px

## Spacing
- unit: 12

## Shadows
- sm: 0 1px 4px rgba(0,0,0,0.3)
- md: 0 4px 16px rgba(0,0,0,0.3)
- lg: 0 8px 32px rgba(0,0,0,0.4)

## Semantics
- ornament: moderate
- edge: sharp
- density: spacious
- hero-visual: poster
- card-hover: scale
- divider: gradient
- motion: moderate
- transition: slow

## Card CSS
```css
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  transition: transform 0.5s cubic-bezier(0.25,0.1,0.25,1), box-shadow 0.5s;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
.card:hover {
  transform: scale(1.02);
  box-shadow: 0 8px 40px rgba(233,69,96,0.15), 0 4px 20px rgba(0,0,0,0.4);
}
.card::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.5));
  pointer-events: none;
  z-index: 1;
}
```

## Design Notes
A moody, film-noir-inspired dark theme with crimson and gold accents that evoke movie posters and theatrical lighting. Serif headings and slow transitions create a sense of grandeur and drama.
