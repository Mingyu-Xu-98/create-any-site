// nav/bold.ts
// Extracted from genBoldResumePage — rounded nav with CTA.
import type { SectionContext, SectionVariantFn } from "../types";

export const navBold: SectionVariantFn = (ctx) => {
  return `
      {/* Navigation */}
      <nav className="bold-nav">
        <div className="logo">{lang === "zh" ? "${ctx.data.name}" : "${ctx.data.nameEn || ctx.data.name}"}</div>
        <ul className="nav-links">
          {t.availableSections.filter(s => s !== "about").map((id) => (
            <li key={id}><a href={\`#\${id === "timeline" ? "experience" : id}\`}>{t.nav[id as keyof typeof t.nav] || id}</a></li>
          ))}
          <li><button onClick={toggle}>{lang === "zh" ? "EN" : "\\u4e2d"}</button></li>
        </ul>
      </nav>`;
};
