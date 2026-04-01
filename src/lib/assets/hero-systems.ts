/**
 * Signature Hero Systems — distinctive hero section treatments.
 * Same content, different hero system = completely different vibe.
 */
import { registerAsset } from "./registry";

registerAsset({
  id: "hero-terminal",
  category: "hero-system",
  name: "Terminal",
  nameCn: "终端命令行",
  description: "Hero as a terminal window with typed commands and output",
  mood: ["dark", "developer", "tech", "cyberpunk"],
  resolve: () => ({
    css: `.hero-terminal { background: #0a0a14; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; font-family: var(--font-mono, monospace); }
.hero-terminal-bar { display: flex; gap: 6px; padding: 10px 14px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); }
.hero-terminal-bar span { width: 10px; height: 10px; border-radius: 50%; }
.hero-terminal-bar span:nth-child(1) { background: #ff5f57; } .hero-terminal-bar span:nth-child(2) { background: #febc2e; } .hero-terminal-bar span:nth-child(3) { background: #28c840; }
.hero-terminal-body { padding: 20px; }
.hero-terminal-line { color: rgba(0,255,240,0.8); font-size: 14px; line-height: 1.8; } .hero-terminal-line::before { content: "❯ "; color: rgba(0,255,240,0.4); }
.hero-terminal-output { color: rgba(255,255,255,0.6); font-size: 13px; padding-left: 1.2em; }`,
  }),
});

registerAsset({
  id: "hero-poster",
  category: "hero-system",
  name: "Movie Poster",
  nameCn: "电影海报",
  description: "Cinematic poster layout with large type and dramatic spacing",
  mood: ["dark", "cinematic", "luxury", "editorial"],
  resolve: () => ({
    css: `.hero-poster { position: relative; min-height: 90vh; display: flex; flex-direction: column; justify-content: flex-end; padding: 3rem; }
.hero-poster-title { font-size: clamp(3rem, 10vw, 8rem); font-weight: 800; line-height: 0.9; letter-spacing: -0.04em; }
.hero-poster-subtitle { font-size: clamp(1rem, 2vw, 1.5rem); opacity: 0.6; margin-top: 1rem; letter-spacing: 0.2em; text-transform: uppercase; }
.hero-poster-overlay { position: absolute; inset: 0; background: linear-gradient(to top, var(--color-bg, #0a0a14) 0%, transparent 60%); pointer-events: none; }
.hero-poster-noise { position: absolute; inset: 0; opacity: 0.03; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }`,
  }),
});

registerAsset({
  id: "hero-magazine",
  category: "hero-system",
  name: "Magazine Cover",
  nameCn: "杂志封面",
  description: "Editorial magazine layout with rule lines and category labels",
  mood: ["light", "editorial", "warm", "elegant"],
  resolve: () => ({
    css: `.hero-magazine { position: relative; padding: 4rem 3rem; border-bottom: 3px solid var(--color-text, #111); }
.hero-magazine-rule { position: absolute; top: 2rem; left: 3rem; right: 3rem; height: 1px; background: var(--color-text, #111); opacity: 0.15; }
.hero-magazine-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.3em; opacity: 0.5; margin-bottom: 2rem; }
.hero-magazine-title { font-family: var(--font-heading, serif); font-size: clamp(2.5rem, 6vw, 5rem); font-weight: 600; line-height: 1.05; }
.hero-magazine-meta { display: flex; gap: 2rem; margin-top: 2rem; font-size: 12px; opacity: 0.5; text-transform: uppercase; letter-spacing: 0.15em; }
.hero-magazine-divider { width: 60px; height: 2px; background: var(--color-accent, #b8860b); margin-top: 2rem; }`,
  }),
});

registerAsset({
  id: "hero-lab",
  category: "hero-system",
  name: "Lab Archive",
  nameCn: "实验室档案",
  description: "Research lab / archive feel with grid coordinates and file stamps",
  mood: ["light", "dark", "research", "academic", "tech"],
  resolve: () => ({
    css: `.hero-lab { position: relative; padding: 4rem 3rem; font-family: var(--font-mono, monospace); }
.hero-lab-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(128,128,128,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.05) 1px, transparent 1px); background-size: 40px 40px; pointer-events: none; }
.hero-lab-stamp { display: inline-block; padding: 4px 10px; border: 1px solid; font-size: 9px; text-transform: uppercase; letter-spacing: 0.2em; opacity: 0.4; margin-bottom: 2rem; }
.hero-lab-id { font-size: 11px; opacity: 0.3; position: absolute; top: 1.5rem; right: 2rem; }
.hero-lab-title { font-size: clamp(2rem, 4vw, 3.5rem); font-weight: 700; letter-spacing: -0.02em; }
.hero-lab-desc { max-width: 60ch; margin-top: 1rem; font-size: 14px; line-height: 1.7; opacity: 0.7; }`,
  }),
});

registerAsset({
  id: "hero-product",
  category: "hero-system",
  name: "Product Launch",
  nameCn: "产品发布会",
  description: "Clean product launch hero with centered headline and gradient text",
  mood: ["dark", "product", "saas", "bold", "gradient"],
  resolve: () => ({
    css: `.hero-product { min-height: 80vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 4rem 2rem; }
.hero-product-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); font-size: 12px; margin-bottom: 2rem; }
.hero-product-title { font-size: clamp(2.5rem, 7vw, 5rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; background: linear-gradient(135deg, #fff 0%, var(--color-accent, #a18cd1) 50%, var(--color-accent-alt, #ff9a9e) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.hero-product-desc { max-width: 50ch; margin-top: 1.5rem; font-size: 1.1rem; opacity: 0.6; line-height: 1.7; }
.hero-product-ctas { display: flex; gap: 12px; margin-top: 2.5rem; }`,
  }),
});

