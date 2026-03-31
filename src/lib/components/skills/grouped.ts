// skills/grouped.ts
// Extracted from genSingleColumnPage — 2-col grid of skill groups with badges.
import type { SectionVariantFn } from "../types";

export const skillsGrouped: SectionVariantFn = (_ctx) => {
  return `
        {/* Skills */}
        {t.skills.length > 0 && (
        <section id="skills" className="max-w-[1100px] mx-auto px-6 py-16">
          <h2 className="section-heading">{t.sections.skills}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {t.skills.map((group, i) => (
              <div key={i} className="card p-5">
                <div className="relative z-10">
                  <h3 className="font-semibold text-sm mb-3 text-accent">{group.title}</h3>
                  <div className="flex flex-wrap gap-2">
                    {group.skills.map((s) => (<span key={s} className="badge">{s}</span>))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        )}`;
};
