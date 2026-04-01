---
id: minimalist
name: Minimalist
category: light-clean
mood: [light, clean, simple, modern]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #ffffff |
| bg-card | #f9fafb |
| bg-card-solid | #f3f4f6 |
| bg-tag | rgba(0,0,0,0.05) |
| text | #111827 |
| text-muted | #6b7280 |
| accent | #111827 |
| accent-soft | rgba(17,24,39,0.06) |
| accent-alt | #4b5563 |
| line | rgba(0,0,0,0.08) |
| green | #10b981 |

## Typography
- heading: "Inter", -apple-system, sans-serif
- body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.25
- import: https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap

## Radius
- sm: 6px
- md: 12px
- lg: 20px
- full: 999px

## Spacing
- unit: 8

## Shadows
- sm: 0 1px 4px rgba(0,0,0,0.06)
- md: 0 4px 16px rgba(0,0,0,0.08)
- lg: 0 8px 32px rgba(0,0,0,0.12)

## Semantics
- ornament: none
- edge: soft
- density: normal
- hero-visual: none
- card-hover: lift
- divider: line
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
  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.06);
  border-color: transparent;
}
```

## Design Notes
A pure white canvas with neutral gray accents and generous whitespace, letting content speak for itself. The absence of decoration creates an effortlessly elegant and readable experience.
