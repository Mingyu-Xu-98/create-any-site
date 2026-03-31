// nav/blog.ts
// Extracted from genBlogPage — scrollable sticky nav with theme toggle.
import type { SectionContext, SectionVariantFn } from "../types";

export const navBlog: SectionVariantFn = (ctx) => {
  return `
      {/* Navigation */}
      <nav className={\`blog-nav\${navScrolled ? " scrolled" : ""}\`}>
        <div className="blog-nav-inner">
          <span className="blog-nav-brand">{lang === "zh" ? "${ctx.data.name}" : "${ctx.data.nameEn || ctx.data.name}"}</span>
          <ul className="blog-nav-links">
            {t.availableSections.filter(s => s !== "contact").map((id) => (
              <li key={id}><a href={\`#\${id === "timeline" ? "experience" : id}\`}>{t.sections[id as keyof typeof t.sections] || id}</a></li>
            ))}
            <li><a href="#contact">{t.nav.contact}</a></li>
            <li><button onClick={toggle}>{lang === "zh" ? "EN" : "\\u4e2d"}</button></li>
            <li>
              <button className="blog-theme-toggle" onClick={() => setDark(!dark)} aria-label="Toggle theme">
                {dark ? "\\u2600" : "\\u263e"}
              </button>
            </li>
          </ul>
        </div>
      </nav>`;
};
