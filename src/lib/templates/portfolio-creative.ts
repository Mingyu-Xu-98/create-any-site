import { registerTemplate, genSharedFiles, serializeTranslations } from "../template-renderer";
import type { ContentModel } from "../content-model";

function render(content: ContentModel): Record<string, string> {
  const files = genSharedFiles(content);

  files["src/i18n/translations.ts"] = serializeTranslations(content);

  // globals.css — warm bold theme, coral + blue, playful shapes
  files["src/app/globals.css"] = `@import "tailwindcss";

@theme {
  --color-background: #fffbeb;
  --color-foreground: #1e1e2e;
  --color-muted: #6b6b7b;
  --color-border: #e8e4d9;
  --color-card: #fff8e1;
  --color-coral: #ff6b6b;
  --color-blue: #4d96ff;
  --font-heading: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --radius-default: 16px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-sans);
  background: var(--color-background);
  color: var(--color-foreground);
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

h1, h2, h3 { font-family: var(--font-heading); }

::selection {
  background: var(--color-coral);
  color: #fff;
}

a { color: inherit; text-decoration: none; }

.shape-circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.12;
  pointer-events: none;
}

.section-fade {
  opacity: 0;
  transform: translateY(24px);
  animation: fadeUp 0.6s ease forwards;
}
@keyframes fadeUp {
  to { opacity: 1; transform: translateY(0); }
}

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(5deg); }
}
`;

  // layout.tsx
  files["src/app/layout.tsx"] = `import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-heading" });

export const metadata: Metadata = {
  title: "${content.meta?.siteTitle || content.profile.name}",
  description: "${content.meta?.description || ""}",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className={\`\${inter.variable} \${spaceGrotesk.variable}\`}>
      <body>{children}</body>
    </html>
  );
}
`;

  // LanguageProvider
  files["src/components/LanguageProvider.tsx"] = `"use client";
import { createContext, useContext, useState, ReactNode } from "react";
import { translations, Lang, Translations } from "@/i18n/translations";

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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("zh");
  const toggle = () => setLang(prev => (prev === "zh" ? "en" : "zh"));
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

  // page.tsx
  files["src/app/page.tsx"] = `"use client";
import { useLanguage } from "@/components/LanguageProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import Image from "next/image";

function PageContent() {
  const { lang, t, toggle } = useLanguage();

  return (
    <main className="min-h-screen bg-[var(--color-background)] relative">
      {/* Background shapes */}
      <div className="shape-circle" style={{ width: 300, height: 300, background: "var(--color-coral)", top: -60, right: -80, animation: "float 8s ease-in-out infinite" }} />
      <div className="shape-circle" style={{ width: 200, height: 200, background: "var(--color-blue)", top: 400, left: -60, animation: "float 10s ease-in-out infinite 2s" }} />
      <div className="shape-circle" style={{ width: 150, height: 150, background: "var(--color-coral)", bottom: 200, right: 100, animation: "float 7s ease-in-out infinite 1s" }} />

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[var(--color-background)]/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="font-bold text-sm" style={{ fontFamily: "var(--font-heading)" }}>{t.hero.name}</span>
          <div className="flex items-center gap-6 text-sm text-[var(--color-muted)]">
            {t.availableSections.includes("projects") && <a href="#projects" className="hover:text-[var(--color-coral)] transition-colors">{t.nav.projects}</a>}
            {t.availableSections.includes("awards") && <a href="#awards" className="hover:text-[var(--color-coral)] transition-colors">{t.nav.awards}</a>}
            <a href="#contact" className="hover:text-[var(--color-coral)] transition-colors">{t.nav.contact}</a>
            <button onClick={toggle} className="px-2 py-1 rounded-full border-2 border-[var(--color-foreground)] hover:bg-[var(--color-foreground)] hover:text-white transition-all text-xs font-bold">{lang === "zh" ? "EN" : "ZH"}</button>
          </div>
        </div>
      </nav>

      {/* Hero — split layout */}
      <section className="pt-32 pb-20 px-6 section-fade">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-4 leading-tight" style={{ fontFamily: "var(--font-heading)" }}>{t.hero.name}</h1>
            {t.hero.title && <p className="text-xl text-[var(--color-muted)] mb-6">{t.hero.title}</p>}
            {t.about.text && <p className="text-base leading-relaxed text-[var(--color-muted)] max-w-md">{t.about.text}</p>}
          </div>
          <div className="flex-shrink-0 w-64 h-64 md:w-80 md:h-80 relative">
            <div className="absolute inset-0 rounded-3xl bg-[var(--color-coral)] rotate-6 opacity-30" />
            <div className="absolute inset-0 rounded-3xl bg-[var(--color-blue)] -rotate-3 opacity-20" />
            <div className="absolute inset-4 rounded-2xl bg-[var(--color-background)] border-2 border-[var(--color-foreground)] flex items-center justify-center">
              <span className="text-6xl font-black" style={{ fontFamily: "var(--font-heading)" }}>{t.hero.name.charAt(0)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Projects — numbered case study cards */}
      {t.projects.length > 0 && (
        <section id="projects" className="max-w-5xl mx-auto px-6 pb-24 section-fade" style={{ animationDelay: "0.2s" }}>
          <h2 className="text-3xl font-black mb-12" style={{ fontFamily: "var(--font-heading)" }}>{t.nav.projects}</h2>
          <div className="space-y-8">
            {t.projects.map((p, i) => (
              <a key={i} href={p.link || "#"} target={p.link ? "_blank" : undefined} rel="noopener noreferrer"
                className="block rounded-2xl border-2 border-[var(--color-foreground)] bg-white p-8 hover:shadow-[8px_8px_0_var(--color-coral)] transition-shadow group">
                <div className="flex items-start gap-6">
                  <span className="text-5xl font-black text-[var(--color-coral)] opacity-40 leading-none" style={{ fontFamily: "var(--font-heading)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2 group-hover:text-[var(--color-coral)] transition-colors" style={{ fontFamily: "var(--font-heading)" }}>{p.title}</h3>
                    <p className="text-sm text-[var(--color-muted)] mb-4 leading-relaxed">{p.desc}</p>
                    {p.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {p.tags.map((tag, j) => (
                          <span key={j} className="text-xs px-3 py-1 rounded-full border border-[var(--color-foreground)] font-medium">{tag}</span>
                        ))}
                      </div>
                    )}
                    {p.highlights && p.highlights.length > 0 && (
                      <ul className="mt-4 space-y-1">
                        {p.highlights.map((h, j) => (
                          <li key={j} className="text-sm text-[var(--color-muted)] flex items-start gap-2">
                            <span className="text-[var(--color-coral)] mt-0.5">*</span> {h}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {p.image && (
                    <div className="hidden md:block relative w-40 h-28 rounded-xl overflow-hidden border-2 border-[var(--color-foreground)] shrink-0">
                      <Image src={p.image} alt={p.title} fill className="object-cover" />
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Skills */}
      {t.skills.length > 0 && (
        <section id="skills" className="max-w-5xl mx-auto px-6 pb-24 section-fade" style={{ animationDelay: "0.3s" }}>
          <h2 className="text-3xl font-black mb-10" style={{ fontFamily: "var(--font-heading)" }}>{t.nav.skills}</h2>
          <div className="flex flex-wrap gap-3">
            {t.skills.flatMap((g, gi) => g.skills.map((s, si) => (
              <span key={\`\${gi}-\${si}\`} className="px-4 py-2 text-sm font-bold rounded-full border-2 border-[var(--color-foreground)] hover:bg-[var(--color-foreground)] hover:text-white transition-all cursor-default">{s}</span>
            )))}
          </div>
        </section>
      )}

      {/* Awards */}
      {t.awards.length > 0 && (
        <section id="awards" className="max-w-5xl mx-auto px-6 pb-24 section-fade" style={{ animationDelay: "0.35s" }}>
          <h2 className="text-3xl font-black mb-10" style={{ fontFamily: "var(--font-heading)" }}>{t.nav.awards}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {t.awards.map((a, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white border-2 border-[var(--color-foreground)]">
                <div className="text-2xl mb-2">&#127942;</div>
                <h3 className="font-bold mb-1" style={{ fontFamily: "var(--font-heading)" }}>{a.title}</h3>
                {a.org && <p className="text-sm text-[var(--color-muted)]">{a.org}</p>}
                {a.year && <p className="text-xs text-[var(--color-coral)] font-bold mt-1">{a.year}</p>}
                {a.description && <p className="text-sm text-[var(--color-muted)] mt-2">{a.description}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Experience */}
      {t.experience.length > 0 && (
        <section id="experience" className="max-w-5xl mx-auto px-6 pb-24 section-fade" style={{ animationDelay: "0.4s" }}>
          <h2 className="text-3xl font-black mb-10" style={{ fontFamily: "var(--font-heading)" }}>{t.nav.experience}</h2>
          <div className="space-y-4">
            {t.experience.map((exp, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-xl hover:bg-white transition-colors">
                <div className="w-3 h-3 rounded-full mt-1.5 shrink-0" style={{ background: i % 2 === 0 ? "var(--color-coral)" : "var(--color-blue)" }} />
                <div>
                  <h3 className="font-bold text-sm" style={{ fontFamily: "var(--font-heading)" }}>{exp.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                    {exp.org && <span>{exp.org}</span>}
                    {exp.period && <span>/ {exp.period}</span>}
                  </div>
                  <p className="text-sm text-[var(--color-muted)] mt-1">{exp.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact — fun animated section */}
      <section id="contact" className="max-w-5xl mx-auto px-6 pb-24 section-fade" style={{ animationDelay: "0.5s" }}>
        <div className="rounded-3xl bg-[var(--color-foreground)] text-white p-12 md:p-16 text-center relative overflow-hidden">
          <div className="shape-circle" style={{ width: 200, height: 200, background: "var(--color-coral)", top: -40, right: -40, opacity: 0.2 }} />
          <div className="shape-circle" style={{ width: 120, height: 120, background: "var(--color-blue)", bottom: -30, left: -30, opacity: 0.2 }} />
          <h2 className="text-4xl font-black mb-4 relative z-10" style={{ fontFamily: "var(--font-heading)" }}>{t.nav.contact}</h2>
          {t.contact.email && (
            <a href={"mailto:" + t.contact.email}
              className="inline-block mt-4 px-8 py-3 rounded-full bg-[var(--color-coral)] text-white font-bold text-lg hover:scale-105 transition-transform relative z-10">
              {t.contact.email}
            </a>
          )}
          {t.contact.links.length > 0 && (
            <div className="flex justify-center gap-4 mt-6 relative z-10">
              {t.contact.links.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-white/70 hover:text-white transition-colors underline underline-offset-4">{link.label}</a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-[var(--color-muted)]">
        {t.footer}
      </footer>
    </main>
  );
}

export default function Page() {
  return (
    <LanguageProvider>
      <PageContent />
    </LanguageProvider>
  );
}
`;

  return files;
}

registerTemplate({
  id: "portfolio-creative",
  name: "Creative Portfolio",
  nameCn: "创意作品集",
  mode: "portfolio",
  description: "Warm bold theme with coral and blue accents, Space Grotesk typography, numbered case study cards, and playful shapes.",
  render,
});
