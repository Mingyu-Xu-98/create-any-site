// cta-section/simple.ts — Centered heading + description + button
import type { SectionVariantFn } from "../types";

export const ctaSimple: SectionVariantFn = (ctx) => {
  return `
        <section id="cta" className="max-w-[800px] mx-auto px-6 py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {lang === "zh" ? "准备好开始了吗？" : "Ready to Get Started?"}
          </h2>
          <p className="text-text/60 text-lg mb-8 max-w-md mx-auto">
            {lang === "zh"
              ? "联系我们，让我们一起将您的想法变为现实。"
              : "Reach out today and let's turn your vision into reality."}
          </p>
          <a
            href="mailto:${ctx.data.email || "hello@example.com"}"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-accent text-white font-semibold hover:opacity-90 transition-opacity"
          >
            {lang === "zh" ? "立即联系" : "Get in Touch"}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
          </a>
        </section>`;
};
