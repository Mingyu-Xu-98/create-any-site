// timeline/vertical.ts
// Extracted from genSingleColumnPage — standard timeline-line + dots.
import type { SectionVariantFn } from "../types";

export const timelineVertical: SectionVariantFn = (_ctx) => {
  return `
        {/* Timeline */}
        {t.timeline.length > 0 && (
        <section id="timeline" className="max-w-[1100px] mx-auto px-6 py-16">
          <h2 className="section-heading">{t.sections.timeline}</h2>
          <div className="max-w-2xl mx-auto relative pl-8">
            <div className="timeline-line" />
            {t.timeline.map((item, i) => (
              <div key={i} className="relative flex gap-6 mb-10 last:mb-0">
                <div className={\`timeline-dot mt-1 \${"active" in item && item.active ? "timeline-dot-active" : ""}\`} />
                <div className="flex-1 pb-2">
                  <span className="text-sm text-accent font-medium">{item.date}</span>
                  <h3 className="text-base font-semibold mt-1">{item.title}</h3>
                  <p className="text-sm text-text-muted mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}`;
};
