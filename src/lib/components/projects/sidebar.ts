// projects/sidebar.ts
// Extracted from genSidebarPage — compact 2-col grid for sidebar layouts with image, org, badge, desc, tags.
import type { SectionVariantFn } from "../types";

export const projectsSidebar: SectionVariantFn = () => {
  return `
          {t.projects.length > 0 && (
          <section id="projects" className="mb-14">
            <h2 className="section-heading">{t.sections.projects}</h2>
            <div className="grid grid-cols-2 gap-5">
              {t.projects.map((p) => (
                <div key={p.title} className="card overflow-hidden">
                  {p.image && <div className="w-full h-32 bg-bg-card"><Image src={p.image} alt={p.title} width={400} height={200} className="w-full h-full object-cover" unoptimized /></div>}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-1">
                      <div>
                        <h3 className="font-bold text-sm text-text">{p.title}</h3>
                        <p className="text-xs text-text-muted">{p.org}</p>
                      </div>
                      {p.badge && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">{p.badge}</span>}
                    </div>
                    <p className="text-xs text-text-muted mt-2 leading-relaxed line-clamp-3">{p.desc}</p>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {p.tags.map((tag) => (<span key={tag} className="badge text-[11px]">{tag}</span>))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
          )}`;
};
