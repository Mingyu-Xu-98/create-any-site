/**
 * Card Style Library — hover effects and card treatments.
 * Applied to project cards, skill cards, testimonial cards, etc.
 */
import { registerAsset } from "./registry";

registerAsset({
  id: "card-glass-glow",
  category: "card-style",
  name: "Glass Glow",
  nameCn: "玻璃发光",
  description: "Frosted glass with border glow on hover",
  mood: ["dark", "glassmorphism", "tech", "luxury"],
  resolve: () => ({
    css: `.card-styled { background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; transition: all 0.4s cubic-bezier(0.16,1,0.3,1); }
.card-styled:hover { border-color: rgba(255,255,255,0.15); box-shadow: 0 8px 32px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.05); transform: translateY(-2px); }`,
  }),
});

registerAsset({
  id: "card-paper-shadow",
  category: "card-style",
  name: "Paper Shadow",
  nameCn: "纸张阴影",
  description: "Warm paper feel with soft shadow lift",
  mood: ["light", "editorial", "warm", "organic"],
  resolve: () => ({
    css: `.card-styled { background: #fff; border: 1px solid rgba(0,0,0,0.06); border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); transition: all 0.3s ease; }
.card-styled:hover { box-shadow: 0 12px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04); transform: translateY(-4px); }`,
  }),
});

registerAsset({
  id: "card-border-accent",
  category: "card-style",
  name: "Border Accent",
  nameCn: "强调边框",
  description: "Clean card with accent color border on hover",
  mood: ["light", "minimal", "clean", "product"],
  resolve: () => ({
    css: `.card-styled { background: var(--color-bg-card, #fff); border: 1px solid var(--color-line, rgba(0,0,0,0.08)); border-radius: 12px; transition: all 0.25s ease; }
.card-styled:hover { border-color: var(--color-accent, #6366f1); box-shadow: 0 0 0 3px rgba(99,102,241,0.08); }`,
  }),
});

registerAsset({
  id: "card-lift-shadow",
  category: "card-style",
  name: "Lift Shadow",
  nameCn: "浮起阴影",
  description: "Dramatic lift with deep shadow, bold feel",
  mood: ["bold", "creative", "playful", "product"],
  resolve: () => ({
    css: `.card-styled { background: var(--color-bg-card, #fff); border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1); }
.card-styled:hover { transform: translateY(-8px) scale(1.01); box-shadow: 0 20px 60px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06); }`,
  }),
});

registerAsset({
  id: "card-outline-clean",
  category: "card-style",
  name: "Outline Clean",
  nameCn: "线框简洁",
  description: "No fill, just outline border, minimal brutalist",
  mood: ["light", "dark", "brutalist", "minimal", "developer"],
  resolve: () => ({
    css: `.card-styled { background: transparent; border: 1px solid var(--color-line, rgba(128,128,128,0.2)); border-radius: 0; padding: 1.5rem; transition: all 0.2s ease; }
.card-styled:hover { border-color: var(--color-text, #111); background: rgba(128,128,128,0.03); }`,
  }),
});

registerAsset({
  id: "card-neon-edge",
  category: "card-style",
  name: "Neon Edge",
  nameCn: "霓虹边缘",
  description: "Glowing neon border on hover, cyberpunk feel",
  mood: ["dark", "cyberpunk", "tech", "neon"],
  resolve: () => ({
    css: `.card-styled { background: rgba(10,10,30,0.6); border: 1px solid rgba(0,255,240,0.1); border-radius: 8px; transition: all 0.3s ease; }
.card-styled:hover { border-color: rgba(0,255,240,0.4); box-shadow: 0 0 20px rgba(0,255,240,0.1), inset 0 0 20px rgba(0,255,240,0.03); }`,
  }),
});

// ---- New card styles ----

registerAsset({
  id: "card-watercolor-edge",
  category: "card-style",
  name: "Watercolor Edge",
  nameCn: "水彩边缘",
  description: "Soft watercolor bleed effect on card borders, artistic feel",
  mood: ["light", "watercolor", "organic", "creative", "warm"],
  resolve: () => ({
    css: `.card-styled { background: rgba(255,255,255,0.85); border: none; border-radius: 20px; box-shadow: 0 2px 12px rgba(155,142,196,0.08); transition: all 0.4s ease; position: relative; overflow: hidden; }
.card-styled::before { content: ""; position: absolute; inset: -2px; border-radius: 22px; background: linear-gradient(135deg, rgba(155,142,196,0.3), rgba(232,160,191,0.3), rgba(125,171,142,0.2)); z-index: -1; opacity: 0.5; transition: opacity 0.4s ease; }
.card-styled:hover { box-shadow: 0 8px 32px rgba(155,142,196,0.12); transform: translateY(-3px); } .card-styled:hover::before { opacity: 0.8; }`,
  }),
});

registerAsset({
  id: "card-terminal-box",
  category: "card-style",
  name: "Terminal Box",
  nameCn: "终端卡片",
  description: "Monospace terminal-style card with green border",
  mood: ["dark", "terminal", "developer", "tech", "cyberpunk"],
  resolve: () => ({
    css: `.card-styled { background: rgba(0,255,65,0.03); border: 1px solid rgba(0,255,65,0.15); border-radius: 0; font-family: var(--font-mono, monospace); transition: all 0.2s ease; position: relative; }
.card-styled::before { content: "> "; position: absolute; top: 8px; left: 10px; font-size: 10px; color: rgba(0,255,65,0.4); }
.card-styled:hover { border-color: rgba(0,255,65,0.4); background: rgba(0,255,65,0.06); box-shadow: 0 0 15px rgba(0,255,65,0.05); }`,
  }),
});

registerAsset({
  id: "card-gradient-border",
  category: "card-style",
  name: "Gradient Border",
  nameCn: "渐变边框",
  description: "Animated gradient border that shifts colors on hover",
  mood: ["dark", "gradient", "aurora", "vaporwave", "modern"],
  resolve: () => ({
    css: `.card-styled { background: var(--color-bg-card, rgba(10,10,30,0.8)); border-radius: 16px; position: relative; transition: transform 0.3s ease; }
.card-styled::before { content: ""; position: absolute; inset: -1px; border-radius: 17px; background: linear-gradient(135deg, var(--color-accent, #00d4aa), var(--color-accent-alt, #7b68ee), var(--color-accent, #00d4aa)); background-size: 200% 200%; z-index: -1; opacity: 0.3; transition: opacity 0.3s ease; }
.card-styled:hover { transform: translateY(-3px); } .card-styled:hover::before { opacity: 0.7; animation: gradient-shift 3s ease infinite; }
@keyframes gradient-shift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`,
  }),
});
