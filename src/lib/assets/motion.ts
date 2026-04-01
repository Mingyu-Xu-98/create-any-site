/**
 * Motion Presets — animation systems that give sites "director-level" feel.
 * Each preset provides CSS keyframes + utility classes.
 */
import { registerAsset } from "./registry";

registerAsset({
  id: "motion-fade-up",
  category: "motion",
  name: "Fade Up",
  nameCn: "淡入上浮",
  description: "Simple fade-in with upward slide, clean and professional",
  mood: ["light", "minimal", "editorial", "any"],
  resolve: () => ({
    css: `.reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; }
.reveal.visible { opacity: 1; transform: translateY(0); }
.reveal-d1 { transition-delay: 0.1s; } .reveal-d2 { transition-delay: 0.2s; } .reveal-d3 { transition-delay: 0.3s; } .reveal-d4 { transition-delay: 0.4s; }`,
    components: { "src/components/ScrollReveal.tsx": `"use client";
import { useEffect, useRef } from "react";
export default function ScrollReveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { el.classList.add("visible"); observer.disconnect(); } }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={\`reveal \${className}\`} style={{ transitionDelay: \`\${delay}s\` }}>{children}</div>;
}` },
  }),
});

registerAsset({
  id: "motion-stagger-reveal",
  category: "motion",
  name: "Stagger Reveal",
  nameCn: "交错显现",
  description: "Children appear one by one with staggered delay",
  mood: ["any", "editorial", "cinematic", "luxury"],
  resolve: () => ({
    css: `.stagger-container .stagger-item { opacity: 0; transform: translateY(20px); transition: opacity 0.5s ease, transform 0.5s ease; }
.stagger-container.visible .stagger-item { opacity: 1; transform: translateY(0); }
.stagger-container.visible .stagger-item:nth-child(1) { transition-delay: 0s; }
.stagger-container.visible .stagger-item:nth-child(2) { transition-delay: 0.1s; }
.stagger-container.visible .stagger-item:nth-child(3) { transition-delay: 0.2s; }
.stagger-container.visible .stagger-item:nth-child(4) { transition-delay: 0.3s; }
.stagger-container.visible .stagger-item:nth-child(5) { transition-delay: 0.4s; }
.stagger-container.visible .stagger-item:nth-child(6) { transition-delay: 0.5s; }`,
  }),
});

registerAsset({
  id: "motion-glow-sweep",
  category: "motion",
  name: "Glow Sweep",
  nameCn: "光斑扫过",
  description: "A light streak sweeps across cards on hover",
  mood: ["dark", "tech", "cyberpunk", "glassmorphism"],
  resolve: () => ({
    css: `.glow-card { position: relative; overflow: hidden; }
.glow-card::before { content: ""; position: absolute; top: 0; left: -100%; width: 60%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent); transform: skewX(-15deg); transition: left 0.6s ease; pointer-events: none; z-index: 1; }
.glow-card:hover::before { left: 130%; }
.glow-card::after { content: ""; position: absolute; inset: 0; border-radius: inherit; border: 1px solid transparent; transition: border-color 0.3s ease; pointer-events: none; }
.glow-card:hover::after { border-color: rgba(255,255,255,0.1); }`,
  }),
});

registerAsset({
  id: "motion-parallax",
  category: "motion",
  name: "Parallax Layers",
  nameCn: "视差层叠",
  description: "Background and foreground move at different speeds on scroll",
  mood: ["cinematic", "luxury", "editorial", "immersive"],
  resolve: () => ({
    css: `.parallax-section { position: relative; overflow: hidden; }
.parallax-bg { position: absolute; inset: -20%; width: 140%; height: 140%; will-change: transform; }`,
    components: { "src/hooks/useParallax.ts": `"use client";
import { useEffect, useRef } from "react";
export function useParallax(speed = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const handler = () => { const rect = el.getBoundingClientRect(); const y = (rect.top / window.innerHeight - 0.5) * speed * 100; el.style.transform = \`translateY(\${y}px)\`; };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [speed]);
  return ref;
}` },
  }),
});

