// education/cards.ts
// Extracted from genSingleColumnPage — 2-col card grid with highlights.
import type { SectionVariantFn } from "../types";

export const educationCards: SectionVariantFn = (_ctx) => {
  return `
        {/* Education */}
        {t.education.length > 0 && (
        <section id="education" className="max-w-[1100px] mx-auto px-6 py-16">
          <h2 className="section-heading">{t.sections.education}</h2>
          <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
            {t.education.map((edu, i) => (
              <div key={i} className="card p-5">
                <div className="relative z-10">
                  <h3 className="font-semibold text-sm">{edu.school}</h3>
                  <p className="text-xs text-text-muted">{edu.degree}</p>
                  <div className="space-y-2 mt-3">
                    {edu.highlights.map((item) => (
                      <div key={item} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                        <span className="text-sm text-text-muted">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}`;
};
