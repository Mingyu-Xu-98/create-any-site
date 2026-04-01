/**
 * Texture Library — background overlays that give depth and character.
 * Each texture is a CSS overlay applied via ::after pseudo-element.
 */
import { registerAsset } from "./registry";

// ---- Grain / Film ----

registerAsset({
  id: "grain-film",
  category: "texture",
  name: "Film Grain",
  nameCn: "胶片颗粒",
  description: "Subtle film grain overlay, adds analog warmth",
  mood: ["dark", "cinematic", "retro", "editorial"],
  resolve: () => ({
    css: `.texture-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 9999; opacity: 0.035; mix-blend-mode: overlay; }
.texture-overlay::after { content: ""; position: absolute; inset: -50%; width: 200%; height: 200%; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); animation: grain-drift 8s steps(10) infinite; }
@keyframes grain-drift { 0% { transform: translate(0,0); } 10% { transform: translate(-5%,-10%); } 20% { transform: translate(-15%,5%); } 30% { transform: translate(7%,-25%); } 40% { transform: translate(-5%,25%); } 50% { transform: translate(-15%,10%); } 60% { transform: translate(15%,0%); } 70% { transform: translate(0%,15%); } 80% { transform: translate(3%,35%); } 90% { transform: translate(-10%,10%); } }`,
    classes: { body: "texture-grain" },
  }),
});

registerAsset({
  id: "noise-analog",
  category: "texture",
  name: "Analog Noise",
  nameCn: "模拟噪点",
  description: "Dense analog noise, strong texture feel",
  mood: ["dark", "brutalist", "tech", "experimental"],
  resolve: () => ({
    css: `.texture-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 9999; opacity: 0.06; mix-blend-mode: multiply; }
.texture-overlay::after { content: ""; position: absolute; inset: 0; width: 100%; height: 100%; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }`,
  }),
});

registerAsset({
  id: "paper-cream",
  category: "texture",
  name: "Cream Paper",
  nameCn: "奶油纸张",
  description: "Warm paper texture, subtle and elegant",
  mood: ["light", "editorial", "warm", "organic"],
  resolve: () => ({
    css: `.texture-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 9999; opacity: 0.03; }
.texture-overlay::after { content: ""; position: absolute; inset: 0; background: repeating-conic-gradient(rgba(139,119,90,0.03) 0% 25%, transparent 0% 50%) 0 0 / 4px 4px; }`,
  }),
});

registerAsset({
  id: "scanline-crt",
  category: "texture",
  name: "CRT Scanlines",
  nameCn: "CRT 扫描线",
  description: "Retro CRT monitor scanlines",
  mood: ["dark", "tech", "retro", "cyberpunk"],
  resolve: () => ({
    css: `.texture-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 9999; opacity: 0.04; }
.texture-overlay::after { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.15) 1px, rgba(0,0,0,0.15) 2px); background-size: 100% 3px; }`,
  }),
});

registerAsset({
  id: "blur-bokeh",
  category: "texture",
  name: "Bokeh Blur",
  nameCn: "散景光斑",
  description: "Floating blurred light circles, dreamy atmosphere",
  mood: ["dark", "luxury", "cinematic", "glassmorphism"],
  resolve: () => ({
    css: `.bokeh-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.bokeh-bg .orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.15; }
.bokeh-bg .orb-1 { width: 300px; height: 300px; background: var(--color-accent, #6366f1); top: 10%; right: 15%; animation: bokeh-float-1 20s ease-in-out infinite; }
.bokeh-bg .orb-2 { width: 200px; height: 200px; background: var(--color-accent-alt, #ec4899); bottom: 20%; left: 10%; animation: bokeh-float-2 25s ease-in-out infinite; }
.bokeh-bg .orb-3 { width: 250px; height: 250px; background: var(--color-accent, #6366f1); top: 50%; left: 50%; animation: bokeh-float-3 18s ease-in-out infinite; }
@keyframes bokeh-float-1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-40px,30px) scale(1.1); } }
@keyframes bokeh-float-2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-20px) scale(1.05); } }
@keyframes bokeh-float-3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-20px,-30px) scale(0.95); } }`,
    classes: { bgElement: "bokeh-bg" },
  }),
});

registerAsset({
  id: "grid-subtle",
  category: "texture",
  name: "Subtle Grid",
  nameCn: "微网格",
  description: "Faint grid lines, technical/clean feel",
  mood: ["light", "tech", "minimal", "product"],
  resolve: () => ({
    css: `.texture-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.4; background-image: linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px); background-size: 48px 48px; }`,
  }),
});

// ---- New textures ----

registerAsset({
  id: "watercolor-wash",
  category: "texture",
  name: "Watercolor Wash",
  nameCn: "水彩晕染",
  description: "Soft watercolor paint wash edges, artistic and dreamy",
  mood: ["light", "watercolor", "organic", "creative", "warm"],
  resolve: () => ({
    css: `.texture-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.08; }
.texture-overlay::after { content: ""; position: absolute; inset: 0; background:
  radial-gradient(ellipse at 15% 20%, rgba(155,142,196,0.4) 0%, transparent 50%),
  radial-gradient(ellipse at 85% 30%, rgba(232,160,191,0.3) 0%, transparent 45%),
  radial-gradient(ellipse at 50% 80%, rgba(125,171,142,0.3) 0%, transparent 50%),
  radial-gradient(ellipse at 20% 70%, rgba(200,180,140,0.2) 0%, transparent 40%); }`,
  }),
});

registerAsset({
  id: "digital-rain",
  category: "texture",
  name: "Digital Rain",
  nameCn: "数字雨",
  description: "Matrix-style falling characters overlay, hacker aesthetic",
  mood: ["dark", "terminal", "cyberpunk", "tech", "developer"],
  resolve: () => ({
    css: `.texture-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.04; overflow: hidden; }
.texture-overlay::after { content: "01001 10110 01101 11001 00110 10011 01110"; position: absolute; inset: -100% 0 0 0; width: 100%; font-family: monospace; font-size: 14px; line-height: 1.4; letter-spacing: 0.5em; word-break: break-all; color: #00ff41; writing-mode: vertical-rl; animation: digital-rain-fall 20s linear infinite; white-space: pre-wrap; }
@keyframes digital-rain-fall { 0% { transform: translateY(-50%); } 100% { transform: translateY(0%); } }`,
  }),
});

registerAsset({
  id: "ink-splatter",
  category: "texture",
  name: "Ink Splatter",
  nameCn: "墨迹飞溅",
  description: "Subtle ink drop splatters, calligraphic and artistic",
  mood: ["light", "ink-wash", "editorial", "organic", "creative"],
  resolve: () => ({
    css: `.texture-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.025; }
.texture-overlay::after { content: ""; position: absolute; inset: 0; background:
  radial-gradient(circle at 10% 15%, rgba(44,44,44,0.8) 0%, rgba(44,44,44,0.3) 3%, transparent 6%),
  radial-gradient(circle at 85% 25%, rgba(44,44,44,0.6) 0%, rgba(44,44,44,0.2) 2%, transparent 5%),
  radial-gradient(circle at 30% 75%, rgba(44,44,44,0.7) 0%, rgba(44,44,44,0.2) 4%, transparent 7%),
  radial-gradient(circle at 70% 60%, rgba(44,44,44,0.5) 0%, transparent 3%),
  radial-gradient(circle at 50% 40%, rgba(44,44,44,0.4) 0%, transparent 2%); }`,
  }),
});
