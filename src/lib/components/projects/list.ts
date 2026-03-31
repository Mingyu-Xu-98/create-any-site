// projects/list.ts
// Extracted from genBrutalistPage — vertical list layout, no images, org as date column, badge inline.
import type { SectionVariantFn } from "../types";

export const projectsList: SectionVariantFn = () => {
  return `
        {t.projects.length > 0 && (
        <section id="projects" className="mb-12">
          <h2 className="brutal-section-heading">{t.sections.projects}</h2>
          <div className="brutal-project-list">
            {t.projects.map((p) => (
              <div key={p.title} className="brutal-project-item">
                <span className="brutal-project-date">{p.org}</span>
                <div>
                  <span className="brutal-project-title">
                    {p.link ? <a href={p.link} target="_blank">{p.title}</a> : p.title}
                  </span>
                  {p.badge && <span className="ml-2 text-[11px] text-accent">[{p.badge}]</span>}
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}`;
};
