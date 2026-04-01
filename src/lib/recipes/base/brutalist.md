---
id: brutalist
name: Brutalist
category: dark-tech
mood: [dark, raw, utilitarian, monospace]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #1d1d1d |
| bg-card | rgba(255,255,255,0.04) |
| bg-card-solid | #252525 |
| bg-tag | rgba(255,255,255,0.08) |
| text | #e0e0e0 |
| text-muted | #888888 |
| accent | #4493f8 |
| accent-soft | rgba(68,147,248,0.1) |
| accent-alt | #79c0ff |
| line | rgba(255,255,255,0.1) |
| green | #4493f8 |

## Typography
- heading: "Fira Code", "JetBrains Mono", monospace
- body: "Fira Code", "JetBrains Mono", "SF Mono", Consolas, monospace
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.2
- import: https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&display=swap

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
- hero-visual: none
- card-hover: border
- divider: none
- motion: none
- transition: fast

## Card CSS
```css
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-line);
  border-radius: 0;
  overflow: hidden;
  position: relative;
  transition: border-color 0.2s;
}
.card:hover {
  border-color: var(--color-text-muted);
}
```

## Design Notes
Raw, unadorned dark interface with zero border radius and monospace everything, inspired by GitHub's dark mode and brutalist web design. No decorative elements -- pure function over form.
