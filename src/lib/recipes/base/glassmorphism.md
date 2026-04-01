---
id: glassmorphism
name: Glassmorphism
category: luxury-glass
mood: [dark, elegant, translucent, modern]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #1a1225 |
| bg-card | rgba(255,255,255,0.07) |
| bg-card-solid | rgba(30,20,45,0.9) |
| bg-tag | rgba(180,130,200,0.12) |
| text | #f0e8f5 |
| text-muted | #b0a0c0 |
| accent | #c89bda |
| accent-soft | rgba(180,130,200,0.15) |
| accent-alt | #e8b88a |
| line | rgba(255,255,255,0.1) |
| green | #34d399 |

## Typography
- heading: "Cormorant Garamond", Georgia, serif
- body: "Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.25
- import: https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&display=swap

## Radius
- sm: 10px
- md: 20px
- lg: 28px
- full: 999px

## Spacing
- unit: 8

## Shadows
- sm: 0 1px 4px rgba(200,155,218,0.15)
- md: 0 4px 16px rgba(200,155,218,0.12)
- lg: 0 8px 32px rgba(200,155,218,0.18)

## Semantics
- ornament: moderate
- edge: round
- density: normal
- hero-visual: orbital
- card-hover: lift
- divider: gradient
- motion: moderate
- transition: normal

## Card CSS
```css
.card {
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(20px) saturate(1.4);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: var(--radius-card);
  overflow: hidden;
  position: relative;
  transition: transform 0.4s, border-color 0.4s, box-shadow 0.4s;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}
.card:hover {
  transform: translateY(-4px);
  border-color: rgba(255,255,255,0.2);
  box-shadow: 0 16px 48px rgba(70,130,220,0.15);
}
.card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%);
  pointer-events: none;
  z-index: 1;
}
```

## Design Notes
Frosted glass panels floating on a deep plum background, with soft lavender and amber highlights creating a luxurious, translucent depth. The heavy blur and subtle gradients produce a premium, ethereal feel.
