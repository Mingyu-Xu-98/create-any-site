// faq/grid.ts — 2-column Q&A grid (no expand)
import type { SectionVariantFn } from "../types";

export const faqGrid: SectionVariantFn = (ctx) => {
  return `
        <section id="faq" className="max-w-[1100px] mx-auto px-6 py-20">
          <h2 className="section-heading">
            {lang === "zh" ? "常见问题" : "FAQ"}
          </h2>
          <div className="grid md:grid-cols-2 gap-8 mt-12">
            {[
              {
                q: lang === "zh" ? "你们的服务范围包括哪些？" : "What services do you offer?",
                a: lang === "zh"
                  ? "我们提供网页设计、前端开发、移动端开发和品牌视觉设计等服务。"
                  : "We offer web design, frontend development, mobile development, and brand identity design.",
              },
              {
                q: lang === "zh" ? "你们和远程客户合作吗？" : "Do you work with remote clients?",
                a: lang === "zh"
                  ? "当然！我们的大部分客户都是远程合作的，使用视频会议和项目管理工具保持沟通。"
                  : "Absolutely! Most of our clients work with us remotely. We use video calls and project management tools to stay aligned.",
              },
              {
                q: lang === "zh" ? "项目预算大概是多少？" : "What is the typical budget range?",
                a: lang === "zh"
                  ? "根据项目范围，通常在 5,000 到 50,000 元之间。我们会根据您的需求提供详细报价。"
                  : "Depending on scope, projects typically range from $2,000 to $20,000. We provide a detailed quote after understanding your needs.",
              },
              {
                q: lang === "zh" ? "我可以看看你们之前的作品吗？" : "Can I see examples of your previous work?",
                a: lang === "zh"
                  ? "可以的，请查看我们的作品展示页面，或者联系我们获取更多案例。"
                  : "Of course! Check out our portfolio section above, or reach out for case studies specific to your industry.",
              },
              {
                q: lang === "zh" ? "你们使用什么技术栈？" : "What tech stack do you use?",
                a: lang === "zh"
                  ? "我们主要使用 React/Next.js、TypeScript 和 Tailwind CSS，后端则根据需求选择合适的技术。"
                  : "We primarily work with React/Next.js, TypeScript, and Tailwind CSS. Backend tech is chosen based on project requirements.",
              },
              {
                q: lang === "zh" ? "项目完成后代码归谁所有？" : "Who owns the code after the project?",
                a: lang === "zh"
                  ? "项目交付后，所有代码和设计资产的完整所有权将转移给您。"
                  : "Full ownership of all code and design assets transfers to you upon project completion and final payment.",
              },
            ].map((item, i) => (
              <div key={i} className="space-y-2">
                <h3 className="font-semibold text-sm flex items-start gap-2">
                  <span className="text-accent mt-0.5">Q.</span>
                  {item.q}
                </h3>
                <p className="text-text/60 text-sm leading-relaxed pl-5">{item.a}</p>
              </div>
            ))}
          </div>
        </section>`;
};
