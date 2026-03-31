// nav/hamburger.ts
// Extracted from genSingleColumnPage hidden-nav variant — hamburger menu.
import type { SectionContext, SectionVariantFn } from "../types";

export const navHamburger: SectionVariantFn = (ctx) => {
  return `
        {/* Hidden Nav */}
        <div className="fixed top-4 right-4 z-50">
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="text-sm text-text-muted hover:text-text px-3 py-1.5 rounded-full border border-line bg-bg/80 backdrop-blur-xl transition-colors">
              {lang === "zh" ? "EN" : "\\u4e2d"}
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="hamburger bg-bg/80 backdrop-blur-xl rounded-full border border-line">
              <span /><span /><span />
            </button>
          </div>
        </div>
        <div className={\`mobile-menu \${menuOpen ? "open" : ""}\`}>
          {t.availableSections.filter(s => s !== "about" && s !== "contact").map((id) => (
            <a key={id} href={\`#\${id}\`} onClick={() => setMenuOpen(false)}>{t.sections[id as keyof typeof t.sections] || id}</a>
          ))}
        </div>`;
};
