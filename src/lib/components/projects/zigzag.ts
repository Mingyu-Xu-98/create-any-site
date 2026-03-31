// projects/zigzag.ts
// Extracted from genSingleColumnPage (z-shape layout) — alternating Z-shape cards with large images and badge panel.
import type { SectionVariantFn } from "../types";

export const projectsZigzag: SectionVariantFn = () => {
  return `
        {t.projects.length > 0 && (
        <section id="projects" className="px-6 py-16">
          <h2 className="section-heading">{t.sections.projects}</h2>
          <div className="space-y-16">
            {t.projects.map((p, i) => (
              <div key={i} className="zigzag-section">
                <div className="zigzag-inner">
                  <div className="card overflow-hidden">
                    {p.image && <div className="w-full h-48 bg-bg-card"><Image src={p.image} alt={p.title} width={600} height={300} className="w-full h-full object-cover" unoptimized /></div>}
                    <div className="p-6">
                      <h3 className="font-semibold text-lg mb-1">{p.title}</h3>
                      <p className="text-xs text-text-muted">{p.org}</p>
                      <p className="text-sm text-text-muted mt-3 leading-relaxed">{p.desc}</p>
                      <div className="flex flex-wrap gap-1.5 mt-4">
                        {p.tags.map((tag) => (<span key={tag} className="badge text-xs">{tag}</span>))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    {"badge" in p && p.badge && (
                      <span className="text-sm bg-green/15 text-green px-4 py-1.5 rounded-full font-medium">{p.badge}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}`;
};
