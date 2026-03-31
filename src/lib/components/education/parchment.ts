// education/parchment.ts
// Extracted from genGhibliPage — parchment cards with bullet highlights.
import type { SectionVariantFn } from "../types";

export const educationParchment: SectionVariantFn = (_ctx) => {
  return `
        {/* Education */}
        {t.education.length > 0 && (
        <section id="education" className="mb-12">
          <h2 className="section-heading">{t.sections.education}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {t.education.map((edu) => (
              <div key={edu.school} className="parchment-card p-5">
                <h3 className="font-bold text-sm text-text">{edu.school}</h3>
                <p className="text-xs text-text-muted mt-1">{edu.degree}</p>
                <ul className="mt-3 space-y-1.5">
                  {edu.highlights.map((h) => (
                    <li key={h} className="text-xs text-text-muted flex items-start gap-2">
                      <span className="text-accent mt-0.5">&#8226;</span>{h}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
        )}`;
};
