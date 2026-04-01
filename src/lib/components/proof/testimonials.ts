// proof/testimonials.ts — Client quote cards (3 quotes with name, role, text)
import type { SectionVariantFn } from "../types";

export const proofTestimonials: SectionVariantFn = (ctx) => {
  // Use backtick strings to avoid quote escaping issues in JSX
  return `
        <section id="testimonials" className="max-w-[1100px] mx-auto px-6 py-20">
          <h2 className="section-heading">
            {lang === "zh" ? "客户评价" : "What Our Clients Say"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            {t.testimonials && t.testimonials.length > 0 ? t.testimonials.slice(0, 3).map((item, i) => (
              <div key={i} className="bg-bg-card rounded-2xl p-8 shadow-sm border border-line">
                <div className="flex items-center gap-1 mb-4 text-yellow-400">{"★★★★★"}</div>
                <p className="text-text-muted italic leading-relaxed mb-6">{item.quote}</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">{item.author?.[0] || "?"}</div>
                  <div>
                    <p className="font-semibold text-sm">{item.author}</p>
                    {item.role && <p className="text-xs text-text-muted">{item.role}{item.company ? \`, \${item.company}\` : ""}</p>}
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-text-muted col-span-3 text-center py-8">{lang === "zh" ? "暂无评价" : "No testimonials yet"}</p>
            )}
          </div>
        </section>`;
};
