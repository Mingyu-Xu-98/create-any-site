---
id: retro
name: Retro
category: retro-vintage
mood: [warm, vintage, nostalgic, tactile]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #f4e8c1 |
| bg-card | rgba(244,232,193,0.8) |
| bg-card-solid | #efe0b8 |
| bg-tag | rgba(160,82,45,0.1) |
| text | #2d2d2d |
| text-muted | #6b5b4b |
| accent | #c0392b |
| accent-soft | rgba(192,57,43,0.1) |
| accent-alt | #d4881c |
| line | rgba(100,80,50,0.2) |
| green | #27ae60 |

## Typography
- heading: "Space Mono", "Courier New", monospace
- body: "IBM Plex Serif", Georgia, "Times New Roman", serif
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.25
- import: https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap

## Radius
- sm: 2px
- md: 2px
- lg: 4px
- full: 999px

## Spacing
- unit: 8

## Shadows
- sm: 0 1px 4px rgba(0,0,0,0.06)
- md: 0 4px 16px rgba(0,0,0,0.08)
- lg: 0 8px 32px rgba(0,0,0,0.12)

## Semantics
- ornament: moderate
- edge: sharp
- density: normal
- hero-visual: none
- card-hover: lift
- divider: line
- motion: subtle
- transition: fast

## Card CSS
```css
.card {
  background: var(--color-bg-card);
  border: 2px solid var(--color-line);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  box-shadow: 4px 4px 0 var(--color-line);
  transition: transform 0.2s, box-shadow 0.2s;
}
.card:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 var(--color-line);
}
```

## Design Notes
A warm yellowed-paper palette with bold red accents and hard drop-shadows, reminiscent of vintage print advertisements and typewriter-era design. Monospace headings and sharp edges complete the throwback aesthetic.
