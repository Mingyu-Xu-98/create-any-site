// projects/standard.ts
// Extracted from genSingleColumnPage (default) — standard 2-col grid with image, org, badge, desc, tags.
import type { SectionVariantFn } from "../types";

export const projectsStandard: SectionVariantFn = () => {
  return `
        {t.projects.length > 0 && (
        <section id="projects" className="max-w-[1100px] mx-auto px-6 py-16">
          <h2 className="section-heading">{t.sections.projects}</h2>
          <div className="grid md:grid-cols-2 gap-5">
            {t.projects.map((p, i) => (
              <div key={i} className="card overflow-hidden">
                {p.image && <div className="w-full h-40 bg-bg-card"><Image src={p.image} alt={p.title} width={600} height={300} className="w-full h-full object-cover" unoptimized /></div>}
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
                  <p className="text-sm text-text-muted mb-3 leading-relaxed line-clamp-3">{p.desc}</p>
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
