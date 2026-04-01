---
id: watercolor
name: Watercolor
category: warm-organic
mood: [light, soft, artistic, dreamy]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #faf6f1 |
| bg-card | rgba(255,255,255,0.7) |
| bg-card-solid | #fff8f2 |
| bg-tag | rgba(155,142,196,0.1) |
| text | #3a3550 |
| text-muted | #8a82a0 |
| accent | #9b8ec4 |
| accent-soft | rgba(155,142,196,0.12) |
| accent-alt | #e8a0bf |
| line | rgba(155,142,196,0.18) |
| green | #7dab8e |

## Typography
- heading: "Caveat", "Comic Sans MS", cursive
- body: "Lora", Georgia, "Times New Roman", serif
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.333
- import: https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Caveat:wght@400;500;600;700&display=swap

## Radius
- sm: 14px
- md: 28px
- lg: 36px
- full: 999px

## Spacing
- unit: 12

## Shadows
- sm: 0 1px 4px rgba(0,0,0,0.06)
- md: 0 4px 16px rgba(0,0,0,0.08)
- lg: 0 8px 32px rgba(0,0,0,0.12)

## Semantics
- ornament: rich
- edge: pill
- density: spacious
- hero-visual: none
- card-hover: lift
- divider: wave
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
  transition: transform 0.3s, box-shadow 0.3s;
}
.card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
}
```

## Design Notes
A delicate, cream-toned palette with soft lavender and rose accents that evoke wet pigment on textured paper. Handwritten headings and pill-shaped corners give it an intimate, artisanal character.
