/**
 * Mockup Library — device frames for project screenshots.
 * Wraps project images in browser/phone/terminal frames.
 */
import { registerAsset } from "./registry";

registerAsset({
  id: "mockup-browser-dark",
  category: "mockup",
  name: "Browser Dark",
  nameCn: "暗色浏览器",
  description: "Dark browser chrome frame for project screenshots",
  mood: ["dark", "tech", "developer", "any"],
  resolve: () => ({
    css: `.mockup-browser { background: #1a1a2e; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); }
.mockup-browser-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); }
.mockup-browser-bar .dots { display: flex; gap: 5px; }
.mockup-browser-bar .dots span { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.1); }
.mockup-browser-bar .url { flex: 1; margin: 0 12px; padding: 4px 10px; border-radius: 4px; background: rgba(255,255,255,0.05); font-size: 10px; color: rgba(255,255,255,0.3); }
.mockup-browser-content { position: relative; }
.mockup-browser-content img { width: 100%; display: block; }`,
  }),
});

registerAsset({
  id: "mockup-browser-light",
  category: "mockup",
  name: "Browser Light",
  nameCn: "亮色浏览器",
  description: "Light browser chrome frame",
  mood: ["light", "minimal", "editorial", "any"],
  resolve: () => ({
    css: `.mockup-browser { background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid rgba(0,0,0,0.08); box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
.mockup-browser-bar { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #f8f9fa; border-bottom: 1px solid rgba(0,0,0,0.06); }
.mockup-browser-bar .dots { display: flex; gap: 5px; }
.mockup-browser-bar .dots span { width: 8px; height: 8px; border-radius: 50%; }
.mockup-browser-bar .dots span:nth-child(1) { background: #ff5f57; } .mockup-browser-bar .dots span:nth-child(2) { background: #febc2e; } .mockup-browser-bar .dots span:nth-child(3) { background: #28c840; }
.mockup-browser-bar .url { flex: 1; margin: 0 12px; padding: 4px 10px; border-radius: 6px; background: #fff; border: 1px solid rgba(0,0,0,0.08); font-size: 10px; color: rgba(0,0,0,0.3); }
.mockup-browser-content img { width: 100%; display: block; }`,
  }),
});

registerAsset({
  id: "mockup-phone",
  category: "mockup",
  name: "Phone Float",
  nameCn: "手机悬浮",
  description: "Mobile phone frame, slightly rotated for perspective",
  mood: ["any", "product", "creative", "mobile"],
  resolve: () => ({
    css: `.mockup-phone { width: 260px; background: #111; border-radius: 36px; padding: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); transform: perspective(800px) rotateY(-5deg); }
.mockup-phone-notch { width: 100px; height: 24px; background: #111; border-radius: 0 0 12px 12px; margin: 0 auto; position: relative; z-index: 2; }
.mockup-phone-screen { border-radius: 24px; overflow: hidden; background: #fff; aspect-ratio: 9/19.5; }
.mockup-phone-screen img { width: 100%; height: 100%; object-fit: cover; }`,
  }),
});

registerAsset({
  id: "mockup-terminal",
  category: "mockup",
  name: "Terminal Window",
  nameCn: "终端窗口",
  description: "CLI terminal frame for code/demo display",
  mood: ["dark", "developer", "tech", "cyberpunk"],
  resolve: () => ({
    css: `.mockup-terminal { background: #0d1117; border-radius: 8px; overflow: hidden; font-family: var(--font-mono, monospace); border: 1px solid rgba(255,255,255,0.06); }
.mockup-terminal-bar { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: rgba(255,255,255,0.02); }
.mockup-terminal-bar span { width: 8px; height: 8px; border-radius: 50%; }
.mockup-terminal-bar span:nth-child(1) { background: #ff5f57; } .mockup-terminal-bar span:nth-child(2) { background: #febc2e; } .mockup-terminal-bar span:nth-child(3) { background: #28c840; }
.mockup-terminal-body { padding: 16px; font-size: 12px; line-height: 1.6; color: rgba(255,255,255,0.7); }
.mockup-terminal-body .prompt { color: #28c840; } .mockup-terminal-body .cmd { color: #79c0ff; }`,
  }),
});

// ---- New mockups ----

registerAsset({
  id: "mockup-tablet",
  category: "mockup",
  name: "Tablet Landscape",
  nameCn: "平板横屏",
  description: "Tablet device frame in landscape orientation",
  mood: ["any", "product", "editorial", "creative"],
  resolve: () => ({
    css: `.mockup-tablet { width: 500px; max-width: 100%; background: #222; border-radius: 16px; padding: 16px; box-shadow: 0 16px 48px rgba(0,0,0,0.15); }
.mockup-tablet-camera { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.1); margin: 0 auto 8px; }
.mockup-tablet-screen { border-radius: 8px; overflow: hidden; background: #fff; aspect-ratio: 4/3; }
.mockup-tablet-screen img { width: 100%; height: 100%; object-fit: cover; }
.mockup-tablet-home { width: 32px; height: 32px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.08); margin: 8px auto 0; }`,
  }),
});

registerAsset({
  id: "mockup-laptop",
  category: "mockup",
  name: "Laptop",
  nameCn: "笔记本电脑",
  description: "Laptop device frame with keyboard hinge",
  mood: ["any", "product", "tech", "developer", "minimal"],
  resolve: () => ({
    css: `.mockup-laptop { max-width: 600px; }
.mockup-laptop-screen { background: #1a1a2e; border-radius: 12px 12px 0 0; padding: 8px 8px 0; border: 2px solid #333; border-bottom: none; }
.mockup-laptop-bar { display: flex; gap: 4px; padding: 6px 8px; }
.mockup-laptop-bar span { width: 6px; height: 6px; border-radius: 50%; }
.mockup-laptop-bar span:nth-child(1) { background: #ff5f57; } .mockup-laptop-bar span:nth-child(2) { background: #febc2e; } .mockup-laptop-bar span:nth-child(3) { background: #28c840; }
.mockup-laptop-content { aspect-ratio: 16/10; overflow: hidden; } .mockup-laptop-content img { width: 100%; height: 100%; object-fit: cover; }
.mockup-laptop-base { height: 14px; background: linear-gradient(to bottom, #2a2a3a, #333); border-radius: 0 0 4px 4px; position: relative; }
.mockup-laptop-base::after { content: ""; position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 80px; height: 4px; background: rgba(255,255,255,0.05); border-radius: 0 0 4px 4px; }
.mockup-laptop-shadow { height: 6px; margin: 0 20px; background: rgba(0,0,0,0.08); border-radius: 50%; filter: blur(4px); }`,
  }),
});
