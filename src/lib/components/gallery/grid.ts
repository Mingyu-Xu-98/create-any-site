// gallery/grid.ts — Simple image grid (2-3 columns)
import type { SectionVariantFn } from "../types";

export const galleryGrid: SectionVariantFn = (ctx) => {
  return `
        <section id="gallery" className="max-w-[1100px] mx-auto px-6 py-20">
          <h2 className="section-heading">
            {lang === "zh" ? "作品展示" : "Gallery"}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-12">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-[4/3] rounded-xl overflow-hidden bg-card border border-border">
                <div className="w-full h-full flex items-center justify-center text-text/20">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </section>`;
};
