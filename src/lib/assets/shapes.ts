/**
 * SVG Shape Library — decorative elements for visual identity.
 * Lines, badges, dividers, corner accents, HUD elements.
 */
import { registerAsset } from "./registry";

registerAsset({
  id: "shape-accent-line",
  category: "shape",
  name: "Accent Line",
  nameCn: "强调线",
  description: "Horizontal accent line with gradient, used as section divider",
  mood: ["any", "editorial", "minimal", "elegant"],
  resolve: () => ({
    svgs: {
      divider: `<svg width="120" height="2" viewBox="0 0 120 2" fill="none"><rect width="120" height="2" rx="1" fill="url(#g)"/><defs><linearGradient id="g" x1="0" y1="1" x2="120" y2="1"><stop stop-color="var(--color-accent,#6366f1)"/><stop offset="1" stop-color="transparent"/></linearGradient></defs></svg>`,
    },
    css: `.shape-divider { display: block; margin: 2rem 0; opacity: 0.6; }`,
  }),
});

registerAsset({
  id: "shape-corner-bracket",
  category: "shape",
  name: "Corner Brackets",
  nameCn: "角标括号",
  description: "Technical corner brackets around sections or images",
  mood: ["tech", "cyberpunk", "lab", "developer"],
  resolve: () => ({
    css: `.corner-bracket { position: relative; padding: 1.5rem; }
.corner-bracket::before, .corner-bracket::after { content: ""; position: absolute; width: 24px; height: 24px; border-color: var(--color-accent, #00fff0); border-style: solid; opacity: 0.3; }
.corner-bracket::before { top: 0; left: 0; border-width: 2px 0 0 2px; }
.corner-bracket::after { bottom: 0; right: 0; border-width: 0 2px 2px 0; }`,
  }),
});

registerAsset({
  id: "shape-numbered-badge",
  category: "shape",
  name: "Numbered Badge",
  nameCn: "数字徽章",
  description: "Circled number badges for ordered items (01, 02, 03...)",
  mood: ["any", "editorial", "creative", "bold"],
  resolve: () => ({
    css: `.numbered-badge { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; border: 2px solid var(--color-accent, #6366f1); font-size: 14px; font-weight: 700; color: var(--color-accent, #6366f1); flex-shrink: 0; }`,
  }),
});

registerAsset({
  id: "shape-wave-divider",
  category: "shape",
  name: "Wave Divider",
  nameCn: "波浪分割",
  description: "Organic wave SVG between sections",
  mood: ["organic", "playful", "creative", "warm"],
  resolve: () => ({
    svgs: {
      wave: `<svg viewBox="0 0 1200 60" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><path d="M0 30 C200 0 400 60 600 30 C800 0 1000 60 1200 30 V60 H0 Z" fill="var(--color-bg-card,#f5f5f5)"/></svg>`,
    },
    css: `.wave-divider { width: 100%; height: 40px; margin: -1px 0; } .wave-divider svg { width: 100%; height: 100%; display: block; }`,
  }),
});

registerAsset({
  id: "shape-hud-frame",
  category: "shape",
  name: "HUD Frame",
  nameCn: "HUD 框架",
  description: "Sci-fi heads-up display decorative frame",
  mood: ["dark", "cyberpunk", "tech", "futuristic"],
  resolve: () => ({
    css: `.hud-frame { position: relative; border: 1px solid rgba(0,255,240,0.15); }
.hud-frame::before { content: ""; position: absolute; top: -1px; left: 12px; width: 40px; height: 3px; background: var(--color-accent, #00fff0); }
.hud-frame::after { content: ""; position: absolute; bottom: -1px; right: 12px; width: 40px; height: 3px; background: var(--color-accent, #00fff0); }
.hud-frame-label { position: absolute; top: -10px; right: 16px; font-size: 8px; text-transform: uppercase; letter-spacing: 0.2em; color: var(--color-accent, #00fff0); opacity: 0.5; background: var(--color-bg, #0a0a1a); padding: 0 6px; }`,
  }),
});

registerAsset({
  id: "shape-dot-grid",
  category: "shape",
  name: "Dot Grid",
  nameCn: "点阵网格",
  description: "Subtle dot grid pattern as background decoration",
  mood: ["light", "minimal", "clean", "product"],
  resolve: () => ({
    css: `.dot-grid-bg { background-image: radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px); background-size: 20px 20px; }`,
  }),
});

// ---- New shapes ----

registerAsset({
  id: "shape-brush-stroke",
  category: "shape",
  name: "Brush Stroke",
  nameCn: "笔刷划痕",
  description: "Hand-painted brush stroke underline or divider",
  mood: ["watercolor", "creative", "organic", "ink-wash", "warm"],
  resolve: () => ({
    svgs: {
      brushStroke: `<svg viewBox="0 0 200 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 8c20-4 40 2 60-1s40-5 60 0 40 4 60-1 16-4 16 0" stroke="var(--color-accent,#9b8ec4)" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.6"/></svg>`,
    },
    css: `.shape-brush { display: inline-block; width: 120px; height: 12px; margin: 1rem 0; opacity: 0.7; }`,
  }),
});

registerAsset({
  id: "shape-pixel-border",
  category: "shape",
  name: "Pixel Border",
  nameCn: "像素边框",
  description: "Retro 8-bit pixel art border around sections",
  mood: ["retro", "vaporwave", "terminal", "playful", "creative"],
  resolve: () => ({
    css: `.pixel-border { position: relative; border: 3px solid var(--color-accent, #ff71ce); image-rendering: pixelated; }
.pixel-border::before, .pixel-border::after { content: ""; position: absolute; background: var(--color-accent, #ff71ce); }
.pixel-border::before { width: 6px; height: 6px; top: -3px; left: -3px; } .pixel-border::after { width: 6px; height: 6px; bottom: -3px; right: -3px; }`,
  }),
});

registerAsset({
  id: "shape-seal-stamp",
  category: "shape",
  name: "Seal Stamp",
  nameCn: "印章",
  description: "Traditional Chinese red seal stamp, placed as decoration",
  mood: ["ink-wash", "editorial", "warm", "organic", "any"],
  resolve: () => ({
    svgs: {
      seal: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="40" height="40" rx="4" stroke="#c0392b" stroke-width="2.5" fill="none" opacity="0.7"/><text x="24" y="30" text-anchor="middle" font-size="16" font-weight="700" fill="#c0392b" opacity="0.8" font-family="serif">印</text></svg>`,
    },
    css: `.shape-seal { display: inline-block; width: 48px; height: 48px; transform: rotate(-8deg); opacity: 0.65; }`,
  }),
});
