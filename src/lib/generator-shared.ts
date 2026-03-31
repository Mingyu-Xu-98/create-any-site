import type { WorkspaceData } from "./types";
import type { SiteSpec } from "./site-spec";

export function genTypewriterHero(): string {
  return `"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "./LanguageProvider";

export default function TypewriterHero() {
  const { t } = useLanguage();
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [done, setDone] = useState(false);
  const lines = t.hero.lines;

  useEffect(() => {
    setDisplayedLines([]); setCurrentLine(0); setCurrentChar(0); setDone(false);
  }, [t]);

  useEffect(() => {
    if (done) return;
    if (currentLine >= lines.length) { setDone(true); return; }
    const line = lines[currentLine];
    if (currentChar < line.length) {
      const timer = setTimeout(() => {
        setDisplayedLines(prev => { const u = [...prev]; u[currentLine] = line.slice(0, currentChar + 1); return u; });
        setCurrentChar(c => c + 1);
      }, 40);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => { setCurrentLine(l => l + 1); setCurrentChar(0); setDisplayedLines(prev => [...prev, ""]); }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentLine, currentChar, done, lines]);

  return (
    <div className="font-mono text-sm md:text-base space-y-1 min-h-[160px]">
      {displayedLines.map((line, i) => (
        <div key={i} className="flex items-start">
          <span className={line.startsWith(">") ? "text-accent" : "text-text-muted"}>
            {line.startsWith("> ") ? (<><span className="text-green mr-2">&gt;</span><span className="text-text">{line.slice(2)}</span></>) : line}
          </span>
          {i === currentLine && !done && <span className="inline-block w-2.5 h-5 bg-accent ml-0.5 animate-pulse" />}
        </div>
      ))}
      {done && <div className="flex items-center"><span className="text-green mr-2">&gt;</span><span className="inline-block w-2.5 h-5 bg-accent animate-pulse" /></div>}
    </div>
  );
}
`;
}

export function genThemeToggle(): string {
  return `"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved) { setDark(saved === "dark"); document.documentElement.setAttribute("data-theme", saved); }
  }, []);

  const toggle = () => {
    const next = dark ? "light" : "dark";
    setDark(!dark);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  return (
    <button onClick={toggle} className="text-text-muted hover:text-text p-2 rounded-full border border-line transition-colors" aria-label="Toggle theme">
      {dark ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" strokeWidth={2}/><path strokeWidth={2} d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
      )}
    </button>
  );
}
`;
}

export function genParticleBackground(): string {
  return `"use client";

import { useEffect, useRef } from "react";

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; a: number }[] = [];
    const COUNT = 80;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
        a: Math.random() * 0.5 + 0.1,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = \`rgba(0,255,240,\${p.a})\`;
        ctx.fill();
      }
      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = \`rgba(0,255,240,\${0.08 * (1 - dist / 120)})\`;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}
`;
}

export function genGrainOverlay(): string {
  return `"use client";

export default function GrainOverlay() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-50 opacity-[0.06]"
      style={{
        backgroundImage: \`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")\`,
        backgroundRepeat: "repeat",
      }}
    />
  );
}
`;
}

