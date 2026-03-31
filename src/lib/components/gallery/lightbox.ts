// gallery/lightbox.ts — Clickable thumbnails (placeholder, no real lightbox)
import type { SectionVariantFn } from "../types";

export const galleryLightbox: SectionVariantFn = (ctx) => {
  return `
        <section id="gallery" className="max-w-[1100px] mx-auto px-6 py-20">
          <h2 className="section-heading">
            {lang === "zh" ? "作品展示" : "Gallery"}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-12">
            {[
              { label: "Brand Identity", color: "bg-blue-500/10" },
              { label: "Web Design", color: "bg-purple-500/10" },
              { label: "Mobile App", color: "bg-green-500/10" },
              { label: "Illustration", color: "bg-orange-500/10" },
              { label: "Photography", color: "bg-pink-500/10" },
              { label: "3D Render", color: "bg-cyan-500/10" },
              { label: "UI Kit", color: "bg-yellow-500/10" },
              { label: "Motion", color: "bg-red-500/10" },
            ].map((item, i) => (
              <button key={i} className={\`aspect-square rounded-lg \${item.color} border border-border flex flex-col items-center justify-center gap-2 hover:scale-[1.02] transition-transform cursor-pointer\`}>
                <svg className="w-8 h-8 text-text/30" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                </svg>
                <span className="text-xs text-text/50 font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </section>`;
};
