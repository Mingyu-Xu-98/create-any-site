// pricing/comparison.ts — Feature comparison table
import type { SectionVariantFn } from "../types";

export const pricingComparison: SectionVariantFn = (ctx) => {
  return `
        <section id="pricing" className="max-w-[1100px] mx-auto px-6 py-20">
          <h2 className="section-heading">
            {lang === "zh" ? "方案对比" : "Compare Plans"}
          </h2>
          <p className="text-center text-text/60 mb-12 max-w-md mx-auto">
            {lang === "zh" ? "详细了解每个方案包含的功能" : "See exactly what's included in each plan"}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-4 pr-4 font-semibold text-text/80">{lang === "zh" ? "功能" : "Feature"}</th>
                  <th className="py-4 px-4 text-center font-semibold">{lang === "zh" ? "免费版" : "Free"}</th>
                  <th className="py-4 px-4 text-center font-semibold text-accent">{lang === "zh" ? "专业版" : "Pro"}</th>
                  <th className="py-4 pl-4 text-center font-semibold">{lang === "zh" ? "企业版" : "Enterprise"}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: lang === "zh" ? "项目数量" : "Projects", free: "3", pro: lang === "zh" ? "无限" : "Unlimited", ent: lang === "zh" ? "无限" : "Unlimited" },
                  { feature: lang === "zh" ? "存储空间" : "Storage", free: "1 GB", pro: "50 GB", ent: lang === "zh" ? "无限" : "Unlimited" },
                  { feature: lang === "zh" ? "团队成员" : "Team members", free: "1", pro: "5", ent: lang === "zh" ? "无限" : "Unlimited" },
                  { feature: lang === "zh" ? "数据分析" : "Analytics", free: lang === "zh" ? "基础" : "Basic", pro: lang === "zh" ? "高级" : "Advanced", ent: lang === "zh" ? "自定义" : "Custom" },
                  { feature: lang === "zh" ? "API 访问" : "API access", free: "—", pro: "✓", ent: "✓" },
                  { feature: lang === "zh" ? "自定义域名" : "Custom domain", free: "—", pro: "✓", ent: "✓" },
                  { feature: "SSO", free: "—", pro: "—", ent: "✓" },
                  { feature: lang === "zh" ? "SLA 保障" : "SLA", free: "—", pro: "—", ent: "99.9%" },
                  { feature: lang === "zh" ? "支持" : "Support", free: lang === "zh" ? "社区" : "Community", pro: lang === "zh" ? "邮件" : "Email", ent: lang === "zh" ? "专属经理" : "Dedicated" },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-3 pr-4 text-text/70">{row.feature}</td>
                    <td className="py-3 px-4 text-center text-text/60">{row.free}</td>
                    <td className="py-3 px-4 text-center font-medium">{row.pro}</td>
                    <td className="py-3 pl-4 text-center text-text/60">{row.ent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-center gap-4 mt-10">
            <button className="px-6 py-2.5 rounded-lg border border-border font-semibold hover:bg-card/80 transition-colors text-sm">
              {lang === "zh" ? "免费开始" : "Start Free"}
            </button>
            <button className="px-6 py-2.5 rounded-lg bg-accent text-white font-semibold hover:opacity-90 transition-opacity text-sm">
              {lang === "zh" ? "升级专业版" : "Go Pro"}
            </button>
          </div>
        </section>`;
};
