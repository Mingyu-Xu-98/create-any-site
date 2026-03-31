// nav/sidebar.ts
// Extracted from genSidebarPage — fixed left panel with avatar + nav links.
import type { SectionContext, SectionVariantFn } from "../types";

export const navSidebar: SectionVariantFn = (ctx) => {
  return `
        <aside className="sidebar-panel">
          <div className="sidebar-card">
            <div className="relative w-28 h-28 mx-auto mb-5">
              <div className="avatar-glow" />
              <Image src="/images/avatar.png" alt="" width={112} height={112} className="relative z-10 w-full h-full rounded-full object-cover border-3 border-white/60 shadow-lg" unoptimized />
            </div>
            <h1 className="text-xl font-bold text-text mb-1">{lang === "zh" ? "${ctx.data.name}" : "${ctx.data.nameEn}"}</h1>
            <p className="text-sm text-text-muted mb-5">{lang === "zh" ? "${ctx.data.title}" : "${ctx.data.titleEn}"}</p>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {t.hero.tags.slice(0, 4).map((tag) => (<span key={tag} className="badge">{tag}</span>))}
            </div>
            <nav className="flex flex-col gap-1 mb-6">
              {t.availableSections.filter(s => s !== "about" && s !== "contact").map((id) => (
                <a key={id} href={\`#\${id}\`} className="sidebar-nav-link">{t.sections[id as keyof typeof t.sections] || id}</a>
              ))}
            </nav>
            <div className="flex justify-center gap-5 mb-5">
              <a href="mailto:${ctx.data.email}" className="contact-icon">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </a>
            </div>
            <button onClick={toggle} className="text-xs text-text-muted hover:text-accent border border-line rounded-full px-4 py-1.5 transition-colors">
              {lang === "zh" ? "EN" : "\\u4e2d"}
            </button>
          </div>
        </aside>`;
};
