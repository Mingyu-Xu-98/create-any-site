import { registerTemplate, genSharedFiles, serializeTranslations } from "../template-renderer";
import type { ContentModel } from "../content-model";

function render(content: ContentModel): Record<string, string> {
  const files = genSharedFiles(content);

  files["src/i18n/translations.ts"] = serializeTranslations(content);

  // globals.css
  files["src/app/globals.css"] = `@import "tailwindcss";

@theme {
  --color-background: #0a0a14;
  --color-foreground: #e4e4e7;
  --color-muted: #71717a;
  --color-border: #27272a;
  --color-card: #12121e;
  --color-card-hover: #1a1a2e;
  --color-accent: #6366f1;
  --color-accent-soft: rgba(99, 102, 241, 0.12);
  --color-glow: rgba(99, 102, 241, 0.25);
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --radius-default: 12px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-mono);
  background: var(--color-background);
  color: var(--color-foreground);
  -webkit-font-smoothing: antialiased;
}

::selection {
  background: var(--color-accent);
  color: #fff;
}

a { color: inherit; text-decoration: none; }

.glow-card {
  transition: box-shadow 0.3s ease, border-color 0.3s ease, transform 0.3s ease;
}
.glow-card:hover {
  box-shadow: 0 0 30px var(--color-glow), 0 0 60px rgba(99, 102, 241, 0.08);
  border-color: var(--color-accent);
  transform: translateY(-2px);
}

.gradient-text {
  background: linear-gradient(135deg, var(--color-foreground) 0%, var(--color-accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.section-reveal {
  opacity: 0;
  transform: translateY(32px);
  animation: revealUp 0.7s ease forwards;
}
@keyframes revealUp {
  to { opacity: 1; transform: translateY(0); }
}
`;

  // layout.tsx
  files["src/app/layout.tsx"] = `import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "${content.meta?.siteTitle || content.profile.name}",
  description: "${content.meta?.description || ""}",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className={jetbrains.variable}>
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
import LanguageProvider from "@/components/LanguageProvider";
import Image from "next/image";

function PageContent() {
  const { lang, t, toggle } = useLanguage();

  return (
    <main className="min-h-screen bg-[var(--color-background)] relative">
      {/* Gradient background orb */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[var(--color-accent)] opacity-[0.04] rounded-full blur-[120px] pointer-events-none" />

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[var(--color-background)]/80 backdrop-blur-xl border-b border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="text-sm font-medium text-[var(--color-accent)]">{">"} {t.hero.name}</span>
          <div className="flex items-center gap-6 text-xs text-[var(--color-muted)]">
            {t.availableSections.includes("projects") && <a href="#projects" className="hover:text-[var(--color-accent)] transition-colors">{t.nav.projects}</a>}
            {t.availableSections.includes("experience") && <a href="#experience" className="hover:text-[var(--color-accent)] transition-colors">{t.nav.experience}</a>}
            {t.availableSections.includes("skills") && <a href="#skills" className="hover:text-[var(--color-accent)] transition-colors">{t.nav.skills}</a>}
            <button onClick={toggle} className="px-2.5 py-1 rounded-md border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all text-xs">{lang === "zh" ? "EN" : "ZH"}</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-44 pb-24 text-center px-6 section-reveal">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight gradient-text mb-4">{t.hero.name}</h1>
        {t.hero.title && <p className="text-base text-[var(--color-muted)] mb-8 font-light">{t.hero.title}</p>}
        {t.hero.tags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {t.hero.tags.map((tag, i) => (
              <span key={i} className="px-3 py-1 text-xs rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] border border-[var(--color-accent)]/20">{tag}</span>
            ))}
          </div>
        )}
      </section>

      {/* About */}
      {t.about.text && (
        <section className="max-w-2xl mx-auto px-6 pb-24 section-reveal" style={{ animationDelay: "0.1s" }}>
          <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <p className="text-sm leading-relaxed text-[var(--color-muted)]">{t.about.text}</p>
          </div>
        </section>
      )}

      {/* Projects */}
      {t.projects.length > 0 && (
        <section id="projects" className="max-w-4xl mx-auto px-6 pb-24 section-reveal" style={{ animationDelay: "0.2s" }}>
          <h2 className="text-lg font-semibold mb-8 flex items-center gap-2">
            <span className="text-[var(--color-accent)]">#</span> {t.nav.projects}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {t.projects.map((p, i) => (
              <a key={i} href={p.link || "#"} target={p.link ? "_blank" : undefined} rel="noopener noreferrer"
                className="glow-card block p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
                {p.image && (
                  <div className="relative w-full h-36 mb-4 rounded-lg overflow-hidden bg-[var(--color-background)]">
                    <Image src={p.image} alt={p.title} fill className="object-cover" />
                  </div>
                )}
                <h3 className="font-medium text-sm mb-1">{p.title}</h3>
                {p.badge && <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] mb-2">{p.badge}</span>}
                <p className="text-xs text-[var(--color-muted)] line-clamp-3">{p.desc}</p>
                {p.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {p.tags.map((tag, j) => (
                      <span key={j} className="text-[10px] px-2 py-0.5 rounded bg-[var(--color-background)] text-[var(--color-muted)] border border-[var(--color-border)]">{tag}</span>
                    ))}
                  </div>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Skills */}
      {t.skills.length > 0 && (
        <section id="skills" className="max-w-4xl mx-auto px-6 pb-24 section-reveal" style={{ animationDelay: "0.3s" }}>
          <h2 className="text-lg font-semibold mb-8 flex items-center gap-2">
            <span className="text-[var(--color-accent)]">#</span> {t.nav.skills}
          </h2>
          <div className="space-y-6">
            {t.skills.map((group, i) => (
              <div key={i}>
                <h3 className="text-xs font-medium text-[var(--color-accent)] uppercase tracking-wider mb-3">{group.title}</h3>
                <div className="flex flex-wrap gap-2">
                  {group.skills.map((skill, j) => (
                    <span key={j} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-card)] border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all cursor-default">{skill}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Experience */}
      {t.experience.length > 0 && (
        <section id="experience" className="max-w-4xl mx-auto px-6 pb-24 section-reveal" style={{ animationDelay: "0.4s" }}>
          <h2 className="text-lg font-semibold mb-8 flex items-center gap-2">
            <span className="text-[var(--color-accent)]">#</span> {t.nav.experience}
          </h2>
          <div className="space-y-4">
            {t.experience.map((exp, i) => (
              <div key={i} className="glow-card p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-sm">{exp.title}</h3>
                    {exp.org && <p className="text-xs text-[var(--color-muted)]">{exp.org}</p>}
                  </div>
                  <span className="text-xs text-[var(--color-accent)] whitespace-nowrap ml-4">{exp.period}</span>
                </div>
                <p className="text-xs text-[var(--color-muted)] mt-2">{exp.desc}</p>
                {exp.highlights && exp.highlights.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {exp.highlights.map((h, j) => (
                      <li key={j} className="text-xs text-[var(--color-muted)] flex items-start gap-2">
                        <span className="text-[var(--color-accent)] mt-0.5">-</span> {h}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Education */}
      {t.education.length > 0 && (
        <section id="education" className="max-w-4xl mx-auto px-6 pb-24 section-reveal" style={{ animationDelay: "0.5s" }}>
          <h2 className="text-lg font-semibold mb-8 flex items-center gap-2">
            <span className="text-[var(--color-accent)]">#</span> {t.nav.education}
          </h2>
          <div className="space-y-4">
            {t.education.map((edu, i) => (
              <div key={i} className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
                <h3 className="font-medium text-sm">{edu.school}</h3>
                <p className="text-xs text-[var(--color-muted)]">{edu.degree}</p>
                {edu.period && <p className="text-xs text-[var(--color-accent)] mt-1">{edu.period}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      <section id="contact" className="max-w-4xl mx-auto px-6 pb-24 text-center section-reveal" style={{ animationDelay: "0.6s" }}>
        <h2 className="text-lg font-semibold mb-6 flex items-center justify-center gap-2">
          <span className="text-[var(--color-accent)]">#</span> {t.nav.contact}
        </h2>
        {t.contact.email && (
          <a href={"mailto:" + t.contact.email}
            className="inline-block text-sm text-[var(--color-accent)] hover:underline underline-offset-4 transition-colors">{t.contact.email}</a>
        )}
        {t.contact.links.length > 0 && (
          <div className="flex justify-center gap-4 mt-4">
            {t.contact.links.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                className="text-xs px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all">{link.label}</a>
            ))}
          </div>
        )}
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
  id: "profile-dark",
  name: "Dark Profile",
  nameCn: "暗色个人主页",
  mode: "profile",
  description: "Dark background with indigo accents, JetBrains Mono font, glow hover effects.",
  render,
});
