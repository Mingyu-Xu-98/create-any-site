---
id: craft-paper
name: Craft Paper
category: warm-organic
mood: [warm, handmade, tactile, playful]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #e8d5b7 |
| bg-card | rgba(255,248,235,0.8) |
| bg-card-solid | #f0e0c8 |
| bg-tag | rgba(139,69,19,0.1) |
| text | #3e2723 |
| text-muted | #795548 |
| accent | #8b4513 |
| accent-soft | rgba(139,69,19,0.1) |
| accent-alt | #c0392b |
| line | rgba(139,69,19,0.2) |
| green | #558b2f |

## Typography
- heading: "Permanent Marker", Impact, cursive
- body: "Patrick Hand", "Comic Sans MS", cursive
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.25
- import: https://fonts.googleapis.com/css2?family=Patrick+Hand&family=Permanent+Marker&display=swap

## Radius
- sm: 2px
- md: 4px
- lg: 8px
- full: 999px

## Spacing
- unit: 8

## Shadows
- sm: 0 1px 4px rgba(0,0,0,0.06)
- md: 0 4px 16px rgba(0,0,0,0.08)
- lg: 0 8px 32px rgba(0,0,0,0.12)

## Semantics
- ornament: rich
- edge: soft
- density: normal
- hero-visual: none
- card-hover: lift
- divider: wave
- motion: subtle
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
A kraft-brown paper texture with saddle brown and crimson accents that feel hand-stamped and handmade. Marker-style headings and handwritten body text give it a scrapbook, DIY workshop personality.