export function genSharePoster(): string {
  return `"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import QRCode from "qrcode";
import { useLanguage } from "./LanguageProvider";

export default function SharePoster() {
  const { t, lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const share = t.share;

  const drawPoster = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 540;
    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

    // --- Read CSS variables for theme-aware rendering ---
    const s = getComputedStyle(document.documentElement);
    const accent = s.getPropertyValue("--color-accent").trim() || "#6366f1";
    const bg = s.getPropertyValue("--color-bg").trim() || "#0a0a0f";
    const textColor = s.getPropertyValue("--color-text").trim() || "#ffffff";
    const mutedColor = s.getPropertyValue("--color-text-muted").trim() || "#9ca3af";
    const fontFamily = s.getPropertyValue("--font-sans").trim() || "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    const fontBase = fontFamily.split(",").slice(0, 2).join(",");
    const cx = W / 2;
    const cardX = 32, cardW = W - 64, cardY = 40;

    // --- Pre-calculate content height ---
    // Use an offscreen measurement pass
    const measureCanvas = document.createElement("canvas");
    measureCanvas.width = W; measureCanvas.height = 100;
    const mCtx = measureCanvas.getContext("2d")!;

    const avatarR = 32;
    // avatar top to name: cardY(40) + 50(avatarY offset) + avatarR(32) + 28 = 150
    let contentH = 50 + avatarR * 2 + 28; // start from cardY
    contentH += 26 + 46; // title + gap to divider
    contentH += 34; // invite text
    contentH += 30; // gap to desc

    mCtx.font = \`13px \${fontBase}\`;
    const descLines = wrapText(mCtx, share.desc, cardW - 80);
    const descLineCount = Math.min(descLines.length, 2);
    contentH += descLineCount * 20 + 20; // desc lines + gap

    const skillTags = (share.skillTags || []).slice(0, 6);
    if (skillTags.length > 0) {
      contentH += 18; // "Skills" header
      mCtx.font = \`12px \${fontBase}\`;
      const maxLineW = cardW - 60;
      let lineW = 0;
      let tagRows = 1;
      skillTags.forEach((tag) => {
        const tw = mCtx.measureText(tag).width + 20 + 5;
        if (lineW + tw > maxLineW && lineW > 0) { tagRows++; lineW = tw; }
        else { lineW += tw; }
      });
      contentH += tagRows * 28 + 12; // tag rows + gap
    }

    // QR code block: 8 padding + 90 qr + 8 padding + 20 text + 24 bottom
    contentH += 8 + 90 + 8 + 20 + 24;

    const cardH = contentH;
    const H = cardY * 2 + cardH;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.scale(dpr, dpr);

    // --- Background gradient ---
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, bg);
    bgGrad.addColorStop(0.5, mixColor(bg, accent, 0.12));
    bgGrad.addColorStop(1, mixColor(bg, accent, 0.2));
    ctx.fillStyle = bgGrad;
    roundRect(ctx, 0, 0, W, H, 0);

    // --- Decorative circles ---
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(W * 0.85, H * 0.1, 110, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(W * 0.08, H * 0.8, 80, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // --- Glass card ---
    ctx.save();
    ctx.fillStyle = isLight(bg) ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.06)";
    ctx.strokeStyle = isLight(bg) ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    roundRect(ctx, cardX, cardY, cardW, cardH, 20);
    ctx.stroke();
    ctx.restore();

    // --- Draw rest after avatar loads ---
    const drawContent = (avatarImg?: HTMLImageElement) => {
      const avatarY = cardY + 50;

      if (avatarImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, avatarY, avatarR, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImg, cx - avatarR, avatarY - avatarR, avatarR * 2, avatarR * 2);
        ctx.restore();
        ctx.strokeStyle = isLight(bg) ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.15)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, avatarY, avatarR, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.save();
        ctx.fillStyle = mixColor(accent, bg, 0.3);
        ctx.beginPath(); ctx.arc(cx, avatarY, avatarR, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = accent;
        ctx.beginPath(); ctx.arc(cx, avatarY - 6, 13, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(cx, avatarY + 18, 20, 14, 0, Math.PI, 0, true); ctx.fill();
        ctx.restore();
      }

      // --- Name ---
      const nameY = avatarY + avatarR + 28;
      ctx.fillStyle = textColor;
      ctx.font = \`bold 26px \${fontBase}\`;
      ctx.textAlign = "center";
      const name = lang === "zh" ? t.hero.lines[1]?.replace("> ", "") : t.hero.lines[1]?.replace("> ", "");
      ctx.fillText(name || "", cx, nameY);

      // --- Title ---
      ctx.fillStyle = mutedColor;
      ctx.font = \`14px \${fontBase}\`;
      const title = t.hero.lines[2]?.replace("> ", "") || "";
      ctx.fillText(title, cx, nameY + 26);

      // --- Divider ---
      const divY = nameY + 46;
      const divGrad = ctx.createLinearGradient(cardX + 40, divY, cardX + cardW - 40, divY);
      divGrad.addColorStop(0, "transparent");
      divGrad.addColorStop(0.3, accent);
      divGrad.addColorStop(0.7, accent);
      divGrad.addColorStop(1, "transparent");
      ctx.strokeStyle = divGrad;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cardX + 40, divY);
      ctx.lineTo(cardX + cardW - 40, divY);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // --- Invite text ---
      const inviteY = divY + 34;
      ctx.fillStyle = textColor;
      ctx.font = \`bold 18px \${fontBase}\`;
      ctx.fillText(share.invite, cx, inviteY);

      // --- Description ---
      ctx.fillStyle = mutedColor;
      ctx.font = \`13px \${fontBase}\`;
      const drawnDescLines = wrapText(ctx, share.desc, cardW - 80);
      drawnDescLines.slice(0, 2).forEach((line, i) => {
        ctx.fillText(line, cx, inviteY + 30 + i * 20);
      });

      // --- Skill tags (compact) ---
      let nextY = inviteY + 30 + Math.min(drawnDescLines.length, 2) * 20 + 20;
      if (skillTags.length > 0) {
        ctx.fillStyle = mutedColor;
        ctx.font = \`bold 12px \${fontBase}\`;
        ctx.textAlign = "center";
        ctx.fillText(lang === "zh" ? "\\u{2B50} 专业技能" : "\\u{2B50} Skills", cx, nextY);
        nextY += 18;
        ctx.font = \`12px \${fontBase}\`;
        let totalW = 0;
        const widths = skillTags.map((tag) => { const w = ctx.measureText(tag).width + 20; totalW += w + 5; return w; });
        totalW -= 5;
        const maxLineW = cardW - 60;
        let lineX = cx - Math.min(totalW, maxLineW) / 2;
        let lineW = 0;
        skillTags.forEach((tag, i) => {
          if (lineW + widths[i] > maxLineW && lineW > 0) {
            nextY += 28;
            lineW = 0;
            const remaining = skillTags.slice(i).reduce((s2, _, j) => s2 + widths[i + j] + 5, -5);
            lineX = cx - Math.min(remaining, maxLineW) / 2;
          }
          ctx.fillStyle = isLight(bg) ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)";
          roundRect(ctx, lineX + lineW, nextY, widths[i], 24, 12);
          ctx.fillStyle = textColor;
          ctx.textAlign = "center";
          ctx.fillText(tag, lineX + lineW + widths[i] / 2, nextY + 16);
          lineW += widths[i] + 5;
        });
        nextY += 36;
      }

      // --- QR Code ---
      const qrY = nextY;
      const url = typeof window !== "undefined" ? window.location.href : "";
      if (url) {
        QRCode.toDataURL(url, { width: 200, margin: 1, color: { dark: "#000000", light: "#ffffff" } })
          .then((dataUrl: string) => {
            const qrImg = new Image();
            qrImg.onload = () => {
              const qrSize = 90;
              const qrX = cx - qrSize / 2;
              ctx.fillStyle = "#ffffff";
              roundRect(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 12);
              ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
              ctx.fillStyle = mutedColor;
              ctx.font = \`12px \${fontBase}\`;
              ctx.textAlign = "center";
              ctx.globalAlpha = 0.6;
              ctx.fillText(lang === "zh" ? "扫码访问" : "Scan to visit", cx, qrY + qrSize + 20);
              ctx.globalAlpha = 1;
            };
            qrImg.src = dataUrl;
          })
          .catch(() => {});
      }
    };

    // Load avatar image, then draw content
    const avatarImg = new Image();
    avatarImg.crossOrigin = "anonymous";
    avatarImg.onload = () => drawContent(avatarImg);
    avatarImg.onerror = () => drawContent();
    avatarImg.src = "/images/avatar.png";
  }, [open, lang, t, share]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(drawPoster, 50);
      return () => clearTimeout(timer);
    }
  }, [open, drawPoster]);

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "share-poster.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <>
      {/* Floating share button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-50 w-12 h-12 rounded-full bg-accent text-white shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:scale-110 transition-all flex items-center justify-center group"
        title={share.button}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        <span className="absolute left-full ml-3 px-3 py-1 bg-bg-card-solid text-text text-sm rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg border border-line">
          {share.button}
        </span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-bg-card-solid rounded-2xl shadow-2xl max-w-[340px] w-full max-h-[90vh] flex flex-col border border-line"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "fadeSlideUp 0.3s ease forwards" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
              <h3 className="font-bold text-lg text-text">{share.title}</h3>
              <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text p-1 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Canvas poster */}
            <div className="px-4 flex justify-center min-h-0 flex-1 overflow-hidden">
              <canvas
                ref={canvasRef}
                className="rounded-xl shadow-inner object-contain"
                style={{ width: "100%", height: "auto", maxHeight: "100%" }}
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 p-4 shrink-0">
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                {share.save}
              </button>
              <button
                onClick={handleCopy}
                className={\`flex-1 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 border \${copied ? "bg-green/10 border-green/30 text-green" : "border-line text-text hover:border-accent/30"}\`}
              >
                {copied ? (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>{share.copied}</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>{share.copy}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// --- Canvas helpers ---

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split("");
  const lines: string[] = [];
  let line = "";
  for (const char of words) {
    const test = line + char;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = char;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function hexToRgb(hex: string): [number, number, number] {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r,g,b].map(v => Math.round(v).toString(16).padStart(2,"0")).join("");
}

function mixColor(c1: string, c2: string, ratio: number): string {
  try {
    const [r1,g1,b1] = hexToRgb(c1);
    const [r2,g2,b2] = hexToRgb(c2);
    return rgbToHex(r1+(r2-r1)*ratio, g1+(g2-g1)*ratio, b1+(b2-b1)*ratio);
  } catch { return c1; }
}

function isLight(hex: string): boolean {
  try {
    const [r,g,b] = hexToRgb(hex);
    return (r*299 + g*587 + b*114) / 1000 > 128;
  } catch { return false; }
}

`;
}

