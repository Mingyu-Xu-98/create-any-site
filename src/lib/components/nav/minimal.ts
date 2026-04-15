// nav/minimal.ts
// Extracted from genBrutalistPage — simple top bar.
import type { SectionContext, SectionVariantFn } from "../types";

export const navMinimal: SectionVariantFn = (ctx) => {
  return `
      {/* ===== TOP NAVIGATION ===== */}
      <nav className="brutal-topnav">
        <div className="brutal-topnav-inner">
          <a href="#" className="brutal-logo">{lang === "zh" ? "${ctx.data.name}" : "${ctx.data.nameEn}"}</a>
          <div className="brutal-nav-links">
            {t.availableSections.filter(s => s !== "contact").map((id) => (
              <a key={id} href={\`#\${id}\`} className="brutal-nav-link">{t.nav[id as keyof typeof t.nav] || id}</a>
            ))}
          </div>
        </div>
      </nav>`;
};
