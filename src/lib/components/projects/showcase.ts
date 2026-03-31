// projects/showcase.ts
// Extracted from genBoldResumePage — bold numbered section header, project cards with preview pattern, info, and tags.
import type { SectionVariantFn } from "../types";

export const projectsShowcase: SectionVariantFn = () => {
  return `
        {t.projects.length > 0 && (
        <section id="projects" className="bold-reveal mb-20">
          <div className="bold-section-header">
            <span className="bold-section-number">03</span>
            <h2 className="bold-section-title">{t.sections.projects}</h2>
          </div>
          <div className="bold-projects-grid">
            {t.projects.map((p, i) => (
              <div key={i} className="project-card">
                <div className="project-preview">
                  {p.title.slice(0, 6)}
                  <div className="pattern" />
                </div>
                <div className="project-info">
                  <h3>{p.title}</h3>
                  <p>{p.desc}</p>
                  <div className="exp-tags">
                    {p.tags.map((tag) => (<span key={tag} className="exp-tag">{tag}</span>))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}`;
};
