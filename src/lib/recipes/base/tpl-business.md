---
id: tpl-business
name: Business
category: dark-tech
mood: [dark, professional, modern, tech]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #0a0a1a |
| bg-card | rgba(26,16,64,0.7) |
| bg-card-solid | #1a1040 |
| bg-tag | rgba(108,99,255,0.1) |
| text | #e0e0f0 |
| text-muted | #8080a0 |
| accent | #6c63ff |
| accent-soft | rgba(108,99,255,0.12) |
| accent-alt | #a855f7 |
| line | rgba(108,99,255,0.15) |
| green | #22d3ee |

## Typography
- heading: "Inter", -apple-system, sans-serif
- body: "Inter", -apple-system, sans-serif
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
- sm: 0 1px 4px rgba(0,0,0,0.3)
- md: 0 4px 16px rgba(0,0,0,0.3)
- lg: 0 8px 32px rgba(0,0,0,0.4)

## Semantics
- ornament: minimal
- edge: soft
- density: normal
- hero-visual: orbital
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
A deep navy-indigo backdrop with electric purple accents suited for professional tech portfolios. Clean Inter typography and understated motion keep the focus on credentials and work.
