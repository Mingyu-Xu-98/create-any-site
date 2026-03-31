// education/grouped.ts
// Extracted from genBoldResumePage — grouped list with icon + school + degree.
import type { SectionVariantFn } from "../types";

export const educationGrouped: SectionVariantFn = (_ctx) => {
  return `
        {/* Education */}
        {t.education.length > 0 && (
        <section id="education" className="bold-reveal mb-20">
          <div className="bold-section-header">
            <span className="bold-section-number">04</span>
            <h2 className="bold-section-title">{t.sections.education}</h2>
          </div>
          <div className="space-y-6">
            {t.education.map((edu, i) => (
              <div key={i} className="edu-card">
                <div className="edu-icon">{edu.school.slice(0, 2)}</div>
                <div className="edu-info">
                  <h3>{edu.degree}</h3>
                  <div className="edu-school">{edu.school}</div>
                  <div className="edu-detail">{edu.highlights.join(" | ")}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}`;
};