export function genChatBot(): string {
  return `"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "./LanguageProvider";

interface Message { role: "user" | "assistant"; content: string; }

export default function ChatBot() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs); setInput(""); setLoading(true);
    try {
      // Resolve chat API: use host project's proxy for static exports
      const pathParts = window.location.pathname.split("/").filter(Boolean);
      const siteId = pathParts[pathParts[0] === "drafts" ? 1 : 0] || "";
      const origin = window.location.port === "3002" ? window.location.origin.replace(":3002", ":3001") : "";
      const chatUrl = origin && siteId ? \`\${origin}/api/site-chat/\${siteId}\` : "/api/chat";
      const res = await fetch(chatUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: newMsgs }) });
      if (!res.ok) throw new Error();
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let content = "";
      setMessages([...newMsgs, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        content += decoder.decode(value, { stream: true });
        setMessages([...newMsgs, { role: "assistant", content }]);
      }
    } catch {
      setMessages([...newMsgs, { role: "assistant", content: "Sorry, something went wrong." }]);
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <button onClick={() => setOpen(!open)} className="w-14 h-14 rounded-full shadow-lg bg-accent flex items-center justify-center text-white transition-transform hover:scale-105">
          {open ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
          )}
        </button>
      </div>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-h-[520px] bg-bg-card-solid border border-line rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in">
          <div className="px-4 py-3 border-b border-line">
            <p className="text-sm font-semibold">{t.chatbot.title}</p>
            <p className="text-xs text-text-muted">{t.chatbot.subtitle}</p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[300px]">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-text-muted text-center py-2">{t.chatbot.welcome}</p>
                <div className="space-y-2">
                  {t.chatbot.suggestions.map((s) => (
                    <button key={s} onClick={() => send(s)} className="w-full text-left text-sm bg-bg-tag hover:bg-accent/10 text-text-muted hover:text-accent px-3 py-2 rounded-lg border border-line hover:border-accent/30 transition-colors">{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={\`flex \${msg.role === "user" ? "justify-end" : "justify-start"}\`}>
                <div className={\`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap \${msg.role === "user" ? "bg-accent text-white rounded-br-sm" : "bg-bg-tag text-text rounded-bl-sm"}\`}>
                  {msg.content || (loading && i === messages.length - 1 ? "..." : "")}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="px-4 py-3 border-t border-line">
            <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2">
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t.chatbot.placeholder} disabled={loading} className="flex-1 bg-bg text-text text-sm px-3 py-2 rounded-lg border border-line focus:border-accent focus:outline-none placeholder:text-text-muted disabled:opacity-50" />
              <button type="submit" disabled={loading || !input.trim()} className="bg-accent hover:bg-accent/80 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm transition-colors">{t.chatbot.send}</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
`;
}

