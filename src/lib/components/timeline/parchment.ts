// timeline/parchment.ts
// Extracted from genGhibliPage — parchment card variant with timeline dots.
import type { SectionVariantFn } from "../types";

export const timelineParchment: SectionVariantFn = (_ctx) => {
  return `
        {/* Timeline */}
        {t.timeline.length > 0 && (
        <section id="timeline" className="mb-12">
          <h2 className="section-heading">{t.sections.timeline}</h2>
          <div className="relative pl-6">
            <div className="timeline-line" />
            <div className="space-y-5">
              {t.timeline.map((item) => (
                <div key={item.title} className="relative flex gap-4">
                  <div className={\`timeline-dot \${item.active ? "timeline-dot-active" : ""}\`} />
                  <div className="parchment-card flex-1 p-4">
                    <span className="text-xs font-semibold text-accent">{item.date}</span>
                    <h3 className="font-bold text-sm text-text mt-1">{item.title}</h3>
                    <p className="text-xs text-text-muted mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        )}`;
};
