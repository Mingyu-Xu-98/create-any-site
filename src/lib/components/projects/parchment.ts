// projects/parchment.ts
// Extracted from genGhibliPage — parchment cards with polaroid-style image, badge, and ghibli-badge tags.
import type { SectionVariantFn } from "../types";

export const projectsParchment: SectionVariantFn = () => {
  return `
        {t.projects.length > 0 && (
        <section id="projects" className="mb-12">
          <h2 className="section-heading">{t.sections.projects}</h2>
          <div className="ghibli-projects-grid">
            {t.projects.map((p) => (
              <div key={p.title} className="parchment-card">
                <div className="relative h-36 overflow-hidden">
                  <Image src={p.image} alt={p.title} fill className="object-cover" unoptimized />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h3 className="font-bold text-sm text-text">{p.title}</h3>
                      <p className="text-xs text-text-muted">{p.org}</p>
                    </div>
                    {p.badge && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">{p.badge}</span>}
                    {p.link && <a href={p.link} target="_blank" className="text-xs text-accent hover:underline">GitHub &rarr;</a>}
                  </div>
                  <p className="text-xs text-text-muted mt-2 leading-relaxed line-clamp-2">{p.desc}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.tags.slice(0, 3).map((tag) => (<span key={tag} className="ghibli-badge text-[11px]">{tag}</span>))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}`;
};
