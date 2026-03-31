// cta-section/banner.ts — Full-width colored banner with CTA
import type { SectionVariantFn } from "../types";

export const ctaBanner: SectionVariantFn = (ctx) => {
  return `
        <section id="cta" className="mx-6 my-12 rounded-2xl bg-accent text-white px-8 py-16 md:py-20">
          <div className="max-w-[800px] mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {lang === "zh" ? "有项目想法？让我们聊聊" : "Have a Project in Mind? Let's Talk"}
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-lg mx-auto">
              {lang === "zh"
                ? "我们帮助企业和个人打造出色的数字产品。"
                : "We help businesses and individuals build outstanding digital products."}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:${ctx.data.email || "hello@example.com"}"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-white text-accent font-semibold hover:bg-white/90 transition-colors"
              >
                {lang === "zh" ? "免费咨询" : "Book a Free Call"}
              </a>
              <a
                href="${ctx.data.github || "#"}"
                target="_blank"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full border-2 border-white/40 text-white font-semibold hover:bg-white/10 transition-colors"
              >
                {lang === "zh" ? "查看作品" : "View Portfolio"}
              </a>
            </div>
          </div>
        </section>`;
};
