---
id: editorial
name: Editorial
category: editorial-refined
mood: [light, elegant, sophisticated, typographic]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #faf9f6 |
| bg-card | #ffffff |
| bg-card-solid | #f5f2ec |
| bg-tag | rgba(120,100,80,0.08) |
| text | #2c2c2c |
| text-muted | #8a8078 |
| accent | #b8860b |
| accent-soft | rgba(184,134,11,0.08) |
| accent-alt | #6b4e3d |
| line | rgba(120,100,80,0.15) |
| green | #6b4e3d |

## Typography
- heading: "Playfair Display", Georgia, serif
- body: "Libre Baskerville", Georgia, "Times New Roman", serif
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.333
- import: https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap

## Radius
- sm: 2px
- md: 2px
- lg: 4px
- full: 999px

## Spacing
- unit: 12

## Shadows
- sm: 0 1px 4px rgba(0,0,0,0.06)
- md: 0 4px 16px rgba(0,0,0,0.08)
- lg: 0 8px 32px rgba(0,0,0,0.12)

## Semantics
- ornament: minimal
- edge: sharp
- density: spacious
- hero-visual: poster
- card-hover: border
- divider: line
- motion: subtle
- transition: normal

## Card CSS
```css
.card {
  background: var(--color-bg-card);
  border-bottom: 2px solid var(--color-line);
  border-radius: 0;
  overflow: hidden;
  position: relative;
  padding-bottom: 1rem;
  transition: border-color 0.3s;
}
.card:hover {
  border-color: var(--color-accent);
}
```

## Design Notes
A refined, magazine-inspired layout with warm off-white backgrounds and gold accents evoking quality print editorial. Serif typography and bottom-border cards create a structured, literary reading experience.
