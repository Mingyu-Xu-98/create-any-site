// cta-section/split.ts — Left text + right form/button
import type { SectionVariantFn } from "../types";

export const ctaSplit: SectionVariantFn = (ctx) => {
  return `
        <section id="cta" className="max-w-[1100px] mx-auto px-6 py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                {lang === "zh" ? "让我们开始合作" : "Let's Work Together"}
              </h2>
              <p className="text-text/60 leading-relaxed mb-6">
                {lang === "zh"
                  ? "无论您有一个明确的项目需求，还是只是想探讨一个想法，我都很乐意与您交流。请填写表单或直接发邮件给我。"
                  : "Whether you have a specific project in mind or just want to explore an idea, I'd love to hear from you. Fill out the form or send me an email directly."}
              </p>
              <div className="flex items-center gap-2 text-text/40 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                {lang === "zh" ? "通常在 24 小时内回复" : "Usually respond within 24 hours"}
              </div>
            </div>
            <div className="bg-card rounded-2xl p-8 border border-border space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">{lang === "zh" ? "姓名" : "Name"}</label>
                <input type="text" placeholder={lang === "zh" ? "您的姓名" : "Your name"} className="w-full px-4 py-2.5 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/50" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{lang === "zh" ? "邮箱" : "Email"}</label>
                <input type="email" placeholder={lang === "zh" ? "you@example.com" : "you@example.com"} className="w-full px-4 py-2.5 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/50" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{lang === "zh" ? "消息" : "Message"}</label>
                <textarea rows={3} placeholder={lang === "zh" ? "简要描述您的项目..." : "Briefly describe your project..."} className="w-full px-4 py-2.5 rounded-lg bg-bg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none" />
              </div>
              <button className="w-full py-2.5 rounded-lg bg-accent text-white font-semibold hover:opacity-90 transition-opacity">
                {lang === "zh" ? "发送消息" : "Send Message"}
              </button>
            </div>
          </div>
        </section>`;
};
