---
id: gradient-mesh
name: Gradient Mesh
category: neon-cyber
mood: [dark, dreamy, gradient, modern]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #0f0f1a |
| bg-card | rgba(255,255,255,0.06) |
| bg-card-solid | rgba(20,15,40,0.9) |
| bg-tag | rgba(161,140,209,0.15) |
| text | #f0eaf8 |
| text-muted | #a090c0 |
| accent | #a18cd1 |
| accent-soft | rgba(161,140,209,0.12) |
| accent-alt | #ff9a9e |
| line | rgba(255,255,255,0.08) |
| green | #96fbc4 |

## Typography
- heading: "Plus Jakarta Sans", -apple-system, sans-serif
- body: "Plus Jakarta Sans", -apple-system, sans-serif
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.25
- import: https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap

## Radius
- sm: 8px
- md: 16px
- lg: 24px
- full: 999px

## Spacing
- unit: 8

## Shadows
- sm: 0 1px 4px rgba(161,140,209,0.15)
- md: 0 4px 16px rgba(161,140,209,0.12)
- lg: 0 8px 32px rgba(161,140,209,0.18)

## Semantics
- ornament: moderate
- edge: soft
- density: normal
- hero-visual: orbital
- card-hover: lift
- divider: gradient
- motion: rich
- transition: normal

## Card CSS
```css
.card {
  background: rgba(255,255,255,0.04);
  backdrop-filter: blur(24px) saturate(1.3);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  transition: transform 0.4s, border-color 0.4s, box-shadow 0.4s;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}
.card:hover {
  transform: translateY(-4px);
  border-color: rgba(161,140,209,0.3);
  box-shadow: 0 16px 48px rgba(161,140,209,0.15);
}
.card::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(161,140,209,0.05) 0%, rgba(255,154,158,0.05) 100%);
  pointer-events: none;
  z-index: 1;
}
```

## Design Notes
A deep indigo canvas overlaid with soft purple-to-pink gradient washes, creating a dreamy mesh of color. Heavy backdrop blur and accent-tinted shadows give every element a luminous, floating quality.
