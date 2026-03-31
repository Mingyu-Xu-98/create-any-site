// skills/parchment.ts
// Extracted from genGhibliPage — 3-col parchment cards.
import type { SectionVariantFn } from "../types";

export const skillsParchment: SectionVariantFn = (_ctx) => {
  return `
        {/* Skills */}
        {t.skills.length > 0 && (
        <section id="skills" className="mb-12">
          <h2 className="section-heading">{t.sections.skills}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {t.skills.map((group) => (
              <div key={group.title} className="parchment-card p-4">
                <h3 className="font-bold text-sm text-text mb-3">{group.title}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {group.skills.map((s) => (<span key={s} className="ghibli-badge">{s}</span>))}
                </div>
              </div>
            ))}
          </div>
        </section>
        )}`;
};
