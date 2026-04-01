---
id: tpl-blog
name: Blog
category: editorial-refined
mood: [light, readable, warm, editorial]
type: base
---

## Colors
| token | value |
|-------|-------|
| bg | #fdfbf7 |
| bg-card | #ffffff |
| bg-card-solid | #ffffff |
| bg-tag | rgba(184,92,56,0.08) |
| text | #1c1917 |
| text-muted | #57534e |
| accent | #b85c38 |
| accent-soft | rgba(184,92,56,0.12) |
| accent-alt | #d4825e |
| line | rgba(28,25,23,0.1) |
| green | #57534e |

## Typography
- heading: "Fraunces", Georgia, serif
- body: "Inter", -apple-system, sans-serif
- mono: "SF Mono", "Fira Code", Menlo, Consolas, monospace
- scale-ratio: 1.333
- import: https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,700;9..144,900&family=Inter:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap

## Radius
- sm: 8px
- md: 16px
- lg: 24px
- full: 999px

## Spacing
- unit: 12

## Shadows
- sm: 0 1px 4px rgba(0,0,0,0.06)
- md: 0 4px 16px rgba(0,0,0,0.08)
- lg: 0 8px 32px rgba(0,0,0,0.12)

## Semantics
- ornament: minimal
- edge: soft
- density: spacious
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
  transition: transform 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(184,92,56,0.12);
  border-color: var(--color-accent);
}
.card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--color-accent);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.4s ease;
}
.card:hover::before {
  transform: scaleX(1);
}
```

## Design Notes
A warm ivory reading surface with terracotta accents, pairing the expressive Fraunces serif heading with clean Inter body text. The reveal-on-hover top accent bar adds subtle editorial polish to a content-focused layout.
