// projects/magazine.ts
// Extracted from genGridPage (magazine layout) — magazine grid with featured first item (larger image).
import type { SectionVariantFn } from "../types";

export const projectsMagazine: SectionVariantFn = () => {
  return `
        {t.projects.length > 0 && (
        <section id="projects" className="max-w-[1100px] mx-auto px-6 py-16">
          <h2 className="section-heading">{t.sections.projects}</h2>
          <div className="magazine-grid">
            {t.projects.map((p, i) => (
              <div key={i} className={\`card overflow-hidden \${i === 0 ? "magazine-feature" : ""}\`}>
                {p.image && <div className={\`w-full bg-bg-card \${i === 0 ? "h-56" : "h-36"}\`}><Image src={p.image} alt={p.title} width={600} height={300} className="w-full h-full object-cover" unoptimized /></div>}
                <div className="relative z-10 p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-base">{p.title}</h3>
                      <p className="text-xs text-text-muted mt-0.5">{p.org}</p>
                    </div>
                    {"badge" in p && p.badge && (
                      <span className="text-xs bg-green/15 text-green px-2.5 py-0.5 rounded-full font-medium">{p.badge}</span>
                    )}
                  </div>
                  <p className="text-sm text-text-muted mb-3 leading-relaxed">{p.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.tags.map((tag) => (<span key={tag} className="badge text-xs">{tag}</span>))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}`;
};
