import { registerTemplate, genSharedFiles, serializeTranslations } from "../template-renderer";
import type { ContentModel } from "../content-model";

function render(content: ContentModel): Record<string, string> {
  const files = genSharedFiles(content);

  files["src/i18n/translations.ts"] = serializeTranslations(content);

  // globals.css — cream background, warm accent, serif headings
  files["src/app/globals.css"] = `@import "tailwindcss";

@theme {
  --color-background: #fdfbf7;
  --color-foreground: #2c2c2c;
  --color-muted: #7a7a7a;
  --color-border: #e8e4d9;
  --color-card: #f5f1ea;
  --color-accent: #b85c38;
  --font-heading: "Fraunces", Georgia, serif;
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

h1, h2, h3 { font-family: var(--font-heading); }

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
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-heading" });

export const metadata: Metadata = {
  title: "${content.meta?.siteTitle || content.profile.name}",
  description: "${content.meta?.description || ""}",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className={\`\${inter.variable} \${fraunces.variable}\`}>
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

  const allPostTags = Array.from(new Set(t.posts.flatMap(p => p.tags)));

  return (
    <main className="min-h-screen bg-[var(--color-background)]">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[var(--color-background)]/90 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="font-bold text-lg" style={{ fontFamily: "var(--font-heading)" }}>{t.hero.name}</span>
          <div className="flex items-center gap-6 text-sm text-[var(--color-muted)]">
            {t.availableSections.includes("posts") && <a href="#posts" className="hover:text-[var(--color-accent)] transition-colors">{t.nav.posts}</a>}
            <a href="#about" className="hover:text-[var(--color-accent)] transition-colors">About</a>
            <a href="#contact" className="hover:text-[var(--color-accent)] transition-colors">{t.nav.contact}</a>
            <button onClick={toggle} className="px-2 py-1 rounded border border-[var(--color-border)] hover:bg-[var(--color-card)] transition-colors text-xs">{lang === "zh" ? "EN" : "ZH"}</button>
          </div>
        </div>
      </nav>

      {/* Hero — author name, avatar, tagline */}
      <section className="pt-36 pb-16 px-6 section-fade">
        <div className="max-w-4xl mx-auto flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-[var(--color-card)] border border-[var(--color-border)] flex items-center justify-center text-2xl font-bold shrink-0" style={{ fontFamily: "var(--font-heading)", color: "var(--color-accent)" }}>
            {t.hero.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>{t.hero.name}</h1>
            {t.hero.title && <p className="text-base text-[var(--color-muted)] mt-1">{t.hero.title}</p>}
          </div>
        </div>
      </section>

      {/* About */}
      {t.about.text && (
        <section id="about" className="max-w-4xl mx-auto px-6 pb-16 section-fade" style={{ animationDelay: "0.1s" }}>
          <p className="text-base leading-relaxed text-[var(--color-muted)] max-w-2xl">{t.about.text}</p>
        </section>
      )}

      {/* Posts + Sidebar layout */}
      <div className="max-w-4xl mx-auto px-6 pb-20 flex flex-col md:flex-row gap-12 section-fade" style={{ animationDelay: "0.2s" }}>
        {/* Posts — article cards */}
        {t.posts.length > 0 && (
          <section id="posts" className="flex-1">
            <h2 className="text-2xl font-bold mb-8" style={{ fontFamily: "var(--font-heading)" }}>{t.nav.posts}</h2>
            <div className="space-y-6">
              {t.posts.map((post, i) => (
                <article key={i} className="p-6 rounded-xl bg-white border border-[var(--color-border)] hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    {post.publishedAt && <time className="text-xs text-[var(--color-muted)]">{post.publishedAt}</time>}
                    {post.category && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent)] text-white">{post.category}</span>
                    )}
                    {post.readingTime && <span className="text-xs text-[var(--color-muted)]">{post.readingTime}</span>}
                  </div>
                  <h3 className="text-lg font-bold mb-2" style={{ fontFamily: "var(--font-heading)" }}>{post.title}</h3>
                  <p className="text-sm text-[var(--color-muted)] leading-relaxed line-clamp-3">{post.excerpt}</p>
                  {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {post.tags.map((tag, j) => (
                        <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-card)] text-[var(--color-muted)]">{tag}</span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Sidebar */}
        <aside className="w-full md:w-64 shrink-0 space-y-8">
          {/* Newsletter signup */}
          <div className="p-5 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)]">
            <h3 className="font-bold text-sm mb-2" style={{ fontFamily: "var(--font-heading)" }}>Newsletter</h3>
            <p className="text-xs text-[var(--color-muted)] mb-3">{lang === "zh" ? "订阅获取最新文章" : "Subscribe for new posts"}</p>
            <div className="flex gap-2">
              <input type="email" placeholder="Email" className="flex-1 px-3 py-1.5 text-xs rounded border border-[var(--color-border)] bg-white" />
              <button className="px-3 py-1.5 text-xs rounded bg-[var(--color-accent)] text-white font-medium hover:opacity-90 transition-opacity">{lang === "zh" ? "订阅" : "Go"}</button>
            </div>
          </div>

          {/* Tag cloud */}
          {allPostTags.length > 0 && (
            <div className="p-5 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)]">
              <h3 className="font-bold text-sm mb-3" style={{ fontFamily: "var(--font-heading)" }}>Tags</h3>
              <div className="flex flex-wrap gap-2">
                {allPostTags.map((tag, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-full border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors cursor-pointer">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Skills */}
          {t.skills.length > 0 && (
            <div className="p-5 rounded-xl bg-[var(--color-card)] border border-[var(--color-border)]">
              <h3 className="font-bold text-sm mb-3" style={{ fontFamily: "var(--font-heading)" }}>{t.nav.skills}</h3>
              <div className="flex flex-wrap gap-1">
                {t.skills.flatMap(g => g.skills).map((skill, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-white border border-[var(--color-border)] text-[var(--color-muted)]">{skill}</span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Experience */}
      {t.experience.length > 0 && (
        <section id="experience" className="max-w-4xl mx-auto px-6 pb-20 section-fade" style={{ animationDelay: "0.3s" }}>
          <h2 className="text-2xl font-bold mb-8" style={{ fontFamily: "var(--font-heading)" }}>{t.nav.experience}</h2>
          <div className="space-y-4">
            {t.experience.map((exp, i) => (
              <div key={i} className="flex items-start gap-4 py-3 border-b border-[var(--color-border)] last:border-0">
                <span className="text-xs text-[var(--color-muted)] w-24 shrink-0 pt-0.5">{exp.period}</span>
                <div>
                  <h3 className="font-medium text-sm">{exp.title}</h3>
                  {exp.org && <p className="text-xs text-[var(--color-muted)]">{exp.org}</p>}
                  <p className="text-sm text-[var(--color-muted)] mt-1">{exp.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contact */}
      <section id="contact" className="max-w-4xl mx-auto px-6 pb-20 section-fade" style={{ animationDelay: "0.4s" }}>
        <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: "var(--font-heading)" }}>{t.nav.contact}</h2>
        <div className="flex flex-wrap items-center gap-6">
          {t.contact.email && (
            <a href={"mailto:" + t.contact.email} className="text-sm text-[var(--color-accent)] hover:underline">{t.contact.email}</a>
          )}
          {t.contact.links.map((link, i) => (
            <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors">{link.label}</a>
          ))}
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
  id: "blog-writer",
  name: "Writer Blog",
  nameCn: "写作者博客",
  mode: "blog",
  description: "Cream background with warm accents, Fraunces serif headings, article cards, sidebar tag cloud, and newsletter signup.",
  render,
});
