// skills/chips.ts
// Extracted from genGlassmorphismPage — flat chip grid, no grouping.
import type { SectionVariantFn } from "../types";

export const skillsChips: SectionVariantFn = (_ctx) => {
  return `
          {/* Skills */}
          {t.skills.length > 0 && (
          <section id="skills" style={{ marginBottom: 36 }}>
            <h2 className="gm-section-heading">{t.sections.skills}</h2>
            <div className="gm-skills-grid">
              {t.skills.flatMap((group) => group.skills).map((s) => (
                <div key={s} className="gm-skill-chip">{s}</div>
              ))}
            </div>
          </section>
          )}`;
};
