import { registerTemplate, genSharedFiles, serializeTranslations } from "../template-renderer";
import type { ContentModel } from "../content-model";

function render(content: ContentModel): Record<string, string> {
  const files = genSharedFiles(content);

  // translations
  files["src/i18n/translations.ts"] = serializeTranslations(content);

  // globals.css
  files["src/app/globals.css"] = `@import "tailwindcss";

@theme {
  --color-background: #ffffff;
  --color-foreground: #111111;
  --color-muted: #6b7280;
  --color-border: #e5e7eb;
  --color-card: #f9fafb;
  --color-accent: #111111;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --radius-default: 12px;
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
import { LanguageProvider } from "@/components/LanguageProvider";
import Image from "next/image";

function PageContent() {
  const { lang, t, toggle } = useLanguage();

  return (
    <main className="min-h-screen bg-[var(--color-background)]">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="font-semibold text-sm tracking-tight">{t.hero.name}</span>
          <div className="flex items-center gap-6 text-sm text-[var(--color-muted)]">
            {t.availableSections.includes("projects") && <a href="#projects" className="hover:text-[var(--color-foreground)] transition-colors">{t.nav.projects}</a>}
            {t.availableSections.includes("experience") && <a href="#experience" className="hover:text-[var(--color-foreground)] transition-colors">{t.nav.experience}</a>}
            {t.availableSections.includes("skills") && <a href="#skills" className="hover:text-[var(--color-foreground)] transition-colors">{t.nav.skills}</a>}
            <button onClick={toggle} className="px-2 py-1 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-card)] transition-colors text-xs">{lang === "zh" ? "EN" : "ZH"}</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-20 text-center px-6 section-fade">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">{t.hero.name}</h1>
        {t.hero.title && <p className="text-lg text-[var(--color-muted)] mb-6">{t.hero.title}</p>}
        {t.hero.tags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {t.hero.tags.map((tag, i) => (
              <span key={i} className="px-3 py-1 text-xs rounded-full bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-muted)]">{tag}</span>
            ))}
          </div>
        )}
      </section>

      {/* About */}
      {t.about.text && (
        <section className="max-w-2xl mx-auto px-6 pb-20 section-fade" style={{ animationDelay: "0.1s" }}>
          <p className="text-base leading-relaxed text-[var(--color-muted)]">{t.about.text}</p>
        </section>
      )}

      {/* Projects */}
      {t.projects.length > 0 && (
        <section id="projects" className="max-w-3xl mx-auto px-6 pb-20 section-fade" style={{ animationDelay: "0.2s" }}>
          <h2 className="text-xl font-semibold mb-8">{t.nav.projects}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {t.projects.map((p, i) => (
              <a key={i} href={p.link || "#"} target={p.link ? "_blank" : undefined} rel="noopener noreferrer"
                className="block p-5 rounded-xl border border-[var(--color-border)] bg-white hover:shadow-md transition-shadow">
                {p.image && (
                  <div className="relative w-full h-36 mb-4 rounded-lg overflow-hidden bg-[var(--color-card)]">
                    <Image src={p.image} alt={p.title} fill className="object-cover" />
                  </div>
                )}
                <h3 className="font-medium mb-1">{p.title}</h3>
                {p.org && <p className="text-xs text-[var(--color-muted)] mb-2">{p.org}</p>}
                <p className="text-sm text-[var(--color-muted)] line-clamp-3">{p.desc}</p>
                {p.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {p.tags.map((tag, j) => (
                      <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-card)] text-[var(--color-muted)]">{tag}</span>
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
        <section id="skills" className="max-w-3xl mx-auto px-6 pb-20 section-fade" style={{ animationDelay: "0.3s" }}>
          <h2 className="text-xl font-semibold mb-8">{t.nav.skills}</h2>
          <div className="space-y-6">
            {t.skills.map((group, i) => (
              <div key={i}>
                <h3 className="text-sm font-medium text-[var(--color-muted)] mb-3">{group.title}</h3>
                <div className="flex flex-wrap gap-2">
                  {group.skills.map((skill, j) => (
                    <span key={j} className="px-3 py-1.5 text-sm rounded-lg bg-[var(--color-card)] border border-[var(--color-border)]">{skill}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Experience Timeline */}
      {t.experience.length > 0 && (
        <section id="experience" className="max-w-3xl mx-auto px-6 pb-20 section-fade" style={{ animationDelay: "0.4s" }}>
          <h2 className="text-xl font-semibold mb-8">{t.nav.experience}</h2>
          <div className="space-y-6 border-l-2 border-[var(--color-border)] pl-6">
            {t.experience.map((exp, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-[var(--color-accent)]" />
                <p className="text-xs text-[var(--color-muted)] mb-1">{exp.period}</p>
                <h3 className="font-medium">{exp.title}</h3>
                {exp.org && <p className="text-sm text-[var(--color-muted)]">{exp.org}</p>}
                <p className="text-sm text-[var(--color-muted)] mt-2">{exp.desc}</p>
                {exp.highlights && exp.highlights.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {exp.highlights.map((h, j) => (
                      <li key={j} className="text-sm text-[var(--color-muted)] pl-3 relative before:content-[''] before:absolute before:left-0 before:top-2 before:w-1 before:h-1 before:rounded-full before:bg-[var(--color-muted)]">{h}</li>
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
        <section id="education" className="max-w-3xl mx-auto px-6 pb-20 section-fade" style={{ animationDelay: "0.5s" }}>
          <h2 className="text-xl font-semibold mb-8">{t.nav.education}</h2>
          <div className="space-y-4">
            {t.education.map((edu, i) => (
              <div key={i} className="p-5 rounded-xl border border-[var(--color-border)]">
                <h3 className="font-medium">{edu.school}</h3>
                <p className="text-sm text-[var(--color-muted)]">{edu.degree}</p>
                {edu.period && <p className="text-xs text-[var(--color-muted)] mt-1">{edu.period}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      <section id="contact" className="max-w-3xl mx-auto px-6 pb-20 text-center section-fade" style={{ animationDelay: "0.6s" }}>
        <h2 className="text-xl font-semibold mb-4">{t.nav.contact}</h2>
        {t.contact.email && <a href={"mailto:" + t.contact.email} className="text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors">{t.contact.email}</a>}
        {t.contact.links.length > 0 && (
          <div className="flex justify-center gap-4 mt-4">
            {t.contact.links.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                className="text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors underline underline-offset-4">{link.label}</a>
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
  id: "profile-minimal",
  name: "Minimal Profile",
  nameCn: "极简个人主页",
  mode: "profile",
  description: "Clean white background with lots of whitespace, Inter font, black/gray palette.",
  render,
});
