// skills/bars.ts
// Extracted from genBoldResumePage — skill cards with list items (bold resume style).
import type { SectionVariantFn } from "../types";

export const skillsBars: SectionVariantFn = (_ctx) => {
  return `
        {/* Skills */}
        {t.skills.length > 0 && (
        <section id="skills" className="bold-reveal mb-20">
          <div className="bold-section-header">
            <span className="bold-section-number">02</span>
            <h2 className="bold-section-title">{t.sections.skills}</h2>
          </div>
          <div className="bold-skills-grid">
            {t.skills.map((group, i) => (
              <div key={i} className="skill-card">
                <h3>{group.title}</h3>
                <ul className="skill-list">
                  {group.skills.map((s) => (<li key={s}>{s}</li>))}
                </ul>
              </div>
            ))}
          </div>
        </section>
        )}`;
};
