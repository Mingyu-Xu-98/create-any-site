import { registerTemplate, genSharedFiles, serializeTranslations } from "../template-renderer";
import type { ContentModel } from "../content-model";

function render(content: ContentModel): Record<string, string> {
  const files = genSharedFiles(content);

  files["src/i18n/translations.ts"] = serializeTranslations(content);

  // globals.css
  files["src/app/globals.css"] = `@import "tailwindcss";

@theme {
  --color-background: #faf9f6;
  --color-foreground: #1a1a1a;
  --color-muted: #6b6560;
  --color-border: #e0ddd7;
  --color-card: #ffffff;
  --color-accent: #c9553d;
  --color-accent-soft: rgba(201, 85, 61, 0.08);
  --font-serif: "Playfair Display", Georgia, "Times New Roman", serif;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --radius-default: 4px;
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

h1, h2, h3 {
  font-family: var(--font-serif);
}

.editorial-line {
  display: block;
  width: 48px;
  height: 2px;
  background: var(--color-accent);
}

.editorial-fade {
  opacity: 0;
  transform: translateY(20px);
  animation: editorialIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes editorialIn {
  to { opacity: 1; transform: translateY(0); }
}

.hover-lift {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease;
}
.hover-lift:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(0,0,0,0.08);
}
`;

  // layout.tsx
  files["src/app/layout.tsx"] = `import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "${content.meta?.siteTitle || content.profile.name}",
  description: "${content.meta?.description || ""}",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className={\`\${playfair.variable} \${inter.variable}\`}>
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
      <nav className="fixed top-0 inset-x-0 z-50 bg-[var(--color-background)]/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-8 py-5 border-b border-[var(--color-border)]">
          <span className="font-[family-name:var(--font-serif)] text-lg tracking-tight">{t.hero.name}</span>
          <div className="flex items-center gap-8 text-xs uppercase tracking-widest text-[var(--color-muted)]">
            {t.availableSections.includes("projects") && <a href="#projects" className="hover:text-[var(--color-accent)] transition-colors">{t.nav.projects}</a>}
            {t.availableSections.includes("experience") && <a href="#experience" className="hover:text-[var(--color-accent)] transition-colors">{t.nav.experience}</a>}
            {t.availableSections.includes("skills") && <a href="#skills" className="hover:text-[var(--color-accent)] transition-colors">{t.nav.skills}</a>}
            {t.availableSections.includes("contact") && <a href="#contact" className="hover:text-[var(--color-accent)] transition-colors">{t.nav.contact}</a>}
            <button onClick={toggle} className="ml-2 px-2 py-1 text-xs border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-all">{lang === "zh" ? "EN" : "ZH"}</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-48 pb-32 px-8 editorial-fade">
        <div className="max-w-5xl mx-auto">
          <span className="editorial-line mb-6" />
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">{t.hero.name}</h1>
          {t.hero.title && <p className="text-xl md:text-2xl text-[var(--color-muted)] font-[family-name:var(--font-serif)] italic max-w-xl">{t.hero.title}</p>}
          {t.hero.tags.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-8">
              {t.hero.tags.map((tag, i) => (
                <span key={i} className="text-xs uppercase tracking-widest text-[var(--color-muted)] border-b border-[var(--color-border)] pb-0.5">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* About — two column */}
      {t.about.text && (
        <section className="max-w-5xl mx-auto px-8 pb-28 editorial-fade" style={{ animationDelay: "0.15s" }}>
          <div className="grid md:grid-cols-[1fr_2fr] gap-12 items-start">
            <div>
              <span className="editorial-line mb-4" />
              <h2 className="text-2xl font-bold">About</h2>
            </div>
            <p className="text-base leading-[1.9] text-[var(--color-muted)]">{t.about.text}</p>
          </div>
        </section>
      )}

      {/* Projects — magazine grid */}
      {t.projects.length > 0 && (
        <section id="projects" className="max-w-5xl mx-auto px-8 pb-28 editorial-fade" style={{ animationDelay: "0.25s" }}>
          <span className="editorial-line mb-4" />
          <h2 className="text-3xl font-bold mb-12">{t.nav.projects}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {t.projects.map((p, i) => (
              <a key={i} href={p.link || "#"} target={p.link ? "_blank" : undefined} rel="noopener noreferrer"
                className={"hover-lift block bg-[var(--color-card)] border border-[var(--color-border)] overflow-hidden" + (i === 0 ? " sm:col-span-2 lg:col-span-2" : "")}>
                {p.image && (
                  <div className={"relative w-full overflow-hidden bg-[var(--color-background)]" + (i === 0 ? " h-64" : " h-40")}>
                    <Image src={p.image} alt={p.title} fill className="object-cover" />
                  </div>
                )}
                <div className="p-5">
                  {p.badge && <span className="inline-block text-[10px] uppercase tracking-widest text-[var(--color-accent)] mb-2">{p.badge}</span>}
                  <h3 className="font-[family-name:var(--font-serif)] text-lg font-semibold mb-1">{p.title}</h3>
                  {p.org && <p className="text-xs text-[var(--color-muted)] mb-2">{p.org}</p>}
                  <p className="text-sm text-[var(--color-muted)] line-clamp-3 leading-relaxed">{p.desc}</p>
                  {p.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {p.tags.map((tag, j) => (
                        <span key={j} className="text-[10px] uppercase tracking-wider text-[var(--color-muted)]">{tag}</span>
                      ))}
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
        <section id="skills" className="max-w-5xl mx-auto px-8 pb-28 editorial-fade" style={{ animationDelay: "0.35s" }}>
          <div className="grid md:grid-cols-[1fr_2fr] gap-12 items-start">
            <div>
              <span className="editorial-line mb-4" />
              <h2 className="text-2xl font-bold">{t.nav.skills}</h2>
            </div>
            <div className="space-y-8">
              {t.skills.map((group, i) => (
                <div key={i}>
                  <h3 className="text-xs uppercase tracking-widest text-[var(--color-accent)] mb-3">{group.title}</h3>
                  <div className="flex flex-wrap gap-2">
                    {group.skills.map((skill, j) => (
                      <span key={j} className="px-3 py-1.5 text-sm border border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-accent)] transition-colors cursor-default">{skill}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Experience */}
      {t.experience.length > 0 && (
        <section id="experience" className="max-w-5xl mx-auto px-8 pb-28 editorial-fade" style={{ animationDelay: "0.45s" }}>
          <span className="editorial-line mb-4" />
          <h2 className="text-3xl font-bold mb-12">{t.nav.experience}</h2>
          <div className="space-y-0 divide-y divide-[var(--color-border)]">
            {t.experience.map((exp, i) => (
              <div key={i} className="py-8 grid md:grid-cols-[200px_1fr] gap-6">
                <div className="text-sm text-[var(--color-accent)]">{exp.period}</div>
                <div>
                  <h3 className="font-[family-name:var(--font-serif)] text-lg font-semibold">{exp.title}</h3>
                  {exp.org && <p className="text-sm text-[var(--color-muted)] mt-0.5">{exp.org}</p>}
                  <p className="text-sm text-[var(--color-muted)] mt-3 leading-relaxed">{exp.desc}</p>
                  {exp.highlights && exp.highlights.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {exp.highlights.map((h, j) => (
                        <li key={j} className="text-sm text-[var(--color-muted)] flex items-start gap-2">
                          <span className="text-[var(--color-accent)] mt-1 text-xs">&#9656;</span> {h}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Education */}
      {t.education.length > 0 && (
        <section id="education" className="max-w-5xl mx-auto px-8 pb-28 editorial-fade" style={{ animationDelay: "0.55s" }}>
          <div className="grid md:grid-cols-[1fr_2fr] gap-12 items-start">
            <div>
              <span className="editorial-line mb-4" />
              <h2 className="text-2xl font-bold">{t.nav.education}</h2>
            </div>
            <div className="space-y-6">
              {t.education.map((edu, i) => (
                <div key={i}>
                  <h3 className="font-[family-name:var(--font-serif)] text-lg font-semibold">{edu.school}</h3>
                  <p className="text-sm text-[var(--color-muted)]">{edu.degree}</p>
                  {edu.period && <p className="text-xs text-[var(--color-accent)] mt-1">{edu.period}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact */}
      <section id="contact" className="max-w-5xl mx-auto px-8 pb-28 editorial-fade" style={{ animationDelay: "0.65s" }}>
        <div className="border-t border-[var(--color-border)] pt-16 text-center">
          <span className="editorial-line mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-6">{t.nav.contact}</h2>
          {t.contact.email && (
            <a href={"mailto:" + t.contact.email}
              className="text-lg font-[family-name:var(--font-serif)] text-[var(--color-accent)] hover:underline underline-offset-4 transition-colors">{t.contact.email}</a>
          )}
          {t.contact.links.length > 0 && (
            <div className="flex justify-center gap-6 mt-6">
              {t.contact.links.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs uppercase tracking-widest text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors border-b border-transparent hover:border-[var(--color-accent)] pb-0.5">{link.label}</a>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 text-center text-xs text-[var(--color-muted)] border-t border-[var(--color-border)]">
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
  id: "profile-editorial",
  name: "Editorial Profile",
  nameCn: "编辑风个人主页",
  mode: "profile",
  description: "Warm editorial magazine feel with Playfair Display serif headings, asymmetric layouts, and elegant transitions.",
  render,
});
