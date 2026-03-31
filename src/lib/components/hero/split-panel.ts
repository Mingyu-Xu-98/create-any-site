// hero/split-panel.ts
// Extracted from genSplitPage — avatar in sticky left panel with nav + social links.
// Full left-panel hero for split layouts: theme decorative panel, avatar with glow,
// name, title, tags, section navigation, social icons, and language toggle.
import type { SectionContext, SectionVariantFn } from "../types";
import type { ThemeStyle } from "../../types";

function splitThemePanel(theme: ThemeStyle): string {
  if (theme === "cinematic") {
    return `
          <div className="split-theme-panel split-panel-cinematic">
            <div className="split-frame-line top" />
            <div className="split-frame-line bottom" />
            <span className="split-scene-label">Scene 01</span>
          </div>`;
  }
  if (theme === "gradient-mesh" || theme === "glassmorphism") {
    return `
          <div className="split-theme-panel split-panel-orbital">
            <div className="split-orb orb-a" />
            <div className="split-orb orb-b" />
            <div className="split-orb orb-c" />
          </div>`;
  }
  if (theme === "cyberpunk" || theme === "neo-tokyo") {
    return `
          <div className="split-theme-panel split-panel-grid">
            <div className="split-grid-scan" />
          </div>`;
  }
  return `
          <div className="split-theme-panel split-panel-default">
            <div className="split-panel-crest" />
          </div>`;
}

export const heroSplitPanel: SectionVariantFn = (ctx) => {
  const { data, theme } = ctx;

  return `
        <div className="split-left">
          <div className="text-center">
            ${splitThemePanel(theme)}
            <div className="relative w-32 h-32 mx-auto mb-6">
              <div className="avatar-glow" />
              <Image src="/images/avatar.png" alt="" width={128} height={128} className="relative z-10 w-full h-full rounded-full object-cover border-2 border-line" unoptimized />
            </div>
            <h1 className="text-3xl font-bold mb-2">{lang === "zh" ? "${data.name}" : "${data.nameEn}"}</h1>
            <p className="text-text-muted mb-6">{lang === "zh" ? "${data.title}" : "${data.titleEn}"}</p>
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {t.hero.tags.map((tag) => (<span key={tag} className="badge">{tag}</span>))}
            </div>
            <nav className="flex flex-col gap-2 mb-8">
              {t.availableSections.filter(s => s !== "about" && s !== "contact").map((id) => (
                <a key={id} href={\`#\${id}\`} className="text-sm text-text-muted hover:text-accent transition-colors">{t.sections[id as keyof typeof t.sections] || id}</a>
              ))}
            </nav>
            <div className="flex justify-center gap-4 mb-6">
              <a href="mailto:${data.email}" className="contact-icon">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </a>
              ${data.github ? `<a href="${data.github}" target="_blank" className="contact-icon">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
              </a>` : ""}
            </div>
            <div className="flex justify-center gap-2">
              <button onClick={toggle} className="text-xs text-text-muted hover:text-accent border border-line rounded-full px-4 py-1.5 transition-colors">
                {lang === "zh" ? "EN" : "\\u4e2d"}
              </button>
            </div>
          </div>
        </div>`;
};
