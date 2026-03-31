// timeline/blog.ts
// Extracted from genBlogPage — period/date + role/title with staggered reveal.
import type { SectionVariantFn } from "../types";

export const timelineBlog: SectionVariantFn = (_ctx) => {
  return `
      {/* Experience */}
      {t.timeline.length > 0 && (
      <section className="blog-section-alt" id="experience">
        <div style={{maxWidth: 1120, margin: "0 auto"}}>
          <div className="blog-section-header blog-reveal">
            <div className="blog-section-label">Experience</div>
            <h2 className="blog-section-title">{t.sections.timeline}</h2>
            <div className="blog-section-line" />
          </div>
          <div className="blog-timeline">
            {t.timeline.map((item, i) => (
              <div key={i} className={\`blog-timeline-item blog-reveal blog-reveal-d\${(i % 3) + 1}\`}>
                <div className="blog-timeline-period">{item.date}</div>
                <div className="blog-timeline-role">{item.title}</div>
                <div className="blog-timeline-desc">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}`;
};
