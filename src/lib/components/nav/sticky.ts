// nav/sticky.ts
// Extracted from genSingleColumnPage (default nav) — sticky top nav bar with links.
import type { SectionContext, SectionVariantFn } from "../types";

export const navSticky: SectionVariantFn = (ctx) => {
  return `
        {/* Navbar */}
        <nav className="sticky top-0 z-50 bg-bg/80 backdrop-blur-xl border-b border-line">
          <div className="max-w-[1100px] mx-auto px-6 h-16 flex items-center justify-between">
            <span className="font-bold text-lg">{lang === "zh" ? "${ctx.data.name}" : "${ctx.data.nameEn}"}</span>
            <div className="hidden md:flex items-center gap-6">
              {t.availableSections.filter(s => s !== "about" && s !== "contact").map((id) => (
                <a key={id} href={\`#\${id}\`} className="text-sm text-text-muted hover:text-text transition-colors">{t.nav[id as keyof typeof t.nav] || id}</a>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggle} className="text-sm text-text-muted hover:text-text px-3 py-1.5 rounded-full border border-line transition-colors">
                {lang === "zh" ? "EN" : "\\u4e2d"}
              </button>
              </div>
          </div>
        </nav>`;
};