export function buildKnowledgeChunks(data: WorkspaceData, spec?: SiteSpec | null): { chunks: { topic: string; content: string }[] } {
  const chunks: { topic: string; content: string }[] = [];
  const list = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];

  // Personal info chunk
  chunks.push({
    topic: "personal",
    content: `Name: ${data.name} (${data.nameEn})\nTitle: ${data.title} (${data.titleEn})\nEmail: ${data.email}\nLocation: ${data.location}\nBio: ${data.bio}\nBio (EN): ${data.bioEn}`,
  });

  if (spec) {
    chunks.push({
      topic: "site-spec",
      content: `Purpose: ${spec.product?.purpose || ""}\nAudience: ${spec.product?.targetAudience || ""}\nSite Type: ${spec.product?.siteType || ""}\nTheme: ${spec.designSystem?.theme || ""}\nSections: ${(spec.sections || []).map(section => section.id || section.type).filter(Boolean).join(", ")}`,
    });
  }

  // Skills chunk
  if (data.skills.length > 0) {
    chunks.push({
      topic: "skills",
      content: data.skills.map(g => `${g.title}: ${list(g.skills).join(", ")}`).join("\n"),
    });
  }

  // Projects chunk
  if (data.projects.length > 0) {
    chunks.push({
      topic: "projects",
      content: data.projects.map(p => `${p.title} (${p.org}): ${p.desc} [${list(p.tags).join(", ")}]`).join("\n"),
    });
  }

  // Work experience chunk
  if (data.timeline.length > 0) {
    chunks.push({
      topic: "experience",
      content: data.timeline.map(t => `${t.date} - ${t.title}: ${t.desc}`).join("\n"),
    });
  }

  // Education chunk
  if (data.education.length > 0) {
    chunks.push({
      topic: "education",
      content: data.education.map(e => {
        const highlights = list(e.highlights);
        return `${e.school}, ${e.degree}${highlights.length ? ": " + highlights.join("; ") : ""}`;
      }).join("\n"),
    });
  }

  // Links chunk
  if (data.links && data.links.length > 0) {
    chunks.push({
      topic: "links",
      content: data.links.map(l => `${l.label}: ${l.url}`).join("\n"),
    });
  }

  // Raw knowledge from uploaded files (the full chatbotContext)
  if (data.chatbotContext) {
    // Split into manageable chunks (~2000 chars each)
    const raw = data.chatbotContext;
    const sections = raw.split(/\n## /);
    for (const section of sections) {
      const trimmed = section.trim();
      if (!trimmed || trimmed.length < 20) continue;
      const firstLine = trimmed.split("\n")[0] || "raw";
      chunks.push({
        topic: firstLine.slice(0, 50).replace(/[^a-zA-Z0-9\u4e00-\u9fff _.-]/g, ""),
        content: trimmed.slice(0, 3000),
      });
    }
  }

  return { chunks };
}

