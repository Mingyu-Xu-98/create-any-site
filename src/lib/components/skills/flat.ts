// skills/flat.ts
// Extracted from genBrutalistPage — flat list, no grouping.
import type { SectionVariantFn } from "../types";

export const skillsFlat: SectionVariantFn = (_ctx) => {
  return `
          {t.skills.length > 0 && (
          <section id="skills">
            <h2 className="brutal-section-heading">{t.sections.skills}</h2>
            {t.skills.map((group) => (
              <div key={group.title} className="brutal-col mb-4">
                <h3>{group.title}</h3>
                <ul>
                  {group.skills.map((s) => (<li key={s}>{s}</li>))}
                </ul>
              </div>
            ))}
          </section>
          )}`;
};
