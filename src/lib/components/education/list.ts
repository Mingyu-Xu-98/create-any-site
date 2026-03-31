// education/list.ts
// Extracted from genBrutalistPage — compact list.
import type { SectionVariantFn } from "../types";

export const educationList: SectionVariantFn = (_ctx) => {
  return `
          {t.education.length > 0 && (
          <section id="education">
            <h2 className="brutal-section-heading">{t.sections.education}</h2>
            {t.education.map((edu) => (
              <div key={edu.school} className="brutal-col mb-4">
                <h3>{edu.school}</h3>
                <p className="text-xs text-text-muted mb-1">{edu.degree}</p>
                <ul>
                  {edu.highlights.map((h) => (<li key={h}>{h}</li>))}
                </ul>
              </div>
            ))}
          </section>
          )}`;
};
