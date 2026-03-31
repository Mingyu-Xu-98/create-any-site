// skills/staggered.ts
// Extracted from genBlogPage — flat list with staggered reveal animation.
import type { SectionVariantFn } from "../types";

export const skillsStaggered: SectionVariantFn = (_ctx) => {
  return `
      {/* Skills */}
      {t.skills.length > 0 && (
      <section className="blog-section-alt" id="skills">
        <div style={{maxWidth: 1120, margin: "0 auto"}}>
          <div className="blog-section-header blog-reveal">
            <div className="blog-section-label">Skills</div>
            <h2 className="blog-section-title">{t.sections.skills}</h2>
            <div className="blog-section-line" />
          </div>
          <div className="blog-skills-wrap">
            {t.skills.flatMap(g => g.skills).map((s, i) => (
              <span key={s} className={\`blog-skill-tag blog-reveal blog-reveal-d\${(i % 4) + 1}\`}>{s}</span>
            ))}
          </div>
        </div>
      </section>
      )}`;
};
