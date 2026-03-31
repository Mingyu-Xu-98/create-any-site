// hero/sidebar-card.ts
// Extracted from genSidebarPage — compact avatar card living inside a sidebar panel.
// Includes theme-specific decorative panel, avatar with glow, name, title, tags,
// section nav links, contact icon, and language toggle.
import type { SectionContext, SectionVariantFn } from "../types";
import type { ThemeStyle } from "../../types";

function sidebarThemePanel(theme: ThemeStyle): string {
  if (theme === "cyberpunk") {
    return `
            <div className="sidebar-theme-panel sidebar-panel-cyberpunk">
              <div className="sidebar-signal" />
              <div className="sidebar-code-line" />
              <div className="sidebar-code-line short" />
              <div className="sidebar-code-line" />
            </div>`;
  }
  if (theme === "nature") {
    return `
            <div className="sidebar-theme-panel sidebar-panel-nature">
              <div className="sidebar-leaf leaf-1" />
              <div className="sidebar-leaf leaf-2" />
              <div className="sidebar-hill" />
            </div>`;
  }
  if (theme === "retro") {
    return `
            <div className="sidebar-theme-panel sidebar-panel-retro">
              <div className="sidebar-retro-stamp">ARCHIVE</div>
            </div>`;
  }
  if (theme === "neo-tokyo") {
    return `
            <div className="sidebar-theme-panel sidebar-panel-tokyo">
              <div className="sidebar-tokyo-grid" />
              <span className="sidebar-tokyo-label">signal://live</span>
            </div>`;
  }
  return `
            <div className="sidebar-theme-panel sidebar-panel-default">
              <div className="sidebar-orbit" />
            </div>`;
}

export const heroSidebarCard: SectionVariantFn = (ctx) => {
  const { data, theme } = ctx;

  return `
        <aside className="sidebar-panel">
          <div className="sidebar-card">
            ${sidebarThemePanel(theme)}
            <div className="relative w-28 h-28 mx-auto mb-5">
              <div className="avatar-glow" />
              <Image src="/images/avatar.png" alt="" width={112} height={112} className="relative z-10 w-full h-full rounded-full object-cover border-3 border-white/60 shadow-lg" unoptimized />
            </div>
            <h1 className="text-xl font-bold text-text mb-1">{lang === "zh" ? "${data.name}" : "${data.nameEn}"}</h1>
            <p className="text-sm text-text-muted mb-5">{lang === "zh" ? "${data.title}" : "${data.titleEn}"}</p>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {t.hero.tags.slice(0, 4).map((tag) => (<span key={tag} className="badge">{tag}</span>))}
            </div>
            <nav className="flex flex-col gap-1 mb-6">
              {t.availableSections.filter(s => s !== "about" && s !== "contact").map((id) => (
                <a key={id} href={\`#\${id}\`} className="sidebar-nav-link">{t.sections[id as keyof typeof t.sections] || id}</a>
              ))}
            </nav>
            <div className="flex justify-center gap-5 mb-5">
              <a href="mailto:${data.email}" className="contact-icon">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </a>
            </div>
            <button onClick={toggle} className="text-xs text-text-muted hover:text-accent border border-line rounded-full px-4 py-1.5 transition-colors">
              {lang === "zh" ? "EN" : "\\u4e2d"}
            </button>
          </div>
        </aside>`;
};