registerAsset({
  id: "hero-gallery",
  category: "hero-system",
  name: "Gallery Wall",
  nameCn: "展厅墙面",
  description: "Hero with floating project preview cards arranged asymmetrically",
  mood: ["light", "portfolio", "creative", "playful"],
  resolve: () => ({
    css: `.hero-gallery { position: relative; min-height: 80vh; display: grid; grid-template-columns: 1fr 1.2fr; gap: 2rem; align-items: center; padding: 4rem 3rem; }
.hero-gallery-text { z-index: 2; }
.hero-gallery-wall { position: relative; height: 400px; }
.hero-gallery-card { position: absolute; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.1); transition: transform 0.4s cubic-bezier(0.16,1,0.3,1); }
.hero-gallery-card:hover { transform: scale(1.05) rotate(0deg) !important; z-index: 10; }
.hero-gallery-card:nth-child(1) { width: 55%; top: 5%; left: 0; transform: rotate(-3deg); }
.hero-gallery-card:nth-child(2) { width: 45%; top: 15%; right: 0; transform: rotate(2deg); }
.hero-gallery-card:nth-child(3) { width: 50%; bottom: 0; left: 20%; transform: rotate(-1deg); }`,
  }),
});

// ---- New hero systems ----

registerAsset({
  id: "hero-split-screen",
  category: "hero-system",
  name: "Split Screen",
  nameCn: "分屏对比",
  description: "Two-tone split screen with text on one side, visual on other",
  mood: ["bold", "creative", "craft", "vaporwave", "any"],
  resolve: () => ({
    css: `.hero-split { display: grid; grid-template-columns: 1fr 1fr; min-height: 85vh; }
.hero-split-left { display: flex; flex-direction: column; justify-content: center; padding: 4rem 3rem; background: var(--color-bg, #fff); }
.hero-split-right { position: relative; overflow: hidden; background: var(--color-accent, #6366f1); }
.hero-split-right::after { content: ""; position: absolute; inset: 0; background: linear-gradient(135deg, transparent 40%, rgba(0,0,0,0.2) 100%); }
.hero-split-title { font-size: clamp(2.5rem, 5vw, 4rem); font-weight: 800; line-height: 1.05; letter-spacing: -0.02em; }
.hero-split-desc { font-size: 1.1rem; opacity: 0.7; margin-top: 1.5rem; max-width: 45ch; line-height: 1.7; }
@media (max-width: 768px) { .hero-split { grid-template-columns: 1fr; } .hero-split-right { min-height: 40vh; } }`,
  }),
});

registerAsset({
  id: "hero-ink-splash",
  category: "hero-system",
  name: "Ink Splash",
  nameCn: "水墨泼洒",
  description: "Chinese ink wash inspired hero with flowing brush strokes",
  mood: ["ink-wash", "editorial", "organic", "warm", "elegant"],
  resolve: () => ({
    css: `.hero-ink { position: relative; min-height: 85vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 4rem 2rem; overflow: hidden; }
.hero-ink-bg { position: absolute; inset: 0; opacity: 0.06; background:
  radial-gradient(ellipse at 20% 50%, rgba(44,44,44,0.8) 0%, transparent 35%),
  radial-gradient(ellipse at 80% 30%, rgba(44,44,44,0.5) 0%, transparent 30%),
  radial-gradient(ellipse at 50% 80%, rgba(44,44,44,0.4) 0%, transparent 25%); pointer-events: none; }
.hero-ink-title { font-family: var(--font-heading, serif); font-size: clamp(3rem, 8vw, 6rem); font-weight: 400; letter-spacing: 0.1em; position: relative; }
.hero-ink-subtitle { font-size: 1rem; opacity: 0.5; margin-top: 1.5rem; letter-spacing: 0.3em; }
.hero-ink-seal { position: absolute; bottom: 2rem; right: 3rem; width: 48px; height: 48px; opacity: 0.5; }
.hero-ink-rule { width: 1px; height: 60px; background: var(--color-text, #2c2c2c); opacity: 0.15; margin: 2rem auto; }`,
  }),
});

registerAsset({
  id: "hero-retro-grid",
  category: "hero-system",
  name: "Retro Grid",
  nameCn: "复古网格",
  description: "80s-style perspective grid horizon with neon glow",
  mood: ["dark", "vaporwave", "retro", "cyberpunk", "neon"],
  resolve: () => ({
    css: `.hero-retro-grid { position: relative; min-height: 85vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 4rem 2rem; overflow: hidden; background: linear-gradient(to bottom, #1a0a2e 0%, #0a0a1a 100%); }
.hero-retro-grid-bg { position: absolute; bottom: 0; left: -50%; width: 200%; height: 60%; background: linear-gradient(to top, var(--color-accent, #ff71ce) 0%, transparent 2px), linear-gradient(90deg, var(--color-accent, #ff71ce) 0%, transparent 1px); background-size: 60px 60px; transform: perspective(400px) rotateX(60deg); transform-origin: bottom; opacity: 0.15; }
.hero-retro-grid-sun { position: absolute; bottom: 30%; left: 50%; transform: translateX(-50%); width: 200px; height: 200px; border-radius: 50%; background: linear-gradient(to bottom, var(--color-accent, #ff71ce), var(--color-accent-alt, #01cdfe)); opacity: 0.2; filter: blur(20px); }
.hero-retro-grid-title { font-size: clamp(3rem, 8vw, 6rem); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; z-index: 2; background: linear-gradient(to bottom, #fff, var(--color-accent, #ff71ce)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.hero-retro-grid-sub { font-size: 1.1rem; letter-spacing: 0.3em; text-transform: uppercase; opacity: 0.5; z-index: 2; margin-top: 1rem; }`,
  }),
});
