import { registerTemplate, genSharedFiles, serializeTranslations } from "../template-renderer";
import type { ContentModel } from "../content-model";

function render(content: ContentModel): Record<string, string> {
  const files = genSharedFiles(content);

  files["src/i18n/translations.ts"] = serializeTranslations(content);

  // globals.css — white background, indigo accent, monospace feel
  files["src/app/globals.css"] = `@import "tailwindcss";

@theme {
  --color-background: #ffffff;
  --color-foreground: #1e1b4b;
  --color-muted: #64748b;
  --color-border: #e2e8f0;
  --color-card: #f8fafc;
  --color-accent: #4f46e5;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
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

h1, h2, h3 { font-family: var(--font-mono); }

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
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "${content.meta?.siteTitle || content.profile.name}",
  description: "${content.meta?.description || ""}",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className={\`\${inter.variable} \${jetbrainsMono.variable}\`}>
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

function PageContent() {
  const { lang, t, toggle } = useLanguage();

  // Group posts by category
  const categories = Array.from(new Set(t.posts.map(p => p.category || "General")));
  const postsByCategory: Record<string, typeof t.posts> = {};
  for (const cat of categories) {
    postsByCategory[cat] = t.posts.filter(p => (p.category || "General") === cat);
  }

  return (
    <main className="min-h-screen bg-[var(--color-background)]">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-3">
          <span className="text-sm font-bold" style={{ fontFamily: "var(--font-mono)" }}>{t.hero.name}</span>
          <div className="flex items-center gap-5 text-xs text-[var(--color-muted)]" style={{ fontFamily: "var(--font-mono)" }}>
            {t.availableSections.includes("posts") && <a href="#posts" className="hover:text-[var(--color-accent)] transition-colors">{t.nav.posts}</a>}
            {t.availableSections.includes("publications") && <a href="#publications" className="hover:text-[var(--color-accent)] transition-colors">{t.nav.publications}</a>}
            {t.availableSections.includes("projects") && <a href="#projects" className="hover:text-[var(--color-accent)] transition-colors">{t.nav.projects}</a>}
            <a href="#contact" className="hover:text-[var(--color-accent)] transition-colors">{t.nav.contact}</a>
            <button onClick={toggle} className="px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-card)] transition-colors">{lang === "zh" ? "EN" : "ZH"}</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-12 px-6 section-fade">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ fontFamily: "var(--font-mono)" }}>{t.hero.name}</h1>
          {t.hero.title && <p className="text-sm text-[var(--color-muted)]" style={{ fontFamily: "var(--font-mono)" }}>{t.hero.title}</p>}
          {t.about.text && <p className="text-sm text-[var(--color-muted)] mt-4 max-w-2xl leading-relaxed">{t.about.text}</p>}
        </div>
      </section>

      {/* Posts — organized by category, table-like */}
      {t.posts.length > 0 && (
        <section id="posts" className="max-w-4xl mx-auto px-6 pb-16 section-fade" style={{ animationDelay: "0.1s" }}>
          <h2 className="text-lg font-bold mb-8" style={{ fontFamily: "var(--font-mono)" }}>{t.nav.posts}</h2>
          {categories.map((cat, ci) => (
            <div key={ci} className="mb-10">
              <h3 className="text-xs font-bold text-[var(--color-accent)] uppercase tracking-wider mb-4" style={{ fontFamily: "var(--font-mono)" }}>{cat}</h3>
              <div className="border border-[var(--color-border)] rounded-md overflow-hidden">
                {postsByCategory[cat].map((post, i) => (
                  <div key={i} className={\`flex items-center gap-4 px-4 py-3 \${i > 0 ? "border-t border-[var(--color-border)]" : ""} hover:bg-[var(--color-card)] transition-colors\`}>
                    <time className="text-xs text-[var(--color-muted)] w-24 shrink-0" style={{ fontFamily: "var(--font-mono)" }}>{post.publishedAt || "---"}</time>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium truncate">{post.title}</h4>
                      <p className="text-xs text-[var(--color-muted)] truncate mt-0.5">{post.excerpt}</p>
                    </div>
                    {post.tags.length > 0 && (
                      <div className="hidden sm:flex gap-1 shrink-0">
                        {post.tags.slice(0, 2).map((tag, j) => (
                          <span key={j} className="text-[10px] px-2 py-0.5 rounded bg-[var(--color-card)] text-[var(--color-muted)]" style={{ fontFamily: "var(--font-mono)" }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Publications */}
      {t.publications.length > 0 && (
        <section id="publications" className="max-w-4xl mx-auto px-6 pb-16 section-fade" style={{ animationDelay: "0.2s" }}>
          <h2 className="text-lg font-bold mb-8" style={{ fontFamily: "var(--font-mono)" }}>{t.nav.publications}</h2>
          <div className="space-y-4">
            {t.publications.map((pub, i) => (
              <div key={i} className="p-4 rounded-md border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors">
                <h3 className="text-sm font-medium mb-1">{pub.title}</h3>
                {pub.authors && <p className="text-xs text-[var(--color-muted)]">{pub.authors}</p>}
                <div className="flex items-center gap-3 mt-2">
                  {pub.venue && <span className="text-xs text-[var(--color-accent)] font-medium" style={{ fontFamily: "var(--font-mono)" }}>{pub.venue}</span>}
                  {pub.year && <span className="text-xs text-[var(--color-muted)]" style={{ fontFamily: "var(--font-mono)" }}>{pub.year}</span>}
                  {pub.url && <a href={pub.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-accent)] hover:underline" style={{ fontFamily: "var(--font-mono)" }}>[link]</a>}
                </div>
                {pub.abstract && <p className="text-xs text-[var(--color-muted)] mt-2 leading-relaxed">{pub.abstract}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Projects */}
      {t.projects.length > 0 && (
        <section id="projects" className="max-w-4xl mx-auto px-6 pb-16 section-fade" style={{ animationDelay: "0.25s" }}>
          <h2 className="text-lg font-bold mb-8" style={{ fontFamily: "var(--font-mono)" }}>{t.nav.projects}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {t.projects.map((p, i) => (
              <a key={i} href={p.link || "#"} target={p.link ? "_blank" : undefined} rel="noopener noreferrer"
                className="block p-4 rounded-md border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors">
                <h3 className="text-sm font-medium mb-1" style={{ fontFamily: "var(--font-mono)" }}>{p.title}</h3>
                <p className="text-xs text-[var(--color-muted)] line-clamp-2">{p.desc}</p>
                {p.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.tags.map((tag, j) => (
                      <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-card)] text-[var(--color-muted)]" style={{ fontFamily: "var(--font-mono)" }}>{tag}</span>
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
        <section id="skills" className="max-w-4xl mx-auto px-6 pb-16 section-fade" style={{ animationDelay: "0.3s" }}>
          <h2 className="text-lg font-bold mb-6" style={{ fontFamily: "var(--font-mono)" }}>{t.nav.skills}</h2>
          <div className="space-y-4">
            {t.skills.map((group, i) => (
              <div key={i}>
                <h3 className="text-xs font-bold text-[var(--color-accent)] uppercase tracking-wider mb-2" style={{ fontFamily: "var(--font-mono)" }}>{group.title}</h3>
                <div className="flex flex-wrap gap-2">
                  {group.skills.map((skill, j) => (
                    <span key={j} className="text-xs px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-card)]" style={{ fontFamily: "var(--font-mono)" }}>{skill}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Experience */}
      {t.experience.length > 0 && (
        <section id="experience" className="max-w-4xl mx-auto px-6 pb-16 section-fade" style={{ animationDelay: "0.35s" }}>
          <h2 className="text-lg font-bold mb-6" style={{ fontFamily: "var(--font-mono)" }}>{t.nav.experience}</h2>
          <div className="border border-[var(--color-border)] rounded-md overflow-hidden">
            {t.experience.map((exp, i) => (
              <div key={i} className={\`flex items-start gap-4 px-4 py-3 \${i > 0 ? "border-t border-[var(--color-border)]" : ""}\`}>
                <span className="text-xs text-[var(--color-muted)] w-24 shrink-0 pt-0.5" style={{ fontFamily: "var(--font-mono)" }}>{exp.period}</span>
                <div>
                  <h3 className="text-sm font-medium">{exp.title}</h3>
                  {exp.org && <p className="text-xs text-[var(--color-muted)]">{exp.org}</p>}
                  <p className="text-xs text-[var(--color-muted)] mt-1">{exp.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      <section id="contact" className="max-w-4xl mx-auto px-6 pb-16 section-fade" style={{ animationDelay: "0.4s" }}>
        <h2 className="text-lg font-bold mb-4" style={{ fontFamily: "var(--font-mono)" }}>{t.nav.contact}</h2>
        <div className="flex flex-wrap gap-4">
          {t.contact.email && <a href={"mailto:" + t.contact.email} className="text-sm text-[var(--color-accent)] hover:underline" style={{ fontFamily: "var(--font-mono)" }}>{t.contact.email}</a>}
          {t.contact.links.map((link, i) => (
            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors" style={{ fontFamily: "var(--font-mono)" }}>{link.label}</a>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-[var(--color-muted)] border-t border-[var(--color-border)]" style={{ fontFamily: "var(--font-mono)" }}>
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
  id: "blog-research",
  name: "Research Blog",
  nameCn: "学术研究博客",
  mode: "blog",
  description: "White background with indigo accent, JetBrains Mono headings, table-like post layout, publications section, academic feel.",
  render,
});
