// timeline/reveal.ts
// Extracted from genBoldResumePage — scroll reveal animation with exp-cards.
import type { SectionVariantFn } from "../types";

export const timelineReveal: SectionVariantFn = (_ctx) => {
  return `
        {/* Experience */}
        {t.timeline.length > 0 && (
        <section id="experience" className="bold-reveal mb-20">
          <div className="bold-section-header">
            <span className="bold-section-number">01</span>
            <h2 className="bold-section-title">{t.sections.timeline}</h2>
          </div>
          <div className="bold-timeline">
            {t.timeline.map((item, i) => (
              <div key={i} className="exp-card">
                <span className="exp-card-year">{item.date}</span>
                <div className="exp-role">{item.title}</div>
                <p className="exp-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
        )}`;
};
