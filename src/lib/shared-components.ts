/**
 * Shared Components — ChatBot, SharePoster, LanguageProvider, and other
 * standard components that every generated site needs.
 *
 * These are injected as files regardless of generation mode.
 * Code Agent is told to import and use these.
 */
import { getInstalledNextVersion } from "./next-version";

/**
 * Generate all infrastructure + shared component files.
 * Used by BOTH default mode (template renderer) and advanced mode (Code Agent).
 * Does NOT generate page.tsx or globals.css — those come from templates or Code Agent.
 */
export function generateBaseFiles(options: {
  siteName?: string;
  chatbotContext?: string;
  theme?: string;
}): Record<string, string> {
  const files: Record<string, string> = {};
  const nextVersion = getInstalledNextVersion();

  // package.json
  files["package.json"] = JSON.stringify({
    name: "my-site",
    version: "1.0.0",
    type: "module",
    scripts: { dev: "next dev", build: "next build", start: "next start" },
    dependencies: {
      "@tailwindcss/postcss": "^4.2.1",
      "@types/node": "^25.4.0",
      "@types/react": "^19.2.14",
      dijkstrajs: "^1.0.3",
      next: nextVersion,
      postcss: "^8.5.8",
      pngjs: "^7.0.0",
      react: "^19.2.4",
      "react-dom": "^19.2.4",
      qrcode: "^1.5.4",
      "@types/qrcode": "^1.5.5",
      tailwindcss: "^4.2.1",
      typescript: "^5.9.3",
    },
  }, null, 2);

  // tsconfig
  files["tsconfig.json"] = JSON.stringify({
    compilerOptions: {
      target: "ES2017", lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true, skipLibCheck: true, strict: true, noEmit: true,
      esModuleInterop: true, module: "esnext", moduleResolution: "bundler",
      resolveJsonModule: true, isolatedModules: true, jsx: "preserve",
      incremental: true, plugins: [{ name: "next" }],
      paths: { "@/*": ["./src/*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  }, null, 2);

  files["next.config.ts"] = `import type { NextConfig } from "next";\nconst nextConfig: NextConfig = {};\nexport default nextConfig;\n`;
  files["postcss.config.mjs"] = `const config = { plugins: { "@tailwindcss/postcss": {} } };\nexport default config;\n`;
  files[".gitignore"] = "node_modules/\n.next/\n.env.local\n.DS_Store\n";
  files[".env.local"] = `SILICONFLOW_API_KEY=sk-tiucfyagykltjzwgnkyzgxkrzkomwwfrauhvepzserdjtupv\n`;

  files["src/app/not-found.tsx"] = `export default function NotFound() {\n  return (\n    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>\n      <h1>404 - Page Not Found</h1>\n    </div>\n  );\n}\n`;

  // Knowledge for chatbot
  const chunks: Array<{ topic: string; content: string }> = [];
  if (options.chatbotContext) {
    const sections = options.chatbotContext.split("\n## ").filter(Boolean);
    for (const section of sections.slice(0, 30)) {
      const lines = section.split("\n");
      chunks.push({ topic: lines[0]?.trim() || "general", content: section });
    }
  }
  files["src/data/knowledge.json"] = JSON.stringify({ chunks }, null, 2);
  files["public/images/README.txt"] = "Place your project images and avatar.png here.\n";

  // LanguageProvider
  files["src/components/LanguageProvider.tsx"] = generateLanguageProvider();

  // ChatBot
  files["src/components/ChatBot.tsx"] = generateChatBot();

  // SharePoster
  files["src/components/SharePoster.tsx"] = generateSharePoster();

  // CartoonAssistant — animated animal character + chat (alternative to ChatBot)
  files["src/components/CartoonAssistant.tsx"] = generateCartoonAssistant(options.theme);

  // ProjectDemo — embed Bilibili / YouTube / GitHub / StackBlitz
  files["src/components/ProjectDemo.tsx"] = generateProjectDemo();

  return files;
}

function generateLanguageProvider(): string {
  return `"use client";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { translations, type Lang, type Translations } from "@/i18n/translations";

interface LanguageContextType {
  lang: Lang;
  t: Translations;
  toggle: () => void;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "zh",
  t: translations.zh,
  toggle: () => {},
});

function detectDefaultLang(): Lang {
  const zh = translations.zh;
  const name = zh?.hero?.name || zh?.name || "";
  if (/[\u4e00-\u9fff]/.test(name)) return "zh";
  if (/[a-zA-Z]{2,}/.test(name)) return "en";
  const bio = zh?.about?.text || "";
  const cnChars = (bio.match(/[\u4e00-\u9fff]/g) || []).length;
  const enChars = (bio.match(/[a-zA-Z]/g) || []).length;
  return cnChars >= enChars ? "zh" : "en";
}

export default function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("zh");

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    if (saved && translations[saved]) setLang(saved);
    else setLang(detectDefaultLang());
  }, []);

  const toggle = useCallback(() => {
    setLang(prev => {
      const next = prev === "zh" ? "en" : "zh";
      localStorage.setItem("lang", next);
      return next;
    });
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, t: translations[lang], toggle }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
`;
}

function generateChatBot(): string {
  return `"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "./LanguageProvider";

interface Message { role: "user" | "assistant"; content: string; }

export default function ChatBot() {
  const { t, lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const chatbot = t.chatbot;

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs); setInput(""); setLoading(true);
    try {
      const pathParts = window.location.pathname.split("/").filter(Boolean);
      const siteId = pathParts[pathParts[0] === "drafts" ? 1 : 0] || "";
      const origin = window.location.port === "3002" ? window.location.origin.replace(":3002", ":3001") : "";
      const chatUrl = origin && siteId ? \`\${origin}/api/site-chat/\${siteId}\` : "/api/chat";
      const res = await fetch(chatUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: newMsgs }) });
      if (!res.ok) throw new Error();
      if (!res.body) throw new Error("Empty response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let content = "";
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        content += decoder.decode(value, { stream: true });
        setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content }]);
      }
      content += decoder.decode();
      if (content) setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
    } finally { setLoading(false); }
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-accent text-white shadow-lg hover:scale-110 transition-all flex items-center justify-center" title={chatbot.tooltip}>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
    </button>
  );

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[360px] max-h-[520px] bg-bg-card-solid rounded-2xl shadow-2xl border border-line flex flex-col overflow-hidden">
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-line">
        <div><p className="font-semibold text-sm">{chatbot.title}</p><p className="text-xs text-text-muted">{chatbot.subtitle}</p></div>
        <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-text-muted mb-3">{chatbot.welcome}</p>
            <div className="space-y-1.5">{chatbot.suggestions.map(s => (<button key={s} onClick={() => send(s)} className="block w-full px-3 py-2 rounded-lg bg-bg-tag text-xs text-text-muted hover:bg-accent-soft transition-all text-left">{s}</button>))}</div>
          </div>
        )}
        {messages.map((m, i) => (<div key={i} className={\`flex \${m.role === "user" ? "justify-end" : "justify-start"}\`}><div className={\`max-w-[80%] px-3 py-2 rounded-xl text-sm \${m.role === "user" ? "bg-accent text-white" : "bg-bg-tag text-text"}\`}>{m.content || (loading && i === messages.length - 1 ? "..." : "")}</div></div>))}
        <div ref={endRef} />
      </div>
      <div className="shrink-0 px-3 py-2 border-t border-line flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") send(input); }} placeholder={chatbot.placeholder} className="flex-1 px-3 py-2 rounded-lg bg-bg-tag text-sm border-none focus:outline-none" />
        <button onClick={() => send(input)} disabled={loading || !input.trim()} className="px-3 py-2 rounded-lg bg-accent text-white text-sm disabled:opacity-30">{chatbot.send}</button>
      </div>
    </div>
  );
}
`;
}

function pickAnimalForTheme(theme?: string): string {
  const themeAnimals: Record<string, string[]> = {
    cyberpunk: ["fox", "owl"], "neo-tokyo": ["fox", "cat"], "terminal-green": ["owl", "fox"],
    brutalist: ["owl", "penguin"], vaporwave: ["cat", "bunny"], "gradient-mesh": ["cat", "bunny"],
    minimalist: ["cat", "penguin"], glassmorphism: ["cat", "bunny"], aurora: ["penguin", "fox"],
    ghibli: ["bunny", "shiba"], nature: ["bunny", "shiba"], watercolor: ["bunny", "cat"],
    retro: ["shiba", "penguin"], "craft-paper": ["shiba", "bunny"], "ink-wash": ["panda", "cat"],
    cinematic: ["fox", "owl"], editorial: ["owl", "cat"], "bold-creative": ["shiba", "fox"],
  };
  const choices = theme && themeAnimals[theme] ? themeAnimals[theme] : ["cat", "shiba", "bunny", "fox", "owl", "panda", "penguin"];
  return choices[Math.floor(Math.random() * choices.length)];
}

function getAnimalSvg(animal: string): string {
  const animals: Record<string, string> = {
    cat: `<svg viewBox="0 0 120 150" fill="none" xmlns="http://www.w3.org/2000/svg">
<g class="ca-body-g">
  <ellipse cx="60" cy="120" rx="30" ry="28" fill="var(--color-accent,#6366f1)"/>
  <g class="ca-arm-l"><ellipse cx="32" cy="125" rx="10" ry="7" fill="var(--color-accent,#6366f1)" transform="rotate(-15,32,125)"/></g>
  <g class="ca-arm-r"><ellipse cx="88" cy="125" rx="10" ry="7" fill="var(--color-accent,#6366f1)" transform="rotate(15,88,125)"/></g>
  <path d="M45,145 Q60,150 75,145" stroke="var(--color-accent,#6366f1)" stroke-width="4" stroke-linecap="round" fill="none"/>
</g>
<g class="ca-head-g">
  <circle cx="60" cy="58" r="38" fill="#F5D5C0"/>
  <path d="M24,42 L32,12 L48,35Z" fill="#F5D5C0"/><path d="M96,42 L88,12 L72,35Z" fill="#F5D5C0"/>
  <path d="M27,38 L34,16 L46,34Z" fill="#FFB5C5" opacity="0.5"/><path d="M93,38 L86,16 L74,34Z" fill="#FFB5C5" opacity="0.5"/>
  <g class="ca-eyes">
    <ellipse cx="44" cy="55" rx="7" ry="8" fill="#fff"/><ellipse cx="45" cy="56" rx="4.5" ry="5" fill="#333"/><circle cx="47" cy="54" r="1.8" fill="#fff"/>
    <ellipse cx="76" cy="55" rx="7" ry="8" fill="#fff"/><ellipse cx="77" cy="56" rx="4.5" ry="5" fill="#333"/><circle cx="79" cy="54" r="1.8" fill="#fff"/>
  </g>
  <g class="ca-blink"><rect x="35" y="49" width="18" height="14" rx="7" fill="#F5D5C0" opacity="0"/><rect x="67" y="49" width="18" height="14" rx="7" fill="#F5D5C0" opacity="0"/></g>
  <ellipse cx="60" cy="68" rx="3" ry="2.2" fill="#FFB5C5"/>
  <g class="ca-mouth">
    <path class="ca-m-smile" d="M50,74 Q55,78 60,74 Q65,78 70,74" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round"/>
    <ellipse class="ca-m-open" cx="60" cy="76" rx="6" ry="4" fill="#333" opacity="0"/>
    <path class="ca-m-happy" d="M48,73 Q55,80 60,73 Q65,80 72,73" stroke="#333" stroke-width="2" fill="rgba(255,120,120,0.3)" stroke-linecap="round" opacity="0"/>
  </g>
  <line x1="22" y1="60" x2="8" y2="56" stroke="#333" stroke-width="1.5" opacity="0.3"/>
  <line x1="22" y1="65" x2="6" y2="66" stroke="#333" stroke-width="1.5" opacity="0.3"/>
  <line x1="98" y1="60" x2="112" y2="56" stroke="#333" stroke-width="1.5" opacity="0.3"/>
  <line x1="98" y1="65" x2="114" y2="66" stroke="#333" stroke-width="1.5" opacity="0.3"/>
</g></svg>`,

    shiba: `<svg viewBox="0 0 120 150" fill="none" xmlns="http://www.w3.org/2000/svg">
<g class="ca-body-g">
  <ellipse cx="60" cy="122" rx="28" ry="26" fill="#E8A64C"/>
  <ellipse cx="60" cy="126" rx="18" ry="16" fill="#FFF3D6"/>
  <g class="ca-arm-l"><ellipse cx="34" cy="122" rx="9" ry="7" fill="#E8A64C"/></g>
  <g class="ca-arm-r"><ellipse cx="86" cy="122" rx="9" ry="7" fill="#E8A64C"/></g>
</g>
<g class="ca-head-g">
  <circle cx="60" cy="56" r="38" fill="#E8A64C"/>
  <circle cx="60" cy="60" r="28" fill="#FFF3D6"/>
  <path d="M26,40 L22,8 L46,32Z" fill="#E8A64C"/><path d="M94,40 L98,8 L74,32Z" fill="#E8A64C"/>
  <g class="ca-eyes">
    <ellipse cx="44" cy="52" rx="5" ry="5.5" fill="#333"/><circle cx="46" cy="50" r="1.5" fill="#fff"/>
    <ellipse cx="76" cy="52" rx="5" ry="5.5" fill="#333"/><circle cx="78" cy="50" r="1.5" fill="#fff"/>
  </g>
  <g class="ca-blink"><rect x="37" y="48" width="14" height="11" rx="5" fill="#FFF3D6" opacity="0"/><rect x="69" y="48" width="14" height="11" rx="5" fill="#FFF3D6" opacity="0"/></g>
  <ellipse cx="60" cy="65" rx="4" ry="3" fill="#333"/>
  <g class="ca-mouth">
    <path class="ca-m-smile" d="M52,72 Q60,80 68,72" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round"/>
    <ellipse class="ca-m-open" cx="60" cy="74" rx="6" ry="4.5" fill="#FF8888" opacity="0"/>
    <path class="ca-m-happy" d="M50,70 Q60,82 70,70" stroke="#333" stroke-width="2" fill="rgba(255,120,120,0.3)" stroke-linecap="round" opacity="0"/>
  </g>
  <ellipse cx="36" cy="66" rx="8" ry="5" fill="rgba(255,150,150,0.3)"/>
  <ellipse cx="84" cy="66" rx="8" ry="5" fill="rgba(255,150,150,0.3)"/>
</g></svg>`,

    bunny: `<svg viewBox="0 0 120 155" fill="none" xmlns="http://www.w3.org/2000/svg">
<g class="ca-body-g">
  <ellipse cx="60" cy="125" rx="26" ry="25" fill="#F0F0F0"/>
  <g class="ca-arm-l"><ellipse cx="36" cy="122" rx="8" ry="6" fill="#F0F0F0"/></g>
  <g class="ca-arm-r"><ellipse cx="84" cy="122" rx="8" ry="6" fill="#F0F0F0"/></g>
</g>
<g class="ca-head-g">
  <circle cx="60" cy="68" r="32" fill="#F0F0F0"/>
  <ellipse cx="44" cy="24" rx="10" ry="30" fill="#F0F0F0"/><ellipse cx="44" cy="24" rx="6" ry="22" fill="#FFB5C5" opacity="0.4"/>
  <ellipse cx="76" cy="24" rx="10" ry="30" fill="#F0F0F0"/><ellipse cx="76" cy="24" rx="6" ry="22" fill="#FFB5C5" opacity="0.4"/>
  <g class="ca-eyes">
    <circle cx="48" cy="64" r="5.5" fill="#FF6B8A"/><circle cx="49.5" cy="62.5" r="2" fill="#fff"/>
    <circle cx="72" cy="64" r="5.5" fill="#FF6B8A"/><circle cx="73.5" cy="62.5" r="2" fill="#fff"/>
  </g>
  <g class="ca-blink"><rect x="40" y="59" width="16" height="12" rx="6" fill="#F0F0F0" opacity="0"/><rect x="64" y="59" width="16" height="12" rx="6" fill="#F0F0F0" opacity="0"/></g>
  <ellipse cx="60" cy="74" rx="3" ry="2" fill="#FFB5C5"/>
  <g class="ca-mouth">
    <path class="ca-m-smile" d="M54,79 Q60,84 66,79" stroke="#999" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <ellipse class="ca-m-open" cx="60" cy="80" rx="5" ry="3.5" fill="#FF8888" opacity="0"/>
    <path class="ca-m-happy" d="M52,78 Q60,86 68,78" stroke="#999" stroke-width="1.5" fill="rgba(255,120,120,0.3)" stroke-linecap="round" opacity="0"/>
  </g>
  <ellipse cx="38" cy="74" rx="7" ry="4" fill="rgba(255,180,197,0.35)"/>
  <ellipse cx="82" cy="74" rx="7" ry="4" fill="rgba(255,180,197,0.35)"/>
</g></svg>`,

    fox: `<svg viewBox="0 0 120 150" fill="none" xmlns="http://www.w3.org/2000/svg">
<g class="ca-body-g">
  <ellipse cx="60" cy="122" rx="28" ry="26" fill="#E86C2C"/>
  <ellipse cx="60" cy="128" rx="16" ry="14" fill="#FFF3E0"/>
  <g class="ca-arm-l"><ellipse cx="34" cy="120" rx="9" ry="7" fill="#E86C2C"/></g>
  <g class="ca-arm-r"><ellipse cx="86" cy="120" rx="9" ry="7" fill="#E86C2C"/></g>
  <path d="M48,146 Q60,155 72,146" stroke="#FFF3E0" stroke-width="5" stroke-linecap="round" fill="none"/>
</g>
<g class="ca-head-g">
  <circle cx="60" cy="56" r="36" fill="#E86C2C"/>
  <ellipse cx="60" cy="65" rx="22" ry="18" fill="#FFF3E0"/>
  <path d="M26,38 L18,6 L48,30Z" fill="#E86C2C"/><path d="M30,36 L22,12 L46,30Z" fill="#FFF3E0" opacity="0.4"/>
  <path d="M94,38 L102,6 L72,30Z" fill="#E86C2C"/><path d="M90,36 L98,12 L74,30Z" fill="#FFF3E0" opacity="0.4"/>
  <g class="ca-eyes">
    <ellipse cx="44" cy="52" rx="5" ry="6" fill="#2D5016"/><circle cx="45.5" cy="50.5" r="1.5" fill="#fff"/>
    <ellipse cx="76" cy="52" rx="5" ry="6" fill="#2D5016"/><circle cx="77.5" cy="50.5" r="1.5" fill="#fff"/>
  </g>
  <g class="ca-blink"><rect x="37" y="48" width="14" height="11" rx="5" fill="#E86C2C" opacity="0"/><rect x="69" y="48" width="14" height="11" rx="5" fill="#E86C2C" opacity="0"/></g>
  <ellipse cx="60" cy="64" rx="4" ry="3" fill="#333"/>
  <g class="ca-mouth">
    <path class="ca-m-smile" d="M52,72 Q60,78 68,72" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round"/>
    <ellipse class="ca-m-open" cx="60" cy="74" rx="6" ry="4" fill="#333" opacity="0"/>
    <path class="ca-m-happy" d="M50,70 Q60,80 70,70" stroke="#333" stroke-width="2" fill="rgba(255,120,120,0.3)" stroke-linecap="round" opacity="0"/>
  </g>
</g></svg>`,

    owl: `<svg viewBox="0 0 120 150" fill="none" xmlns="http://www.w3.org/2000/svg">
<g class="ca-body-g">
  <ellipse cx="60" cy="122" rx="30" ry="26" fill="#8B6C5C"/>
  <ellipse cx="60" cy="126" rx="20" ry="18" fill="#D4B896"/>
  <g class="ca-arm-l"><path d="M30,108 L12,96 L28,120Z" fill="#8B6C5C"/></g>
  <g class="ca-arm-r"><path d="M90,108 L108,96 L92,120Z" fill="#8B6C5C"/></g>
</g>
<g class="ca-head-g">
  <circle cx="60" cy="56" r="38" fill="#8B6C5C"/>
  <path d="M24,34 L16,8 L40,28Z" fill="#8B6C5C"/><path d="M96,34 L104,8 L80,28Z" fill="#8B6C5C"/>
  <g class="ca-eyes">
    <circle cx="42" cy="52" r="14" fill="#FFF3D6"/><circle cx="78" cy="52" r="14" fill="#FFF3D6"/>
    <circle cx="42" cy="52" r="7" fill="#E8A64C"/><circle cx="42" cy="52" r="4" fill="#333"/><circle cx="44" cy="50" r="1.5" fill="#fff"/>
    <circle cx="78" cy="52" r="7" fill="#E8A64C"/><circle cx="78" cy="52" r="4" fill="#333"/><circle cx="80" cy="50" r="1.5" fill="#fff"/>
  </g>
  <g class="ca-blink"><rect x="28" y="42" width="28" height="22" rx="11" fill="#8B6C5C" opacity="0"/><rect x="64" y="42" width="28" height="22" rx="11" fill="#8B6C5C" opacity="0"/></g>
  <path d="M56,68 L60,74 L64,68Z" fill="#E8A64C"/>
  <g class="ca-mouth">
    <path class="ca-m-smile" d="M54,78 Q60,82 66,78" stroke="#6B4E3D" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <ellipse class="ca-m-open" cx="60" cy="78" rx="4" ry="3" fill="#6B4E3D" opacity="0"/>
    <path class="ca-m-happy" d="M52,76 Q60,84 68,76" stroke="#6B4E3D" stroke-width="1.5" fill="rgba(200,150,100,0.3)" stroke-linecap="round" opacity="0"/>
  </g>
</g></svg>`,

    panda: `<svg viewBox="0 0 120 150" fill="none" xmlns="http://www.w3.org/2000/svg">
<g class="ca-body-g">
  <ellipse cx="60" cy="122" rx="30" ry="26" fill="#F5F5F5"/>
  <ellipse cx="60" cy="126" rx="20" ry="18" fill="#fff"/>
  <g class="ca-arm-l"><ellipse cx="32" cy="118" rx="11" ry="9" fill="#333"/></g>
  <g class="ca-arm-r"><ellipse cx="88" cy="118" rx="11" ry="9" fill="#333"/></g>
</g>
<g class="ca-head-g">
  <circle cx="60" cy="56" r="38" fill="#F5F5F5"/>
  <ellipse cx="38" cy="48" rx="16" ry="14" fill="#333"/><ellipse cx="82" cy="48" rx="16" ry="14" fill="#333"/>
  <g class="ca-eyes">
    <circle cx="40" cy="52" r="8" fill="#fff"/><circle cx="40" cy="53" r="4.5" fill="#333"/><circle cx="42" cy="51" r="1.5" fill="#fff"/>
    <circle cx="80" cy="52" r="8" fill="#fff"/><circle cx="80" cy="53" r="4.5" fill="#333"/><circle cx="82" cy="51" r="1.5" fill="#fff"/>
  </g>
  <g class="ca-blink"><rect x="30" y="46" width="20" height="14" rx="7" fill="#333" opacity="0"/><rect x="70" y="46" width="20" height="14" rx="7" fill="#333" opacity="0"/></g>
  <ellipse cx="60" cy="66" rx="5" ry="3.5" fill="#333"/>
  <g class="ca-mouth">
    <path class="ca-m-smile" d="M50,73 Q60,80 70,73" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round"/>
    <ellipse class="ca-m-open" cx="60" cy="76" rx="6" ry="4" fill="#333" opacity="0"/>
    <path class="ca-m-happy" d="M48,72 Q60,82 72,72" stroke="#333" stroke-width="2" fill="rgba(255,120,120,0.3)" stroke-linecap="round" opacity="0"/>
  </g>
  <ellipse cx="36" cy="68" rx="6" ry="4" fill="rgba(255,150,150,0.25)"/>
  <ellipse cx="84" cy="68" rx="6" ry="4" fill="rgba(255,150,150,0.25)"/>
</g></svg>`,

    penguin: `<svg viewBox="0 0 120 150" fill="none" xmlns="http://www.w3.org/2000/svg">
<g class="ca-body-g">
  <ellipse cx="60" cy="110" rx="32" ry="38" fill="#2C3E50"/>
  <ellipse cx="60" cy="118" rx="20" ry="26" fill="#F5F5F5"/>
  <g class="ca-arm-l"><path d="M28,100 Q14,110 18,130" stroke="#2C3E50" stroke-width="12" stroke-linecap="round" fill="none"/></g>
  <g class="ca-arm-r"><path d="M92,100 Q106,110 102,130" stroke="#2C3E50" stroke-width="12" stroke-linecap="round" fill="none"/></g>
  <ellipse cx="48" cy="146" rx="10" ry="5" fill="#E8A64C"/><ellipse cx="72" cy="146" rx="10" ry="5" fill="#E8A64C"/>
</g>
<g class="ca-head-g">
  <circle cx="60" cy="48" r="32" fill="#2C3E50"/>
  <ellipse cx="60" cy="52" rx="24" ry="22" fill="#F5F5F5"/>
  <g class="ca-eyes">
    <circle cx="46" cy="46" r="6" fill="#fff"/><circle cx="47" cy="47" r="3.5" fill="#333"/><circle cx="48.5" cy="45.5" r="1.3" fill="#fff"/>
    <circle cx="74" cy="46" r="6" fill="#fff"/><circle cx="75" cy="47" r="3.5" fill="#333"/><circle cx="76.5" cy="45.5" r="1.3" fill="#fff"/>
  </g>
  <g class="ca-blink"><rect x="38" y="41" width="16" height="12" rx="6" fill="#F5F5F5" opacity="0"/><rect x="66" y="41" width="16" height="12" rx="6" fill="#F5F5F5" opacity="0"/></g>
  <path d="M56,56 L60,62 L64,56Z" fill="#E8A64C"/>
  <g class="ca-mouth">
    <path class="ca-m-smile" d="M52,64 Q60,68 68,64" stroke="#333" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <ellipse class="ca-m-open" cx="60" cy="65" rx="5" ry="3" fill="#E8A64C" opacity="0"/>
    <path class="ca-m-happy" d="M50,63 Q60,70 70,63" stroke="#333" stroke-width="1.5" fill="rgba(232,166,76,0.3)" stroke-linecap="round" opacity="0"/>
  </g>
</g></svg>`,
  };

  return animals[animal] || animals.cat;
}

function generateCartoonAssistant(theme?: string): string {
  const animal = pickAnimalForTheme(theme);
  const svgContent = getAnimalSvg(animal).replace(/`/g, "\\`").replace(/\$/g, "\\$");
  return `"use client";

import { useState, useEffect, useRef } from "react";
import { useLanguage } from "./LanguageProvider";

type CharState = "idle" | "waving" | "talking" | "thinking" | "happy";
interface Msg { role: "user" | "assistant"; content: string; }

const SVG_CHAR = \`${svgContent}\`;

const CA_CSS = \`
.ca-wrap{position:fixed;bottom:16px;right:16px;z-index:50;display:flex;align-items:flex-end;gap:10px;pointer-events:none}
.ca-wrap>*{pointer-events:auto}
.ca-char{position:relative;width:100px;cursor:pointer;transition:transform .3s;flex-shrink:0}
.ca-char:hover{transform:scale(1.06)}
.ca-char svg{width:100%;height:auto;display:block}
.ca-hint{position:absolute;bottom:85%;right:50%;transform:translateX(50%);background:var(--color-bg-card,#fff);color:var(--color-text,#333);padding:6px 14px;border-radius:14px;font-size:12px;white-space:nowrap;box-shadow:0 2px 14px rgba(0,0,0,.1);animation:ca-pop .3s}
.ca-hint::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:var(--color-bg-card,#fff)}
.ca-think{position:absolute;bottom:85%;right:50%;transform:translateX(50%);background:var(--color-bg-card,#fff);padding:8px 14px;border-radius:16px;display:flex;gap:5px;box-shadow:0 2px 14px rgba(0,0,0,.1)}
.ca-think::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:var(--color-bg-card,#fff)}
.ca-dot{width:6px;height:6px;background:var(--color-accent,#6366f1);border-radius:50%;animation:ca-dbounce 1.2s ease-in-out infinite}
.ca-dot:nth-child(2){animation-delay:.2s}.ca-dot:nth-child(3){animation-delay:.4s}
.ca-panel{width:340px;max-height:460px;background:var(--color-bg-card,#fff);border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.15);border:1px solid var(--color-line,#e5e5e5);display:flex;flex-direction:column;overflow:hidden;animation:ca-slideup .3s}
.ca-phdr{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--color-line,#e5e5e5)}
.ca-phdr p:first-child{font-weight:600;font-size:14px;color:var(--color-text,#333)}.ca-phdr p:last-child{font-size:11px;color:var(--color-text-muted,#999)}
.ca-phdr button{background:none;border:none;font-size:20px;cursor:pointer;color:var(--color-text-muted,#999);line-height:1}
.ca-msgs{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.ca-welcome{text-align:center;padding:8px 0}.ca-welcome p{font-size:13px;color:var(--color-text-muted,#999);margin-bottom:10px}
.ca-sug{display:flex;flex-direction:column;gap:6px}
.ca-sug button{text-align:left;padding:8px 12px;border-radius:10px;border:1px solid var(--color-line,#e5e5e5);background:transparent;font-size:12px;color:var(--color-text-muted,#666);cursor:pointer;transition:all .2s}
.ca-sug button:hover{background:var(--color-accent-soft,#eef);border-color:var(--color-accent,#6366f1)}
.ca-row{display:flex}.ca-row.user{justify-content:flex-end}.ca-row.assistant{justify-content:flex-start}
.ca-bbl{max-width:80%;padding:8px 12px;border-radius:14px;font-size:13px;line-height:1.5;word-break:break-word}
.ca-row.user .ca-bbl{background:var(--color-accent,#6366f1);color:#fff;border-bottom-right-radius:4px}
.ca-row.assistant .ca-bbl{background:var(--color-bg-card,#f5f5f5);color:var(--color-text,#333);border-bottom-left-radius:4px}
.ca-inp{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--color-line,#e5e5e5)}
.ca-inp input{flex:1;padding:8px 12px;border-radius:10px;border:1px solid var(--color-line,#e5e5e5);font-size:13px;outline:none;background:transparent;color:var(--color-text,#333)}
.ca-inp input:focus{border-color:var(--color-accent,#6366f1)}
.ca-inp button{padding:8px 14px;border-radius:10px;border:none;background:var(--color-accent,#6366f1);color:#fff;font-size:13px;cursor:pointer}
.ca-inp button:disabled{opacity:.3;cursor:default}
[data-state] svg{animation:ca-breathe 3s ease-in-out infinite}
[data-state] .ca-blink rect{animation:ca-blk 4s ease-in-out infinite}
[data-state] .ca-arm-r{transform-origin:92px 118px}
[data-state="waving"] .ca-arm-r{animation:ca-wave .5s ease-in-out 4 alternate}
[data-state="talking"] .ca-m-smile{opacity:0}[data-state="talking"] .ca-m-open{animation:ca-talk .35s ease-in-out infinite alternate}
[data-state="happy"] .ca-m-smile{opacity:0}[data-state="happy"] .ca-m-happy{opacity:1}
[data-state="happy"] svg{animation:ca-bounce .5s ease-out}
[data-state="thinking"] svg{animation:ca-tilt 2s ease-in-out infinite}
@keyframes ca-breathe{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes ca-blk{0%,92%,100%{opacity:0}94%,96%{opacity:1}}
@keyframes ca-wave{from{transform:rotate(0)}to{transform:rotate(-40deg)}}
@keyframes ca-talk{from{opacity:.3;transform:scaleY(.5)}to{opacity:1;transform:scaleY(1)}}
@keyframes ca-bounce{0%{transform:translateY(0)}40%{transform:translateY(-8px)}100%{transform:translateY(0)}}
@keyframes ca-tilt{0%,100%{transform:rotate(0) translateY(0)}50%{transform:rotate(3deg) translateY(-2px)}}
@keyframes ca-pop{from{opacity:0;transform:translateX(50%) translateY(6px)}to{opacity:1;transform:translateX(50%) translateY(0)}}
@keyframes ca-slideup{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes ca-dbounce{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}
@media(max-width:640px){.ca-wrap{right:8px;bottom:8px;gap:6px}.ca-char{width:72px}.ca-panel{width:calc(100vw - 100px);max-height:380px}}
\`;

export default function CartoonAssistant() {
  const { t, lang } = useLanguage();
  const chatbot = t.chatbot ?? { title: "", subtitle: "", welcome: "", placeholder: "", send: "", suggestions: [] as string[], tooltip: "" };
  const [st, setSt] = useState<CharState>("waving");
  const [chatOpen, setChatOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const tmr = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { tmr.current = setTimeout(() => setSt("idle"), 2500); return () => clearTimeout(tmr.current); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const newMsgs = [...msgs, userMsg];
    setMsgs(newMsgs); setInput(""); setLoading(true); setSt("thinking");
    try {
      const pp = window.location.pathname.split("/").filter(Boolean);
      const siteId = pp[pp[0] === "drafts" ? 1 : 0] || "";
      const origin = window.location.port === "3002" ? window.location.origin.replace(":3002", ":3001") : "";
      const chatUrl = origin && siteId ? \`\${origin}/api/site-chat/\${siteId}\` : "/api/chat";
      const res = await fetch(chatUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: newMsgs }) });
      if (!res.ok) throw new Error();
      if (!res.body) throw new Error("Empty response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let content = "";
      setMsgs(prev => [...prev, { role: "assistant", content: "" }]);
      setSt("talking");
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        content += decoder.decode(value, { stream: true });
        setMsgs(prev => [...prev.slice(0, -1), { role: "assistant", content }]);
      }
      content += decoder.decode();
      if (content) setMsgs(prev => [...prev.slice(0, -1), { role: "assistant", content }]);
      if (tmr.current) clearTimeout(tmr.current);
      setSt("happy"); tmr.current = setTimeout(() => setSt("idle"), 3000);
    } catch {
      setMsgs(prev => [...prev, { role: "assistant", content: lang === "zh" ? "抱歉，出了点问题。" : "Sorry, something went wrong." }]);
      setSt("idle");
    } finally { setLoading(false); }
  };

  const toggle = () => {
    if (tmr.current) clearTimeout(tmr.current);
    if (chatOpen) { setChatOpen(false); setSt("idle"); }
    else { setChatOpen(true); setSt("happy"); tmr.current = setTimeout(() => setSt("idle"), 1500); }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CA_CSS }} />
      <div className="ca-wrap">
        {chatOpen && (
          <div className="ca-panel">
            <div className="ca-phdr">
              <div><p>{chatbot.title}</p><p>{chatbot.subtitle}</p></div>
              <button onClick={toggle}>&times;</button>
            </div>
            <div className="ca-msgs">
              {msgs.length === 0 && (
                <div className="ca-welcome">
                  <p>{chatbot.welcome}</p>
                  <div className="ca-sug">{(chatbot.suggestions || []).map((s: string) => (<button key={s} onClick={() => send(s)}>{s}</button>))}</div>
                </div>
              )}
              {msgs.map((m: Msg, i: number) => (
                <div key={i} className={\`ca-row \${m.role}\`}>
                  <div className="ca-bbl">{m.content || (loading && i === msgs.length - 1 ? "..." : "")}</div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className="ca-inp">
              <input value={input} onChange={(e: any) => setInput(e.target.value)} onKeyDown={(e: any) => { if (e.key === "Enter") send(input); }} placeholder={chatbot.placeholder} />
              <button onClick={() => send(input)} disabled={loading || !input.trim()}>{chatbot.send}</button>
            </div>
          </div>
        )}
        <div className="ca-char" data-state={st} onClick={toggle} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
          {st === "thinking" && <div className="ca-think"><span className="ca-dot"/><span className="ca-dot"/><span className="ca-dot"/></div>}
          {!chatOpen && hovered && st === "idle" && <div className="ca-hint">{lang === "zh" ? "点我聊天 👋" : "Chat with me 👋"}</div>}
          <div dangerouslySetInnerHTML={{ __html: SVG_CHAR }} />
        </div>
      </div>
    </>
  );
}
`;
}

function generateProjectDemo(): string {
  return `"use client";

import { useState } from "react";

interface Props { url: string; title?: string; type?: "auto" | "bilibili" | "youtube" | "github" | "stackblitz"; aspectRatio?: string; }

function detectType(url: string): string {
  if (url.includes("bilibili.com")) return "bilibili";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("stackblitz.com")) return "stackblitz";
  if (url.includes("github.com")) return "github";
  return "unknown";
}

function getEmbedUrl(url: string, type: string): string {
  if (type === "bilibili") {
    const m = url.match(/BV[\\w]+/);
    return m ? \`//player.bilibili.com/player.html?bvid=\${m[0]}&high_quality=1\` : url;
  }
  if (type === "youtube") {
    if (url.includes("youtu.be")) return \`https://www.youtube.com/embed/\${url.split("/").pop()}\`;
    const id = new URL(url).searchParams.get("v");
    return id ? \`https://www.youtube.com/embed/\${id}\` : url;
  }
  if (type === "stackblitz") {
    return url.includes("?") ? url + "&embed=1" : url + "?embed=1";
  }
  if (type === "github") {
    return url.replace("github.com", "github1s.com");
  }
  return url;
}

export default function ProjectDemo({ url, title, type = "auto", aspectRatio }: Props) {
  const [loaded, setLoaded] = useState(false);
  const resolved = type === "auto" ? detectType(url) : type;
  const embedUrl = getEmbedUrl(url, resolved);
  const ratio = aspectRatio || (resolved === "bilibili" || resolved === "youtube" ? "16/9" : "3/2");

  return (
    <div style={{ width: "100%", borderRadius: 12, overflow: "hidden", background: "var(--color-bg-card, #f5f5f5)", border: "1px solid var(--color-line, #e5e5e5)" }}>
      {title && <div style={{ padding: "10px 14px", fontWeight: 600, fontSize: 14, borderBottom: "1px solid var(--color-line, #e5e5e5)" }}>{title}</div>}
      <div style={{ position: "relative", width: "100%", aspectRatio: ratio }}>
        {!loaded && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted, #999)", fontSize: 13 }}>Loading...</div>}
        <iframe
          src={embedUrl}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", opacity: loaded ? 1 : 0, transition: "opacity .3s" }}
          onLoad={() => setLoaded(true)}
          allow="autoplay; fullscreen; clipboard-write"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
`;
}

function generateSharePoster(): string {
  return `"use client";

import { useState } from "react";
import { useLanguage } from "./LanguageProvider";

export default function SharePoster() {
  const { t, lang } = useLanguage();
  const share = (t as any).share || { button: lang === "zh" ? "分享" : "Share", title: lang === "zh" ? "分享" : "Share", copy: lang === "zh" ? "复制链接" : "Copy Link", copied: lang === "zh" ? "已复制！" : "Copied!" };
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, url: window.location.href });
      } catch {}
    } else {
      setOpen(true);
    }
  };

  return (
    <>
      <button
        onClick={handleNativeShare}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200 text-sm text-gray-600 shadow-lg hover:shadow-xl hover:bg-white transition-all"
        title={share.button}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        {share.button}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{share.title}</h3>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl mb-4">
              <input readOnly value={typeof window !== "undefined" ? window.location.href : ""} className="flex-1 text-xs text-gray-600 bg-transparent outline-none truncate" />
              <button onClick={handleCopy} className={\`px-3 py-1.5 rounded-lg text-xs font-medium transition-all \${copied ? "bg-green-100 text-green-700" : "bg-accent text-white hover:bg-accent/90"}\`}>
                {copied ? share.copied : share.copy}
              </button>
            </div>
            <div className="flex justify-center gap-4">
              <a href={\`https://twitter.com/intent/tweet?url=\${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}&text=\${encodeURIComponent(document.title)}\`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-blue-50 hover:text-blue-500 transition-all" title="Twitter">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href={\`https://www.linkedin.com/sharing/share-offsite/?url=\${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}\`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-blue-50 hover:text-blue-700 transition-all" title="LinkedIn">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
`;
}
