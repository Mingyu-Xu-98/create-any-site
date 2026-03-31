// projects/blog-grid.ts
// Extracted from genBlogPage — blog-style project cards with icon letter, name, description, and tech tags.
import type { SectionVariantFn } from "../types";

export const projectsBlogGrid: SectionVariantFn = () => {
  return `
        {t.projects.length > 0 && (
        <section className="blog-section" id="projects">
          <div className="blog-section-header blog-reveal">
            <div className="blog-section-label">Projects</div>
            <h2 className="blog-section-title">{t.sections.projects}</h2>
            <div className="blog-section-line" />
          </div>
          <div className="blog-projects-grid">
            {t.projects.map((p, i) => (
              <div key={i} className={\`blog-project-card blog-reveal blog-reveal-d\${(i % 3) + 1}\`}>
                <div className="blog-project-icon">{p.title.slice(0, 1)}</div>
                <h3 className="blog-project-name">{p.title}</h3>
                <p className="blog-project-desc">{p.desc}</p>
                <div className="blog-project-tech">
                  {p.tags.map((tag) => (<span key={tag}>{tag}</span>))}
                </div>
              </div>
            ))}
          </div>
        </section>
        )}`;
};
