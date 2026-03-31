// education/blog.ts
// Extracted from genBlogPage — icon + school + degree + highlights with reveal animation.
import type { SectionVariantFn } from "../types";

export const educationBlog: SectionVariantFn = (_ctx) => {
  return `
      {/* Education */}
      {t.education.length > 0 && (
      <section className="blog-section" id="education">
        <div className="blog-section-header blog-reveal">
          <div className="blog-section-label">Education</div>
          <h2 className="blog-section-title">{t.sections.education}</h2>
          <div className="blog-section-line" />
        </div>
        <div>
          {t.education.map((edu, i) => (
            <div key={i} className={\`blog-edu-card blog-reveal blog-reveal-d\${(i % 3) + 1}\`}>
              <div className="blog-edu-icon">{edu.school.slice(0, 2)}</div>
              <div className="blog-edu-info">
                <h3>{edu.degree}</h3>
                <div className="blog-edu-school">{edu.school}</div>
                <div className="blog-edu-detail">{edu.highlights.join(" | ")}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}`;
};
