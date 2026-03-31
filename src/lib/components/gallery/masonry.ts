// gallery/masonry.ts — Masonry layout gallery
import type { SectionVariantFn } from "../types";

export const galleryMasonry: SectionVariantFn = (ctx) => {
  return `
        <section id="gallery" className="max-w-[1100px] mx-auto px-6 py-20">
          <h2 className="section-heading">
            {lang === "zh" ? "作品展示" : "Gallery"}
          </h2>
          <div className="columns-2 md:columns-3 gap-4 mt-12 space-y-4">
            {[
              { h: "h-48", label: "Project A" },
              { h: "h-64", label: "Project B" },
              { h: "h-40", label: "Project C" },
              { h: "h-56", label: "Project D" },
              { h: "h-72", label: "Project E" },
              { h: "h-44", label: "Project F" },
              { h: "h-60", label: "Project G" },
              { h: "h-36", label: "Project H" },
            ].map((item, i) => (
              <div key={i} className={\`\${item.h} break-inside-avoid rounded-xl overflow-hidden bg-card border border-border flex items-center justify-center mb-4\`}>
                <span className="text-text/30 text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </section>`;
};