export function genChatRoute(data: WorkspaceData): string {
  return `import { NextRequest } from "next/server";
import knowledgeData from "@/data/knowledge.json";

interface KnowledgeChunk {
  topic: string;
  content: string;
}

function findRelevantChunks(question: string, chunks: KnowledgeChunk[]): string {
  const q = question.toLowerCase();

  // Keywords for each topic
  const topicKeywords: Record<string, string[]> = {
    personal: ["name", "who", "介绍", "你是谁", "叫什么", "姓名", "邮箱", "email", "位置", "location"],
    skills: ["skill", "技能", "会什么", "擅长", "技术", "能力", "tools", "framework"],
    projects: ["project", "项目", "做过", "作品", "portfolio", "开发了"],
    experience: ["experience", "work", "经历", "工作", "公司", "company", "career", "job"],
    education: ["education", "school", "学校", "学历", "学位", "university", "毕业"],
    links: ["link", "链接", "github", "网站", "blog", "contact", "联系"],
  };

  // Score each chunk by relevance
  const scored = chunks.map(chunk => {
    let score = 0;
    const keywords = topicKeywords[chunk.topic] || [];
    for (const kw of keywords) {
      if (q.includes(kw)) score += 3;
    }
    // Also check if the question words appear in the content
    const words = q.split(/\\s+/).filter(w => w.length > 1);
    for (const word of words) {
      if (chunk.content.toLowerCase().includes(word)) score += 1;
    }
    return { chunk, score };
  });

  // Sort by score descending, take top relevant chunks
  scored.sort((a, b) => b.score - a.score);

  // Always include personal info + top 3 relevant chunks
  const personal = chunks.find(c => c.topic === "personal");
  const relevant = scored.filter(s => s.score > 0).slice(0, 3).map(s => s.chunk);

  // If no relevant chunks found, include everything (short context fallback)
  if (relevant.length === 0) {
    return chunks.map(c => c.content).join("\\n\\n");
  }

  const selected = personal ? [personal, ...relevant.filter(c => c.topic !== "personal")] : relevant;
  return selected.map(c => c.content).join("\\n\\n");
}

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured. Set SILICONFLOW_API_KEY in .env.local" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  // Dynamic knowledge retrieval — find chunks relevant to the user's question
  const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === "user")?.content || "";
  const relevantKnowledge = findRelevantChunks(lastUserMsg, (knowledgeData as { chunks: KnowledgeChunk[] }).chunks);

  const systemPrompt = \`You are ${data.name}'s AI avatar. Answer based on the following profile knowledge. Use first person. Be concise (under 200 words). If the user speaks Chinese, reply in Chinese. If in English, reply in English.

\${relevantKnowledge}\`;

  const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: \`Bearer \${apiKey}\` },
    body: JSON.stringify({
      model: "Pro/zai-org/GLM-5",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.7, max_tokens: 1024, stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return new Response(JSON.stringify({ error: err }), { status: response.status, headers: { "Content-Type": "application/json" } });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") { controller.close(); return; }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) controller.enqueue(encoder.encode(content));
          } catch {}
        }
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
`;
}

