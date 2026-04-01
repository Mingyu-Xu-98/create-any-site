---
id: bold-creative
name: Bold Creative
category: bold-creative
mood: [light, playful, bold, energetic]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #fffbeb |
| bg-card | #ffffff |
| bg-card-solid | #fff5d6 |
| bg-tag | rgba(255,107,107,0.12) |
| text | #1a1a2e |
| text-muted | #666666 |
| accent | #ff6b6b |
| accent-soft | rgba(255,107,107,0.1) |
| accent-alt | #4d96ff |
| line | rgba(0,0,0,0.08) |
| green | #6bcb77 |

## Typography
- heading: "Space Grotesk", Impact, sans-serif
- body: "Space Grotesk", -apple-system, sans-serif
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.25
- import: https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;900&display=swap

## Radius
- sm: 8px
- md: 16px
- lg: 24px
- full: 999px

## Spacing
- unit: 8

## Shadows
- sm: 0 1px 4px rgba(0,0,0,0.06)
- md: 0 4px 16px rgba(0,0,0,0.08)
- lg: 0 8px 32px rgba(0,0,0,0.12)

## Semantics
- ornament: moderate
- edge: round
- density: normal
- hero-visual: none
- card-hover: rotate
- divider: dots
- motion: moderate
- transition: normal

## Card CSS
```css
.card {
  background: var(--color-bg-card);
  border: 3px solid var(--color-text);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  transition: transform 0.3s, background 0.3s;
}
.card:hover {
  transform: rotate(-1deg) scale(1.03);
  background: var(--color-accent-soft);
}
```

## Design Notes
A warm, sunshine-yellow canvas with coral and blue accents that pop with playful energy. Thick borders and rotational hover effects give it a tactile, poster-like personality.
