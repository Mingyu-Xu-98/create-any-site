// projects/grid.ts
// Extracted from genMinimalistPage — standard 2-col card grid with images, org, link, desc, tags.
import type { SectionVariantFn } from "../types";

export const projectsGrid: SectionVariantFn = () => {
  return `
        {t.projects.length > 0 && (
        <section id="projects" className="mb-16">
          <h2 className="section-heading">{t.sections.projects}</h2>
          <p className="mini-section-subtitle">{t.ui.sectionSubtitles.projects}</p>
          <div className="mini-projects-grid">
            {t.projects.map((p) => (
              <div key={p.title} className="mini-project-card">
                <div className="mini-project-image">
                  <Image src={p.image} alt={p.title} fill className="object-cover" unoptimized />
                </div>
                <div className="mini-project-body">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <h3 className="mini-project-title">{p.title}</h3>
                      <p className="mini-project-org">{p.org}</p>
                    </div>
                    {p.link && <a href={p.link} target="_blank" className="text-xs text-text-muted hover:text-text transition-colors shrink-0">GitHub &rarr;</a>}
                  </div>
                  <p className="mini-project-desc line-clamp-2">{p.desc}</p>
                  <div className="mini-project-tags">
                    {p.tags.slice(0, 4).map((tag) => (<span key={tag} className="mini-project-tag">{tag}</span>))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}`;
};
