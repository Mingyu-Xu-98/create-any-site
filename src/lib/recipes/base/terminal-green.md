---
id: terminal-green
name: Terminal Green
category: dark-tech
mood: [dark, techy, retro, hacker]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #0a0a0a |
| bg-card | rgba(0,255,65,0.04) |
| bg-card-solid | #0d1a0d |
| bg-tag | rgba(0,255,65,0.08) |
| text | #00ff41 |
| text-muted | #00aa2a |
| accent | #00ff41 |
| accent-soft | rgba(0,255,65,0.1) |
| accent-alt | #39ff14 |
| line | rgba(0,255,65,0.15) |
| green | #00ff41 |

## Typography
- heading: "VT323", "Courier New", monospace
- body: "VT323", "Courier New", monospace
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.2
- import: https://fonts.googleapis.com/css2?family=VT323&display=swap

## Radius
- sm: 0px
- md: 0px
- lg: 0px
- full: 999px

## Spacing
- unit: 4

## Shadows
- sm: 0 1px 4px rgba(0,0,0,0.3)
- md: 0 4px 16px rgba(0,0,0,0.3)
- lg: 0 8px 32px rgba(0,0,0,0.4)

## Semantics
- ornament: none
- edge: sharp
- density: compact
- hero-visual: terminal
- card-hover: border
- divider: line
- motion: none
- transition: fast

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
Pure phosphor-green-on-black CRT terminal aesthetic with pixel-style VT323 font and zero decoration. Every element channels an old-school command-line interface with authentic retro computing feel.
