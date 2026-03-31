// timeline/compact.ts
// Extracted from genBrutalistPage — date left, content right, minimal.
import type { SectionVariantFn } from "../types";

export const timelineCompact: SectionVariantFn = (_ctx) => {
  return `
        {/* Timeline */}
        {t.timeline.length > 0 && (
        <section id="timeline" className="mb-12">
          <h2 className="brutal-section-heading">{t.sections.timeline}</h2>
          <div>
            {t.timeline.map((item) => (
              <div key={item.title} className="brutal-timeline-item">
                <span className="brutal-timeline-date">{item.date}</span>
                <div className="brutal-timeline-text">
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}`;
};
