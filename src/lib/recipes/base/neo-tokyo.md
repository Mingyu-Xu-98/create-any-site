---
id: neo-tokyo
name: Neo Tokyo
category: neon-cyber
mood: [dark, techy, neon, Japanese]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #0d0d0d |
| bg-card | rgba(26,10,46,0.8) |
| bg-card-solid | #1a0a2e |
| bg-tag | rgba(255,46,99,0.1) |
| text | #e0d8f0 |
| text-muted | #7a6b90 |
| accent | #ff2e63 |
| accent-soft | rgba(255,46,99,0.12) |
| accent-alt | #08d9d6 |
| line | rgba(255,46,99,0.15) |
| green | #08d9d6 |

## Typography
- heading: "Noto Sans JP", "JetBrains Mono", sans-serif
- body: "Noto Sans JP", "JetBrains Mono", sans-serif
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.2
- import: https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=JetBrains+Mono:wght@400;500&display=swap

## Radius
- sm: 2px
- md: 4px
- lg: 8px
- full: 999px

## Spacing
- unit: 4

## Shadows
- sm: 0 1px 4px rgba(0,0,0,0.3)
- md: 0 4px 16px rgba(0,0,0,0.3)
- lg: 0 8px 32px rgba(0,0,0,0.4)

## Semantics
- ornament: rich
- edge: sharp
- density: compact
- hero-visual: geometric
- card-hover: glow
- divider: gradient
- motion: moderate
- transition: fast

## Card CSS
```css
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  transition: border-color 0.3s, box-shadow 0.3s;
}
.card:hover {
  border-color: var(--color-accent);
  box-shadow: 0 0 24px rgba(255,46,99,0.2), 0 0 48px rgba(8,217,214,0.08);
}
.card::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--color-accent), var(--color-accent-alt));
  opacity: 0;
  transition: opacity 0.3s;
}
.card:hover::after {
  opacity: 1;
}
```

## Design Notes
A deep black canvas with hot pink and electric teal accents inspired by Tokyo's neon-drenched nightscapes. Japanese typography blended with monospace creates a futuristic anime-tech aesthetic.
