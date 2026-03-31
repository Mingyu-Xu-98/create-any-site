// nav/mini.ts
// Extracted from genMinimalistPage — mini-nav with dots and theme toggle.
import type { SectionContext, SectionVariantFn } from "../types";

export const navMini: SectionVariantFn = (ctx) => {
  return `
      {/* ===== STICKY NAVIGATION ===== */}
      <nav className="mini-nav">
        <span className="mini-nav-logo">{lang === "zh" ? "${ctx.data.name}" : "${ctx.data.nameEn}"}</span>
        <ul className="mini-nav-links">
          {t.availableSections.filter(s => s !== "contact").map((id) => (
            <li key={id}><a href={\`#\${id === "timeline" ? "experience" : id}\`}>{t.sections[id as keyof typeof t.sections] || id}</a></li>
          ))}
          <li><button onClick={toggle} className="text-xs border border-line rounded-full px-2.5 py-1 hover:border-text transition-colors">{lang === "zh" ? "EN" : "\\u4e2d"}</button></li>
          <li>
            <button onClick={() => setDark(!dark)} className="mini-theme-toggle" aria-label="Toggle theme">
              {dark ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
          </li>
        </ul>
      </nav>`;
};
