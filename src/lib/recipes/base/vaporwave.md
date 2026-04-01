---
id: vaporwave
name: Vaporwave
category: neon-cyber
mood: [dark, retro, neon, surreal]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #1a0a2e |
| bg-card | rgba(255,113,206,0.06) |
| bg-card-solid | #2a1040 |
| bg-tag | rgba(255,113,206,0.1) |
| text | #f0e0ff |
| text-muted | #a080c0 |
| accent | #ff71ce |
| accent-soft | rgba(255,113,206,0.12) |
| accent-alt | #01cdfe |
| line | rgba(255,113,206,0.15) |
| green | #05ffa1 |

## Typography
- heading: "Audiowide", Impact, sans-serif
- body: "Quicksand", -apple-system, BlinkMacSystemFont, sans-serif
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.25
- import: https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&family=Audiowide&display=swap

## Radius
- sm: 4px
- md: 8px
- lg: 16px
- full: 999px

## Spacing
- unit: 8

## Shadows
- sm: 0 1px 4px rgba(255,113,206,0.15)
- md: 0 4px 16px rgba(255,113,206,0.12)
- lg: 0 8px 32px rgba(255,113,206,0.18)

## Semantics
- ornament: rich
- edge: soft
- density: normal
- hero-visual: geometric
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
A deep purple dreamscape with hot pink and electric blue accents channeling 80s/90s retro-futurism and internet nostalgia. Bold display headings and rich motion effects create an immersive, surreal vibe.
