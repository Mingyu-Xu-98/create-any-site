---
id: cyberpunk
name: Cyberpunk
category: neon-cyber
mood: [dark, techy, futuristic, neon]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #0a0a1a |
| bg-card | rgba(10,15,30,0.7) |
| bg-card-solid | #0e1225 |
| bg-tag | rgba(0,255,240,0.08) |
| text | #e0e8f0 |
| text-muted | #6b7fa0 |
| accent | #00fff0 |
| accent-soft | rgba(0,255,240,0.1) |
| accent-alt | #ff00ff |
| line | rgba(0,255,240,0.12) |
| green | #00ff88 |

## Typography
- heading: "JetBrains Mono", "Fira Code", monospace
- body: "JetBrains Mono", "Fira Code", "SF Mono", Menlo, monospace
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.2
- import: https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap

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
- hero-visual: terminal
- card-hover: glow
- divider: line
- motion: moderate
- transition: fast

## Card CSS
```css
.card {
  background: var(--color-bg-card);
  backdrop-filter: blur(12px);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  transition: border-color 0.3s, box-shadow 0.3s;
}
.card:hover {
  border-color: var(--color-accent);
  box-shadow: 0 0 20px rgba(0,255,240,0.15), inset 0 0 20px rgba(0,255,240,0.03);
}
.card::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--color-accent), transparent);
  opacity: 0;
  transition: opacity 0.3s;
}
.card:hover::after {
  opacity: 1;
}
```

## Design Notes
A high-contrast dark theme with electric cyan and magenta accents evoking a neon-lit cyberpunk cityscape. Monospace typography and sharp edges reinforce the hacker-terminal aesthetic.
