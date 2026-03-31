// faq/accordion.ts — Expandable Q&A items using details/summary
import type { SectionVariantFn } from "../types";

export const faqAccordion: SectionVariantFn = (ctx) => {
  return `
        <section id="faq" className="max-w-[800px] mx-auto px-6 py-20">
          <h2 className="section-heading">
            {lang === "zh" ? "常见问题" : "Frequently Asked Questions"}
          </h2>
          <div className="mt-12 space-y-3">
            {[
              {
                q: lang === "zh" ? "你们的项目流程是怎样的？" : "What does your project process look like?",
                a: lang === "zh"
                  ? "我们的流程包括需求调研、设计原型、开发迭代和交付上线四个阶段。每个阶段都会与您保持密切沟通。"
                  : "Our process includes discovery, design prototyping, iterative development, and launch. We keep you in the loop at every stage.",
              },
              {
                q: lang === "zh" ? "项目通常需要多长时间？" : "How long does a typical project take?",
                a: lang === "zh"
                  ? "根据项目复杂度，一般在 2-8 周之间。我们会在需求确认后给出准确的时间估算。"
                  : "Depending on complexity, most projects take 2-8 weeks. We provide an accurate timeline after the initial discovery phase.",
              },
              {
                q: lang === "zh" ? "你们提供售后支持吗？" : "Do you offer post-launch support?",
                a: lang === "zh"
                  ? "是的，我们提供项目交付后 30 天的免费维护期，之后可以选择按月付费的持续支持计划。"
                  : "Yes, we include 30 days of free maintenance after launch. After that, we offer monthly support plans to keep everything running smoothly.",
              },
              {
                q: lang === "zh" ? "如何开始一个新项目？" : "How do I get started?",
                a: lang === "zh"
                  ? "只需通过联系表单或邮件告诉我们您的想法，我们会在 24 小时内安排一次免费咨询电话。"
                  : "Simply reach out via our contact form or email. We'll schedule a free consultation call within 24 hours to discuss your vision.",
              },
              {
                q: lang === "zh" ? "你们接受什么付款方式？" : "What payment methods do you accept?",
                a: lang === "zh"
                  ? "我们支持银行转账、支付宝和微信支付。项目通常按里程碑分阶段付款。"
                  : "We accept bank transfer, credit card, and PayPal. Projects are typically billed in milestone-based installments.",
              },
            ].map((item, i) => (
              <details key={i} className="group bg-card rounded-xl border border-border overflow-hidden">
                <summary className="flex items-center justify-between cursor-pointer px-6 py-4 font-medium hover:bg-card/80 transition-colors list-none">
                  <span>{item.q}</span>
                  <svg className="w-5 h-5 text-text/40 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                </summary>
                <div className="px-6 pb-4 text-text/60 text-sm leading-relaxed">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </section>`;
};
