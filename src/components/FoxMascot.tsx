"use client";

import { useLocale } from "./LocaleProvider";

/**
 * FoxMascot — Animated fox SVG mascot for the landing page hero.
 * Larger version of the CartoonAssistant fox with scene elements (laptop, floating code symbols).
 */
export default function FoxMascot() {
  const { locale } = useLocale();
  const bubbleText = locale === "zh" ? "帮你做个酷网站！" : "Let me build your site!";

  return (
    <div className="fox-mascot-wrap">
      <style>{`
        .fox-mascot-wrap { position: relative; width: 280px; height: 320px; margin: 0 auto; }
        .fox-mascot-wrap svg { width: 100%; height: 100%; }
        .fox-scene { animation: fox-float 4s ease-in-out infinite; }
        @keyframes fox-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .fox-blink rect { animation: fox-blk 4s ease-in-out infinite; }
        @keyframes fox-blk { 0%,92%,100% { opacity: 0; } 94%,96% { opacity: 1; } }
        .fox-tail { transform-origin: 70% 85%; animation: fox-wag 3s ease-in-out infinite; }
        @keyframes fox-wag { 0%,100% { transform: rotate(0deg); } 25% { transform: rotate(8deg); } 75% { transform: rotate(-5deg); } }
        .fox-bubble { position: absolute; top: 8%; right: -10%; background: white; padding: 8px 16px; border-radius: 16px; font-size: 13px; font-weight: 500; color: #333; box-shadow: 0 4px 20px rgba(0,0,0,0.08); white-space: nowrap; animation: fox-bubble-pop 0.4s ease-out both; animation-delay: 1s; opacity: 0; }
        .fox-bubble::after { content: ''; position: absolute; bottom: -6px; left: 30%; border: 6px solid transparent; border-top-color: white; }
        @keyframes fox-bubble-pop { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fox-code-sym { position: absolute; font-family: monospace; font-size: 14px; opacity: 0.15; animation: fox-sym-float 6s ease-in-out infinite; }
        .fox-code-sym:nth-child(1) { top: 15%; left: 5%; animation-delay: 0s; color: #E86C2C; }
        .fox-code-sym:nth-child(2) { top: 25%; right: 8%; animation-delay: -2s; color: #6366f1; }
        .fox-code-sym:nth-child(3) { bottom: 30%; left: 2%; animation-delay: -4s; color: #10b981; }
        @keyframes fox-sym-float { 0%,100% { transform: translateY(0) rotate(0deg); opacity: 0.15; } 50% { transform: translateY(-12px) rotate(5deg); opacity: 0.25; } }
      `}</style>

      {/* Floating code symbols */}
      <span className="fox-code-sym">{"</>"}</span>
      <span className="fox-code-sym">{"{ }"}</span>
      <span className="fox-code-sym">{"#"}</span>

      {/* Speech bubble */}
      <div className="fox-bubble">{bubbleText}</div>

      {/* Fox SVG */}
      <svg viewBox="0 0 280 320" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g className="fox-scene">
          {/* Laptop */}
          <rect x="80" y="230" width="120" height="75" rx="6" fill="#2a2a3a" stroke="#444" strokeWidth="2" />
          <rect x="88" y="238" width="104" height="58" rx="3" fill="#1a1a2e" />
          {/* Screen glow */}
          <rect x="92" y="242" width="96" height="50" rx="2" fill="url(#screenGlow)" opacity="0.8" />
          {/* Screen code lines */}
          <rect x="98" y="250" width="40" height="3" rx="1" fill="#00fff0" opacity="0.6" />
          <rect x="98" y="258" width="60" height="3" rx="1" fill="#ff71ce" opacity="0.4" />
          <rect x="98" y="266" width="35" height="3" rx="1" fill="#00fff0" opacity="0.3" />
          <rect x="98" y="274" width="50" height="3" rx="1" fill="#39ff14" opacity="0.4" />
          {/* Laptop base */}
          <path d="M70,305 L80,305 L80,308 Q140,315 200,308 L200,305 L210,305 L210,310 Q140,320 70,310 Z" fill="#333" />

          {/* Fox tail */}
          <g className="fox-tail">
            <path d="M190,210 Q230,180 240,150 Q245,140 235,145 Q210,170 185,200Z" fill="#E86C2C" />
            <path d="M230,155 Q235,148 228,152 Q215,165 200,195 L205,200 Q220,175 230,155Z" fill="#FFF3E0" opacity="0.5" />
          </g>

          {/* Fox body */}
          <ellipse cx="140" cy="215" rx="42" ry="38" fill="#E86C2C" />
          <ellipse cx="140" cy="222" rx="26" ry="24" fill="#FFF3E0" />
          {/* Arms on laptop */}
          <ellipse cx="105" cy="230" rx="14" ry="10" fill="#E86C2C" transform="rotate(-20,105,230)" />
          <ellipse cx="175" cy="230" rx="14" ry="10" fill="#E86C2C" transform="rotate(20,175,230)" />
          {/* Paws */}
          <circle cx="95" cy="238" r="6" fill="#FFF3E0" />
          <circle cx="185" cy="238" r="6" fill="#FFF3E0" />

          {/* Fox head */}
          <circle cx="140" cy="160" r="52" fill="#E86C2C" />
          <ellipse cx="140" cy="170" rx="34" ry="28" fill="#FFF3E0" />
          {/* Ears */}
          <path d="M92,132 L78,78 L116,120Z" fill="#E86C2C" />
          <path d="M96,128 L86,88 L112,118Z" fill="#FFF3E0" opacity="0.4" />
          <path d="M188,132 L202,78 L164,120Z" fill="#E86C2C" />
          <path d="M184,128 L194,88 L168,118Z" fill="#FFF3E0" opacity="0.4" />
          {/* Eyes */}
          <ellipse cx="120" cy="155" rx="8" ry="9" fill="#2D5016" />
          <circle cx="122" cy="152" r="2.5" fill="#fff" />
          <ellipse cx="160" cy="155" rx="8" ry="9" fill="#2D5016" />
          <circle cx="162" cy="152" r="2.5" fill="#fff" />
          {/* Blink */}
          <g className="fox-blink">
            <rect x="110" y="148" width="20" height="16" rx="8" fill="#E86C2C" opacity="0" />
            <rect x="150" y="148" width="20" height="16" rx="8" fill="#E86C2C" opacity="0" />
          </g>
          {/* Nose */}
          <ellipse cx="140" cy="172" rx="6" ry="4.5" fill="#333" />
          {/* Mouth */}
          <path d="M128,182 Q140,190 152,182" stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          {/* Cheeks */}
          <ellipse cx="108" cy="175" rx="8" ry="5" fill="rgba(255,150,100,0.25)" />
          <ellipse cx="172" cy="175" rx="8" ry="5" fill="rgba(255,150,100,0.25)" />
        </g>

        <defs>
          <linearGradient id="screenGlow" x1="92" y1="242" x2="188" y2="292" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0a1628" />
            <stop offset="1" stopColor="#1a0a2e" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
