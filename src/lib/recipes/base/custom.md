---
id: custom
name: Custom
category: light-clean
mood: [light, neutral, clean, default]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #ffffff |
| bg-card | #f8f8f8 |
| bg-card-solid | #f5f5f5 |
| bg-tag | rgba(0,0,0,0.04) |
| text | #111111 |
| text-muted | #888888 |
| accent | #111111 |
| accent-soft | rgba(0,0,0,0.04) |
| accent-alt | #555555 |
| line | rgba(0,0,0,0.08) |
| green | #111111 |

## Typography
- heading: -apple-system, sans-serif
- body: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.25
- import:

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
  transition: transform 0.3s, box-shadow 0.3s;
}
.card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
}
```

## Design Notes
A neutral system-font fallback theme with monochrome palette, serving as the default when no specific theme is selected. Clean and unopinionated, it provides a solid baseline that can be fully customized.
