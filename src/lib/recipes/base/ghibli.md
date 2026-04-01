---
id: ghibli
name: Ghibli
category: warm-organic
mood: [warm, whimsical, nostalgic, organic]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #f5efe6 |
| bg-card | rgba(255,253,247,0.78) |
| bg-card-solid | #fffdf7 |
| bg-tag | rgba(125,155,95,0.12) |
| text | #3d3929 |
| text-muted | #8a7f6e |
| accent | #7d9b5f |
| accent-soft | rgba(125,155,95,0.15) |
| accent-alt | #e8a87c |
| line | rgba(139,119,90,0.18) |
| green | #7d9b5f |

## Typography
- heading: "Noto Serif SC", Georgia, serif
- body: "Noto Serif SC", Georgia, "Times New Roman", serif
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.333
- import: https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;700&display=swap

## Radius
- sm: 10px
- md: 20px
- lg: 28px
- full: 999px

## Spacing
- unit: 12

## Shadows
- sm: 0 1px 4px rgba(0,0,0,0.06)
- md: 0 4px 16px rgba(0,0,0,0.08)
- lg: 0 8px 32px rgba(0,0,0,0.12)

## Semantics
- ornament: rich
- edge: round
- density: spacious
- hero-visual: nature
- card-hover: rotate
- divider: wave
- motion: moderate
- transition: slow

## Card CSS
```css
.card {
  background: var(--color-bg-card);
  backdrop-filter: blur(8px) saturate(1.2);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-card);
  box-shadow: 0 2px 12px rgba(139,119,90,0.08);
  overflow: hidden;
  position: relative;
  transition: transform 0.4s cubic-bezier(0.4,0,0.2,1), box-shadow 0.4s ease;
}
.card:hover {
  transform: translateY(-4px) rotate(-0.5deg);
  box-shadow: 0 12px 32px rgba(139,119,90,0.14);
}
```

## Design Notes
A soft parchment palette inspired by Studio Ghibli's hand-painted worlds, with mossy greens and warm peach accents. Rounded corners and gentle motion evoke a storybook sense of wonder.
