import { registerTemplate, genSharedFiles, serializeTranslations } from "../template-renderer";
import type { ContentModel } from "../content-model";

function render(content: ContentModel): Record<string, string> {
  const files = genSharedFiles(content);

  files["src/i18n/translations.ts"] = serializeTranslations(content);

  // globals.css — dark elegant, gold accent, cinematic feel
  files["src/app/globals.css"] = `@import "tailwindcss";

@theme {
  --color-background: #1a1a2e;
  --color-foreground: #e8e6e3;
  --color-muted: #8a8a9a;
  --color-border: rgba(255,255,255,0.08);
  --color-card: rgba(255,255,255,0.04);
  --color-gold: #c9a96e;
  --font-heading: "Playfair Display", Georgia, serif;
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

h1, h2, h3 { font-family: var(--font-heading); }

::selection {
  background: var(--color-gold);
  color: #1a1a2e;
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

.gold-line {
  width: 60px;
  height: 2px;
  background: var(--color-gold);
}
`;

  // layout.tsx
  files["src/app/layout.tsx"] = `import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-heading" });

export const metadata: Metadata = {
  title: "${content.meta?.siteTitle || content.profile.name}",
  description: "${content.meta?.description || ""}",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className={\`\${inter.variable} \${playfair.variable}\`}>
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
      <nav className="fixed top-0 inset-x-0 z-50 bg-[var(--color-background)]/90 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="text-sm font-bold text-[var(--color-gold)]" style={{ fontFamily: "var(--font-heading)" }}>{t.hero.name}</span>
          <div className="flex items-center gap-6 text-sm text-[var(--color-muted)]">
            {t.availableSections.includes("posts") && <a href="#posts" className="hover:text-[var(--color-gold)] transition-colors">{t.nav.posts}</a>}
            {t.availableSections.includes("experience") && <a href="#experience" className="hover:text-[var(--color-gold)] transition-colors">{t.nav.experience}</a>}
            <a href="#contact" className="hover:text-[var(--color-gold)] transition-colors">{t.nav.contact}</a>
            <button onClick={toggle} className="px-2 py-1 rounded border border-[var(--color-gold)]/30 text-[var(--color-gold)] hover:bg-[var(--color-gold)]/10 transition-colors text-xs">{lang === "zh" ? "EN" : "ZH"}</button>
          </div>
        </div>
      </nav>

      {/* Hero — large with personal quote */}
      <section className="pt-40 pb-24 px-6 section-fade">
        <div className="max-w-4xl mx-auto text-center">
          <div className="gold-line mx-auto mb-8" />
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight" style={{ fontFamily: "var(--font-heading)" }}>{t.hero.name}</h1>
          {t.hero.title && <p className="text-lg text-[var(--color-gold)] mb-8" style={{ fontFamily: "var(--font-heading)" }}>{t.hero.title}</p>}
          {t.about.text && (
            <blockquote className="max-w-2xl mx-auto text-base text-[var(--color-muted)] leading-relaxed italic border-l-2 border-[var(--color-gold)] pl-6 text-left">
              {t.about.text}
            </blockquote>
          )}
        </div>
      </section>

      {/* Posts — featured stories with large cards */}
      {t.posts.length > 0 && (
        <section id="posts" className="max-w-5xl mx-auto px-6 pb-24 section-fade" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-center gap-4 mb-10">
            <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>{t.nav.posts}</h2>
            <div className="gold-line" />
          </div>
          <div className="space-y-6">
            {t.posts.map((post, i) => (
              <article key={i} className="group rounded-2xl overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-gold)]/30 transition-colors bg-[var(--color-card)]">
                <div className="flex flex-col md:flex-row">
                  {post.image && (
                    <div className="relative w-full md:w-72 h-48 md:h-auto shrink-0">
                      <Image src={post.image} alt={post.title} fill className="object-cover" />
                    </div>
                  )}
                  <div className="p-6 md:p-8 flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      {post.category && <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-gold)]/20 text-[var(--color-gold)] font-medium">{post.category}</span>}
                      {post.publishedAt && <time className="text-xs text-[var(--color-muted)]">{post.publishedAt}</time>}
                      {post.readingTime && <span className="text-xs text-[var(--color-muted)]">{post.readingTime}</span>}
                    </div>
                    <h3 className="text-xl font-bold mb-3 group-hover:text-[var(--color-gold)] transition-colors" style={{ fontFamily: "var(--font-heading)" }}>{post.title}</h3>
                    <p className="text-sm text-[var(--color-muted)] leading-relaxed line-clamp-3">{post.excerpt}</p>
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-4">
                        {post.tags.map((tag, j) => (
                          <span key={j} className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-muted)]">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Experience timeline — founder journey */}
      {t.experience.length > 0 && (
        <section id="experience" className="max-w-5xl mx-auto px-6 pb-24 section-fade" style={{ animationDelay: "0.25s" }}>
          <div className="flex items-center gap-4 mb-10">
            <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>{t.nav.experience}</h2>
            <div className="gold-line" />
          </div>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-[var(--color-gold)]/20" />
            <div className="space-y-8 pl-12">
              {t.experience.map((exp, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[33px] top-1.5 w-2.5 h-2.5 rounded-full bg-[var(--color-gold)] border-2 border-[var(--color-background)]" />
                  <span className="text-xs text-[var(--color-gold)] font-medium">{exp.period}</span>
                  <h3 className="font-bold mt-1" style={{ fontFamily: "var(--font-heading)" }}>{exp.title}</h3>
                  {exp.org && <p className="text-sm text-[var(--color-muted)]">{exp.org}</p>}
                  <p className="text-sm text-[var(--color-muted)] mt-2 leading-relaxed">{exp.desc}</p>
                  {exp.highlights && exp.highlights.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {exp.highlights.map((h, j) => (
                        <li key={j} className="text-sm text-[var(--color-muted)] flex items-start gap-2">
                          <span className="text-[var(--color-gold)] mt-0.5">-</span> {h}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {t.testimonials.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 pb-24 section-fade" style={{ animationDelay: "0.35s" }}>
          <div className="flex items-center gap-4 mb-10">
            <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>{lang === "zh" ? "评价" : "Testimonials"}</h2>
            <div className="gold-line" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {t.testimonials.map((item, i) => (
              <div key={i} className="p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
                <div className="text-3xl text-[var(--color-gold)] mb-3" style={{ fontFamily: "var(--font-heading)" }}>&ldquo;</div>
                <p className="text-sm text-[var(--color-muted)] leading-relaxed italic mb-4">{item.quote}</p>
                <div>
                  <p className="text-sm font-medium">{item.author}</p>
                  {item.role && <p className="text-xs text-[var(--color-muted)]">{item.role}{item.company ? \` @ \${item.company}\` : ""}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Skills */}
      {t.skills.length > 0 && (
        <section id="skills" className="max-w-5xl mx-auto px-6 pb-24 section-fade" style={{ animationDelay: "0.4s" }}>
          <h2 className="text-2xl font-bold mb-8" style={{ fontFamily: "var(--font-heading)" }}>{t.nav.skills}</h2>
          <div className="flex flex-wrap gap-2">
            {t.skills.flatMap(g => g.skills).map((skill, i) => (
              <span key={i} className="px-3 py-1.5 text-xs rounded-full border border-[var(--color-gold)]/30 text-[var(--color-gold)]">{skill}</span>
            ))}
          </div>
        </section>
      )}

      {/* Contact CTA + Newsletter */}
      <section id="contact" className="max-w-5xl mx-auto px-6 pb-24 section-fade" style={{ animationDelay: "0.45s" }}>
        <div className="rounded-2xl border border-[var(--color-gold)]/20 p-12 text-center bg-gradient-to-b from-[var(--color-card)] to-transparent">
          <div className="gold-line mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "var(--font-heading)" }}>{t.nav.contact}</h2>
          <p className="text-sm text-[var(--color-muted)] mb-6 max-w-md mx-auto">{lang === "zh" ? "欢迎联系交流合作" : "Get in touch for collaborations"}</p>
          {t.contact.email && (
            <a href={"mailto:" + t.contact.email}
              className="inline-block px-8 py-3 rounded-full bg-[var(--color-gold)] text-[var(--color-background)] font-medium hover:opacity-90 transition-opacity">
              {t.contact.email}
            </a>
          )}
          {t.contact.links.length > 0 && (
            <div className="flex justify-center gap-4 mt-6">
              {t.contact.links.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-[var(--color-muted)] hover:text-[var(--color-gold)] transition-colors">{link.label}</a>
              ))}
            </div>
          )}
          <div className="mt-10 max-w-sm mx-auto">
            <p className="text-xs text-[var(--color-muted)] mb-3">{lang === "zh" ? "订阅 Newsletter" : "Subscribe to Newsletter"}</p>
            <div className="flex gap-2">
              <input type="email" placeholder="Email" className="flex-1 px-4 py-2 text-sm rounded-full bg-white/5 border border-[var(--color-border)] text-[var(--color-foreground)]" />
              <button className="px-5 py-2 text-sm rounded-full bg-[var(--color-gold)] text-[var(--color-background)] font-medium hover:opacity-90 transition-opacity">{lang === "zh" ? "订阅" : "Subscribe"}</button>
            </div>
          </div>
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
  id: "blog-founder",
  name: "Founder Blog",
  nameCn: "创始人博客",
  mode: "blog",
  description: "Dark elegant theme with gold accents, Playfair Display headings, featured stories, experience timeline, testimonials, and newsletter CTA.",
  render,
});