/**
 * Generate the Ghibli image generation script using SiliconFlow's image API.
 * Creates: ghibli-background, avatar, chatbot-spirit, and per-project images.
 */
export function genGhibliImageScript(data: WorkspaceData): string {
  // Build project image entries from data
  const projectImages = data.projects.slice(0, 8).map((p, i) => {
    const safeName = `project-${i + 1}.png`;
    const keywords = p.tags.slice(0, 3).join(", ");
    return `  {
    name: "${safeName}",
    prompt: "A Studio Ghibli style watercolor illustration related to ${p.title.replace(/"/g, '\\"')}. Keywords: ${keywords.replace(/"/g, '\\"')}. Warm color palette with sage greens, sky blues, warm creams and golden tones. Hayao Miyazaki inspired painting. Dreamy atmosphere, painterly texture. No characters, no text. 16:9 aspect ratio.",
  },`;
  }).join("\n");

  return `import fs from "fs";
import path from "path";

const API_KEY = process.env.SILICONFLOW_API_KEY || "";
const OUT_DIR = path.resolve("public/images");

const IMAGES = [
  {
    name: "ghibli-background.png",
    prompt: "A wide panoramic Studio Ghibli style landscape painting. Rolling green hills covered in wildflowers, a winding dirt path through meadows, fluffy white cumulus clouds in a soft blue sky, distant mountains with snow-capped peaks, golden sunset light filtering through clouds. Warm watercolor style, dreamy atmosphere, soft color palette with sage greens, sky blues, warm creams and golden tones. Hayao Miyazaki inspired painting. No characters, no text. 16:9 aspect ratio, high resolution.",
  },
  {
    name: "avatar.png",
    prompt: "A cute Studio Ghibli style watercolor painting of an adorable fluffy orange tabby cat sitting upright. The cat has big expressive round eyes, wearing a tiny green leaf scarf. Soft warm lighting, dreamy pastel background with floating dandelion seeds. Miyazaki watercolor illustration style. Circular portrait crop. No text. Square 1:1 ratio.",
  },
  {
    name: "chatbot-spirit.png",
    prompt: "A cute Studio Ghibli style small forest spirit character, round and fluffy, similar to a kodama or small totoro. Soft sage green and white colors, big friendly sparkling eyes, tiny leaf on top of its head. Clean illustration on a warm cream background with soft glow. Kawaii Miyazaki style. No text. Square 1:1 ratio.",
  },
${projectImages}
];

async function generateImage(item) {
  console.log(\`Generating: \${item.name}...\`);
  try {
    const res = await fetch("https://api.siliconflow.cn/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: \`Bearer \${API_KEY}\`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "black-forest-labs/FLUX.1-schnell",
        prompt: item.prompt,
        image_size: item.name === "avatar.png" || item.name === "chatbot-spirit.png" ? "1024x1024" : "1024x576",
        num_inference_steps: 20,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(\`API error for \${item.name}: \${res.status} \${errText}\`);
      return false;
    }

    const data = await res.json();
    const imageUrl = data.images?.[0]?.url;
    if (!imageUrl) {
      console.error(\`No image URL in response for \${item.name}\`);
      return false;
    }

    // Download the image
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      console.error(\`Failed to download image for \${item.name}\`);
      return false;
    }
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const outPath = path.join(OUT_DIR, item.name);
    fs.writeFileSync(outPath, buffer);
    console.log(\`Saved: \${outPath} (\${buffer.length} bytes)\`);
    return true;
  } catch (err) {
    console.error(\`Error generating \${item.name}:\`, err.message);
    return false;
  }
}

async function main() {
  if (!API_KEY) {
    console.error("Please set SILICONFLOW_API_KEY in .env.local");
    process.exit(1);
  }
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const item of IMAGES) {
    const ok = await generateImage(item);
    if (!ok) console.log("  -> Failed, continuing...");
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log("\\nDone! Check public/images/");
}

main();
`;
}
