// education/grid.ts
// Extracted from genMinimalistPage — responsive grid with bullet highlights.
import type { SectionVariantFn } from "../types";

export const educationGrid: SectionVariantFn = (_ctx) => {
  return `
        {/* Education Section */}
        {t.education.length > 0 && (
        <section id="education" className="mb-16">
          <h2 className="section-heading">{t.sections.education}</h2>
          <div className="mini-edu-grid">
            {t.education.map((edu) => (
              <div key={edu.school} className="mini-edu-card">
                <h3 className="font-bold text-sm text-text">{edu.school}</h3>
                <p className="text-xs text-text-muted mt-1">{edu.degree}</p>
                <ul className="mt-3 space-y-1.5">
                  {edu.highlights.map((h) => (
                    <li key={h} className="text-xs text-text-muted flex items-start gap-2">
                      <span className="text-text mt-0.5">&#8226;</span>{h}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
        )}`;
};
