// projects/glass-minimal.ts
// Extracted from genGlassmorphismPage — minimal glassmorphism card with just name, description, and tech tags.
import type { SectionVariantFn } from "../types";

export const projectsGlassMinimal: SectionVariantFn = () => {
  return `
          {t.projects.length > 0 && (
          <section id="projects" style={{ marginBottom: 36 }}>
            <h2 className="gm-section-heading">{t.sections.projects}</h2>
            <div className="gm-projects-grid">
              {t.projects.map((p, i) => (
                <div key={i} className="gm-project-card">
                  <div className="gm-project-name">{p.title}</div>
                  <div className="gm-project-desc">{p.desc}</div>
                  <div className="gm-project-tech">
                    {p.tags.map((tag) => (<span key={tag}>{tag}</span>))}
                  </div>
                </div>
              ))}
            </div>
          </section>
          )}`;
};