registerAsset({
  id: "motion-typewriter",
  category: "motion",
  name: "Typewriter",
  nameCn: "打字机",
  description: "Text appears character by character",
  mood: ["tech", "cyberpunk", "terminal", "developer"],
  resolve: () => ({
    css: `.typewriter { overflow: hidden; border-right: 2px solid var(--color-accent, #6366f1); white-space: nowrap; animation: typewriter-expand 2s steps(40) forwards, typewriter-blink 0.8s step-end infinite; }
@keyframes typewriter-expand { from { width: 0; } to { width: 100%; } }
@keyframes typewriter-blink { 0%,100% { border-color: transparent; } 50% { border-color: var(--color-accent, #6366f1); } }`,
  }),
});

registerAsset({
  id: "motion-pin-scroll",
  category: "motion",
  name: "Pin Scroll",
  nameCn: "固定滚动",
  description: "Section stays pinned while content scrolls through",
  mood: ["cinematic", "immersive", "luxury", "product"],
  resolve: () => ({
    css: `.pin-section { position: relative; } .pin-content { position: sticky; top: 0; height: 100vh; display: flex; align-items: center; justify-content: center; overflow: hidden; }`,
  }),
});

// ---- New motion presets ----

registerAsset({
  id: "motion-morph-blob",
  category: "motion",
  name: "Morph Blob",
  nameCn: "形变光团",
  description: "Organic blobs that slowly morph between shapes in background",
  mood: ["aurora", "gradient", "creative", "glassmorphism", "dark"],
  resolve: () => ({
    css: `.morph-blob { position: absolute; border-radius: 50%; filter: blur(60px); opacity: 0.15; animation: morph-shape 15s ease-in-out infinite alternate; }
.morph-blob-1 { width: 400px; height: 400px; background: var(--color-accent, #00d4aa); top: -100px; right: -100px; }
.morph-blob-2 { width: 300px; height: 300px; background: var(--color-accent-alt, #7b68ee); bottom: -50px; left: -50px; animation-delay: -5s; animation-duration: 18s; }
@keyframes morph-shape { 0% { border-radius: 50% 30% 60% 40%; transform: rotate(0deg) scale(1); } 50% { border-radius: 40% 60% 30% 70%; transform: rotate(180deg) scale(1.1); } 100% { border-radius: 60% 40% 50% 30%; transform: rotate(360deg) scale(1); } }`,
  }),
});

registerAsset({
  id: "motion-float-drift",
  category: "motion",
  name: "Float Drift",
  nameCn: "漂浮游移",
  description: "Elements gently float up and down, weightless feel",
  mood: ["watercolor", "organic", "creative", "light", "warm"],
  resolve: () => ({
    css: `.float-drift { animation: float-drift-move 6s ease-in-out infinite; }
.float-drift-d1 { animation-delay: 0s; } .float-drift-d2 { animation-delay: -1.5s; } .float-drift-d3 { animation-delay: -3s; } .float-drift-d4 { animation-delay: -4.5s; }
@keyframes float-drift-move { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }`,
  }),
});

registerAsset({
  id: "motion-glitch",
  category: "motion",
  name: "Glitch",
  nameCn: "故障闪烁",
  description: "Digital glitch effect on hover — text splits and flickers",
  mood: ["dark", "cyberpunk", "vaporwave", "tech", "experimental"],
  resolve: () => ({
    css: `.glitch-text { position: relative; display: inline-block; }
.glitch-text::before, .glitch-text::after { content: attr(data-text); position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
.glitch-text:hover::before { animation: glitch-shift-1 0.3s steps(2) infinite; color: #ff71ce; clip-path: inset(20% 0 40% 0); }
.glitch-text:hover::after { animation: glitch-shift-2 0.3s steps(2) infinite reverse; color: #01cdfe; clip-path: inset(60% 0 0 0); }
@keyframes glitch-shift-1 { 0% { transform: translate(0); } 25% { transform: translate(-2px, 1px); } 50% { transform: translate(2px, -1px); } 75% { transform: translate(-1px, 2px); } 100% { transform: translate(1px, -2px); } }
@keyframes glitch-shift-2 { 0% { transform: translate(0); } 25% { transform: translate(2px, -1px); } 50% { transform: translate(-2px, 2px); } 75% { transform: translate(1px, -1px); } 100% { transform: translate(-1px, 1px); } }`,
  }),
});
