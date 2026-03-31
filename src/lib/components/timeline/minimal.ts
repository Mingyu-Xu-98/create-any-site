// timeline/minimal.ts
// Extracted from genMinimalistPage — clean timeline dots with header/date layout.
import type { SectionVariantFn } from "../types";

export const timelineMinimal: SectionVariantFn = (_ctx) => {
  return `
        {/* Experience / Timeline Section */}
        {t.timeline.length > 0 && (
        <section id="experience" className="mb-16">
          <h2 className="section-heading">{t.sections.timeline}</h2>
          <p className="mini-section-subtitle">{t.ui.sectionSubtitles.timeline}</p>
          <div className="mini-timeline">
            {t.timeline.map((item) => (
              <div key={item.title} className="mini-timeline-card">
                <div className="mini-timeline-header">
                  <h3 className="mini-timeline-title">{item.title}</h3>
                  <span className="mini-timeline-date">{item.date}</span>
                </div>
                <p className="mini-timeline-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
        )}`;
};
