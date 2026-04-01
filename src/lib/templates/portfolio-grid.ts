import { registerTemplate, genSharedFiles, serializeTranslations } from "../template-renderer";
import type { ContentModel } from "../content-model";

function render(content: ContentModel): Record<string, string> {
  const files = genSharedFiles(content);

  files["src/i18n/translations.ts"] = serializeTranslations(content);

  // globals.css — light theme, masonry grid
  files["src/app/globals.css"] = `@import "tailwindcss";

@theme {
  --color-background: #ffffff;
  --color-foreground: #111827;
  --color-muted: #6b7280;
  --color-border: #e5e7eb;
  --color-card: #f9fafb;
  --color-accent: #111827;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --radius-default: 8px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-sans);
  background: var(--color-background);
  color: var(--color-foreground);
  -webkit-font-smoothing: antialiased;
}

::selection {
  background: var(--color-accent);
  color: #fff;
}

a { color: inherit; text-decoration: none; }

.masonry {
  column-count: 2;
  column-gap: 16px;
}
@media (min-width: 768px) {
  .masonry { column-count: 3; }
}
.masonry-item {
  break-inside: avoid;
  margin-bottom: 16px;
}

.section-fade {
  opacity: 0;
  transform: translateY(24px);
  animation: fadeUp 0.6s ease forwards;
}
@keyframes fadeUp {
  to { opacity: 1; transform: translateY(0); }
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
import { useLanguage } from "@/components/LanguageProvider";
import LanguageProvider from "@/components/LanguageProvider";
import Image from "next/image";

function PageContent() {
  const { lang, t, toggle } = useLanguage();

  return (
    <main className="min-h-screen bg-[var(--color-background)]">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-sm border-b border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="font-bold text-sm tracking-tight">{t.hero.name}</span>
          <div className="flex items-center gap-6 text-sm text-[var(--color-muted)]">
            {t.availableSections.includes("projects") && <a href="#projects" className="hover:text-[var(--color-foreground)] transition-colors">{t.nav.projects}</a>}
            {t.availableSections.includes("skills") && <a href="#skills" className="hover:text-[var(--color-foreground)] transition-colors">{t.nav.skills}</a>}
            <a href="#contact" className="hover:text-[var(--color-foreground)] transition-colors">{t.nav.contact}</a>
            <button onClick={toggle} className="px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-card)] transition-colors text-xs">{lang === "zh" ? "EN" : "ZH"}</button>
          </div>
        </div>
      </nav>

      {/* Hero — minimal */}
      <section className="pt-36 pb-12 px-6 section-fade">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{t.hero.name}</h1>
          {t.hero.title && <p className="text-base text-[var(--color-muted)]">{t.hero.title}</p>}
        </div>
      </section>

      {/* About */}
      {t.about.text && (
        <section className="max-w-5xl mx-auto px-6 pb-16 section-fade" style={{ animationDelay: "0.1s" }}>
          <p className="text-sm leading-relaxed text-[var(--color-muted)] max-w-2xl">{t.about.text}</p>
        </section>
      )}

      {/* Projects — Pinterest-style masonry grid */}
      {t.projects.length > 0 && (
        <section id="projects" className="max-w-5xl mx-auto px-6 pb-20 section-fade" style={{ animationDelay: "0.2s" }}>
          <h2 className="text-lg font-semibold mb-8">{t.nav.projects}</h2>
          <div className="masonry">
            {t.projects.map((p, i) => (
              <a key={i} href={p.link || "#"} target={p.link ? "_blank" : undefined} rel="noopener noreferrer"
                className="masonry-item block rounded-lg border border-[var(--color-border)] overflow-hidden hover:shadow-lg transition-shadow bg-white">
                {p.image && (
                  <div className="relative w-full" style={{ paddingBottom: \`\${50 + (i % 3) * 15}%\` }}>
                    <Image src={p.image} alt={p.title} fill className="object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-medium text-sm mb-1">{p.title}</h3>
                  <p className="text-xs text-[var(--color-muted)] line-clamp-2 mb-2">{p.desc}</p>
                  {p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.tags.map((tag, j) => (
                        <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-card)] text-[var(--color-muted)]">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Skills — single row of badges */}
      {t.skills.length > 0 && (
        <section id="skills" className="max-w-5xl mx-auto px-6 pb-20 section-fade" style={{ animationDelay: "0.3s" }}>
          <h2 className="text-lg font-semibold mb-6">{t.nav.skills}</h2>
          <div className="flex flex-wrap gap-2">
            {t.skills.flatMap(g => g.skills).map((skill, i) => (
              <span key={i} className="px-3 py-1.5 text-xs rounded-full bg-[var(--color-foreground)] text-white">{skill}</span>
            ))}
          </div>
        </section>
      )}

      {/* Experience */}
      {t.experience.length > 0 && (
        <section id="experience" className="max-w-5xl mx-auto px-6 pb-20 section-fade" style={{ animationDelay: "0.35s" }}>
          <h2 className="text-lg font-semibold mb-6">{t.nav.experience}</h2>
          <div className="space-y-3">
            {t.experience.map((exp, i) => (
              <div key={i} className="flex items-start gap-4 py-3 border-b border-[var(--color-border)] last:border-0">
                <span className="text-xs text-[var(--color-muted)] w-28 shrink-0 pt-0.5">{exp.period}</span>
                <div>
                  <h3 className="font-medium text-sm">{exp.title}</h3>
                  {exp.org && <p className="text-xs text-[var(--color-muted)]">{exp.org}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Education */}
      {t.education.length > 0 && (
        <section id="education" className="max-w-5xl mx-auto px-6 pb-20 section-fade" style={{ animationDelay: "0.4s" }}>
          <h2 className="text-lg font-semibold mb-6">{t.nav.education}</h2>
          <div className="space-y-3">
            {t.education.map((edu, i) => (
              <div key={i} className="flex items-start gap-4 py-3 border-b border-[var(--color-border)] last:border-0">
                <span className="text-xs text-[var(--color-muted)] w-28 shrink-0 pt-0.5">{edu.period}</span>
                <div>
                  <h3 className="font-medium text-sm">{edu.school}</h3>
                  <p className="text-xs text-[var(--color-muted)]">{edu.degree}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact — clean footer links */}
      <section id="contact" className="max-w-5xl mx-auto px-6 pb-20 section-fade" style={{ animationDelay: "0.45s" }}>
        <div className="flex flex-wrap items-center gap-6 py-8 border-t border-[var(--color-border)]">
          {t.contact.email && (
            <a href={"mailto:" + t.contact.email} className="text-sm font-medium hover:underline">{t.contact.email}</a>
          )}
          {t.contact.links.map((link, i) => (
            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors">{link.label}</a>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-[var(--color-muted)]">
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
  id: "portfolio-grid",
  name: "Grid Portfolio",
  nameCn: "网格作品集",
  mode: "portfolio",
  description: "Light theme with masonry-style Pinterest grid, minimal hero, and inline skill badges.",
  render,
});
