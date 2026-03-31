// skills/mini-grid.ts
// Extracted from genMinimalistPage — 2-col grid of groups with badges.
import type { SectionVariantFn } from "../types";

export const skillsMiniGrid: SectionVariantFn = (_ctx) => {
  return `
        {/* Skills Section */}
        {t.skills.length > 0 && (
        <section id="skills" className="mb-16">
          <h2 className="section-heading">{t.sections.skills}</h2>
          <p className="mini-section-subtitle">{t.ui.sectionSubtitles.skills}</p>
          <div className="mini-skills-grid">
            {t.skills.map((group) => (
              <div key={group.title} className="mini-skill-card">
                <h3 className="mini-skill-title">{group.title}</h3>
                <div className="mini-skill-tags">
                  {group.skills.map((s) => (<span key={s} className="mini-badge">{s}</span>))}
                </div>
              </div>
            ))}
          </div>
        </section>
        )}`;
};
