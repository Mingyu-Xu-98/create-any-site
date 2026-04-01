import { registerTemplate, genSharedFiles, serializeTranslations } from "../template-renderer";
import type { ContentModel } from "../content-model";

function render(content: ContentModel): Record<string, string> {
  const files = genSharedFiles(content);

  files["src/i18n/translations.ts"] = serializeTranslations(content);

  // globals.css — dark theme with purple→pink gradient accents, glass cards
  files["src/app/globals.css"] = `@import "tailwindcss";

@theme {
  --color-background: #0f0f1a;
  --color-foreground: #e4e4e7;
  --color-muted: #71717a;
  --color-border: rgba(255,255,255,0.08);
  --color-card: rgba(255,255,255,0.04);
  --color-accent-start: #a855f7;
  --color-accent-end: #ec4899;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --radius-default: 16px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-sans);
  background: var(--color-background);
  color: var(--color-foreground);
  -webkit-font-smoothing: antialiased;
}

::selection {
  background: var(--color-accent-start);
  color: #fff;
}

a { color: inherit; text-decoration: none; }

.gradient-text {
  background: linear-gradient(135deg, var(--color-accent-start), var(--color-accent-end));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.glass {
  background: rgba(255,255,255,0.05);
  backdrop-filter: blur(12px);
  border: 1px solid var(--color-border);
}

.section-fade {
  opacity: 0;
  transform: translateY(24px);
  animation: fadeUp 0.6s ease forwards;
}
@keyframes fadeUp {
  to { opacity: 1; transform: translateY(0); }
}

.project-card:hover .project-overlay {
  opacity: 1;
}
`;

  // layout.tsx
  files["src/app/layout.tsx"] = `import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "${content.meta?.siteTitle || content.profile.name}",
  description: "${content.meta?.description || ""}",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className={inter.variable}>
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
import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import LanguageProvider from "@/components/LanguageProvider";
import Image from "next/image";

function PageContent() {
  const { lang, t, toggle } = useLanguage();
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = Array.from(new Set(t.projects.flatMap(p => p.tags)));
  const filteredProjects = activeTag
    ? t.projects.filter(p => p.tags.includes(activeTag))
    : t.projects;

  return (
    <main className="min-h-screen bg-[var(--color-background)]">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 glass">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="font-bold text-sm gradient-text">{t.hero.name}</span>
          <div className="flex items-center gap-6 text-sm text-[var(--color-muted)]">
            {t.availableSections.includes("projects") && <a href="#projects" className="hover:text-[var(--color-foreground)] transition-colors">{t.nav.projects}</a>}
            {t.availableSections.includes("skills") && <a href="#skills" className="hover:text-[var(--color-foreground)] transition-colors">{t.nav.skills}</a>}
            {t.availableSections.includes("experience") && <a href="#experience" className="hover:text-[var(--color-foreground)] transition-colors">{t.nav.experience}</a>}
            <a href="#contact" className="hover:text-[var(--color-foreground)] transition-colors">{t.nav.contact}</a>
            <button onClick={toggle} className="px-2 py-1 rounded-md border border-[var(--color-border)] hover:bg-white/10 transition-colors text-xs">{lang === "zh" ? "EN" : "ZH"}</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-44 pb-24 text-center px-6 section-fade">
        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-4 gradient-text">{t.hero.name}</h1>
        <p className="text-xl text-[var(--color-muted)] mb-8">Portfolio</p>
        {t.hero.title && <p className="text-lg text-[var(--color-foreground)] opacity-80 mb-8 max-w-xl mx-auto">{t.hero.title}</p>}
        {allTags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={() => setActiveTag(null)} className={\`px-4 py-1.5 text-xs rounded-full transition-all \${!activeTag ? "bg-gradient-to-r from-[var(--color-accent-start)] to-[var(--color-accent-end)] text-white" : "glass text-[var(--color-muted)] hover:text-white"}\`}>All</button>
            {allTags.slice(0, 8).map((tag, i) => (
              <button key={i} onClick={() => setActiveTag(tag)} className={\`px-4 py-1.5 text-xs rounded-full transition-all \${activeTag === tag ? "bg-gradient-to-r from-[var(--color-accent-start)] to-[var(--color-accent-end)] text-white" : "glass text-[var(--color-muted)] hover:text-white"}\`}>{tag}</button>
            ))}
          </div>
        )}
      </section>

      {/* About */}
      {t.about.text && (
        <section className="max-w-3xl mx-auto px-6 pb-20 section-fade" style={{ animationDelay: "0.1s" }}>
          <p className="text-base leading-relaxed text-[var(--color-muted)] text-center">{t.about.text}</p>
        </section>
      )}

      {/* Projects — large image cards with hover overlay */}
      {filteredProjects.length > 0 && (
        <section id="projects" className="max-w-6xl mx-auto px-6 pb-24 section-fade" style={{ animationDelay: "0.2s" }}>
          <h2 className="text-2xl font-bold mb-10 gradient-text">{t.nav.projects}</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {filteredProjects.map((p, i) => (
              <a key={i} href={p.link || "#"} target={p.link ? "_blank" : undefined} rel="noopener noreferrer"
                className="project-card group relative rounded-2xl overflow-hidden glass aspect-video flex items-end">
                {p.image && <Image src={p.image} alt={p.title} fill className="object-cover opacity-60 group-hover:opacity-40 transition-opacity" />}
                <div className="project-overlay absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 transition-opacity duration-300 flex flex-col justify-end p-6">
                  <h3 className="font-bold text-lg text-white mb-1">{p.title}</h3>
                  <p className="text-sm text-white/70 line-clamp-2 mb-3">{p.desc}</p>
                  {p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.tags.map((tag, j) => (
                        <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                {!p.image && (
                  <div className="p-6 relative z-10">
                    <h3 className="font-bold text-lg mb-1">{p.title}</h3>
                    <p className="text-sm text-[var(--color-muted)] line-clamp-2">{p.desc}</p>
                  </div>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Skills — visual bar chart */}
      {t.skills.length > 0 && (
        <section id="skills" className="max-w-4xl mx-auto px-6 pb-24 section-fade" style={{ animationDelay: "0.3s" }}>
          <h2 className="text-2xl font-bold mb-10 gradient-text">{t.nav.skills}</h2>
          <div className="space-y-8">
            {t.skills.map((group, i) => (
              <div key={i}>
                <h3 className="text-sm font-medium text-[var(--color-muted)] mb-4">{group.title}</h3>
                <div className="space-y-3">
                  {group.skills.map((skill, j) => (
                    <div key={j} className="flex items-center gap-4">
                      <span className="text-sm w-32 shrink-0">{skill}</span>
                      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent-start)] to-[var(--color-accent-end)]"
                          style={{ width: \`\${70 + ((j * 13 + i * 7) % 30)}%\`, transition: "width 1s ease" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Experience — minimal timeline */}
      {t.experience.length > 0 && (
        <section id="experience" className="max-w-4xl mx-auto px-6 pb-24 section-fade" style={{ animationDelay: "0.4s" }}>
          <h2 className="text-2xl font-bold mb-10 gradient-text">{t.nav.experience}</h2>
          <div className="space-y-4">
            {t.experience.map((exp, i) => (
              <div key={i} className="glass rounded-xl p-5 flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-[var(--color-accent-start)] to-[var(--color-accent-end)] mt-2 shrink-0" />
                <div>
                  <div className="flex items-baseline gap-3 mb-1">
                    <h3 className="font-medium">{exp.title}</h3>
                    {exp.period && <span className="text-xs text-[var(--color-muted)]">{exp.period}</span>}
                  </div>
                  {exp.org && <p className="text-sm text-[var(--color-muted)]">{exp.org}</p>}
                  <p className="text-sm text-[var(--color-muted)] mt-1">{exp.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact CTA */}
      <section id="contact" className="max-w-4xl mx-auto px-6 pb-24 text-center section-fade" style={{ animationDelay: "0.5s" }}>
        <div className="glass rounded-2xl p-12">
          <h2 className="text-3xl font-bold mb-4 gradient-text">{t.nav.contact}</h2>
          {t.contact.email && (
            <a href={"mailto:" + t.contact.email}
              className="inline-block mt-4 px-8 py-3 rounded-full bg-gradient-to-r from-[var(--color-accent-start)] to-[var(--color-accent-end)] text-white font-medium hover:opacity-90 transition-opacity">
              {t.contact.email}
            </a>
          )}
          {t.contact.links.length > 0 && (
            <div className="flex justify-center gap-4 mt-6">
              {t.contact.links.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-[var(--color-muted)] hover:text-white transition-colors">{link.label}</a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-[var(--color-muted)] border-t border-[var(--color-border)]">
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
  id: "portfolio-showcase",
  name: "Showcase Portfolio",
  nameCn: "展示型作品集",
  mode: "portfolio",
  description: "Dark theme with purple-to-pink gradient accents, glass cards, hover overlays, and skill progress bars.",
  render,
});
