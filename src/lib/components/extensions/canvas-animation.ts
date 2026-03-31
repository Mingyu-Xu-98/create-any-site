/**
 * 2D Canvas Animation extension.
 * Canvas-based animations using requestAnimationFrame.
 *
 * Config options:
 * - preset: "confetti" | "matrix" | "gradient-flow" | "constellation"
 * - color: string (primary color)
 * - height: string (default "300px")
 * - opacity: number (default 1)
 */
import type { SectionContext } from "../types";
import type { ExtensionOutput } from "./types";
import { registerExtension } from "./registry";

function render(_ctx: SectionContext, config: Record<string, unknown>): ExtensionOutput {
  const preset = (config.preset as string) || "constellation";
  const height = (config.height as string) || "300px";
  const opacity = typeof config.opacity === "number" ? config.opacity : 1;

  const componentCode = generateCanvasComponent(preset);

  return {
    jsx: `
        <div style={{ height: "${height}", opacity: ${opacity}, position: "relative" }}>
          <CanvasAnimation />
        </div>`,
    css: "",
    imports: [
      `import dynamic from "next/dynamic";`,
      `const CanvasAnimation = dynamic(() => import("@/components/CanvasAnimation"), { ssr: false });`,
    ],
    files: {
      "src/components/CanvasAnimation.tsx": componentCode,
    },
  };
}

function generateCanvasComponent(preset: string): string {
  if (preset === "matrix") {
    return `"use client";
import { useRef, useEffect } from "react";

export default function CanvasAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim() || "#0f0";
    const cols = Math.floor(canvas.width / 14);
    const drops = Array(cols).fill(1);
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*";
    let animId: number;
    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = accent;
      ctx.font = "12px monospace";
      for (let i = 0; i < drops.length; i++) {
        ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * 14, drops[i] * 14);
        if (drops[i] * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      animId = requestAnimationFrame(draw);
    };
    const interval = setInterval(draw, 50);
    return () => { clearInterval(interval); cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}
`;
  }

  // Default: constellation
  return `"use client";
import { useRef, useEffect } from "react";

export default function CanvasAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim() || "#6366f1";
    const particles: { x: number; y: number; vx: number; vy: number }[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5 });
    }
    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill();
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = accent; ctx.globalAlpha = 1 - dist / 120; ctx.stroke(); ctx.globalAlpha = 1;
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}
`;
}

registerExtension({
  id: "canvas-animation",
  label: "2D Canvas Animation",
  type: "section",
  render,
});
