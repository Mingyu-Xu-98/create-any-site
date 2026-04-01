---
id: ink-wash
name: Ink Wash
category: editorial-refined
mood: [light, traditional, elegant, zen]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #f5f0e8 |
| bg-card | rgba(255,252,245,0.85) |
| bg-card-solid | #efe8d8 |
| bg-tag | rgba(44,44,44,0.06) |
| text | #2c2c2c |
| text-muted | #6b6560 |
| accent | #2c2c2c |
| accent-soft | rgba(44,44,44,0.08) |
| accent-alt | #c0392b |
| line | rgba(44,44,44,0.15) |
| green | #5a7247 |

## Typography
- heading: "Ma Shan Zheng", "STKaiti", "KaiTi", cursive
- body: "Noto Serif SC", Georgia, "Times New Roman", serif
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.333
- import: https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;700&family=Ma+Shan+Zheng&display=swap

## Radius
- sm: 2px
- md: 4px
- lg: 8px
- full: 999px

## Spacing
- unit: 12

## Shadows
- sm: 0 1px 4px rgba(0,0,0,0.06)
- md: 0 4px 16px rgba(0,0,0,0.08)
- lg: 0 8px 32px rgba(0,0,0,0.12)

## Semantics
- ornament: moderate
- edge: sharp
- density: spacious
- hero-visual: none
- card-hover: border
- divider: line
- motion: subtle
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
A rice-paper palette with ink-black text and vermillion accents inspired by traditional Chinese brush painting. Calligraphic headings and restrained motion evoke the meditative discipline of ink wash art.
