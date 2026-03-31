// proof/stats.ts — Big number stats row
import type { SectionVariantFn } from "../types";

export const proofStats: SectionVariantFn = (ctx) => {
  return `
        <section id="stats" className="max-w-[1100px] mx-auto px-6 py-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="space-y-2">
              <p className="text-4xl md:text-5xl font-bold text-accent">500+</p>
              <p className="text-text/60 text-sm">{lang === "zh" ? "服务客户" : "Clients Served"}</p>
            </div>
            <div className="space-y-2">
              <p className="text-4xl md:text-5xl font-bold text-accent">99%</p>
              <p className="text-text/60 text-sm">{lang === "zh" ? "客户满意度" : "Satisfaction Rate"}</p>
            </div>
            <div className="space-y-2">
              <p className="text-4xl md:text-5xl font-bold text-accent">10+</p>
              <p className="text-text/60 text-sm">{lang === "zh" ? "年行业经验" : "Years Experience"}</p>
            </div>
            <div className="space-y-2">
              <p className="text-4xl md:text-5xl font-bold text-accent">50+</p>
              <p className="text-text/60 text-sm">{lang === "zh" ? "获奖项目" : "Awards Won"}</p>
            </div>
          </div>
        </section>`;
};
