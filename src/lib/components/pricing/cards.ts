// pricing/cards.ts — 3 pricing tier cards (Free/Pro/Enterprise)
import type { SectionVariantFn } from "../types";

export const pricingCards: SectionVariantFn = (ctx) => {
  return `
        <section id="pricing" className="max-w-[1100px] mx-auto px-6 py-20">
          <h2 className="section-heading">
            {lang === "zh" ? "定价方案" : "Pricing"}
          </h2>
          <p className="text-center text-text/60 mb-12 max-w-md mx-auto">
            {lang === "zh" ? "选择最适合您需求的方案" : "Choose the plan that fits your needs"}
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Free */}
            <div className="bg-card rounded-2xl p-8 border border-border flex flex-col">
              <h3 className="text-lg font-semibold">{lang === "zh" ? "免费版" : "Free"}</h3>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-text/50 text-sm">/{lang === "zh" ? "月" : "mo"}</span>
              </div>
              <ul className="space-y-3 text-sm text-text/70 flex-1">
                <li className="flex items-center gap-2"><span className="text-accent">✓</span> {lang === "zh" ? "最多 3 个项目" : "Up to 3 projects"}</li>
                <li className="flex items-center gap-2"><span className="text-accent">✓</span> {lang === "zh" ? "基础分析" : "Basic analytics"}</li>
                <li className="flex items-center gap-2"><span className="text-accent">✓</span> {lang === "zh" ? "社区支持" : "Community support"}</li>
              </ul>
              <button className="mt-8 w-full py-2.5 rounded-lg border border-border font-semibold hover:bg-card/80 transition-colors">
                {lang === "zh" ? "免费开始" : "Get Started"}
              </button>
            </div>

            {/* Pro */}
            <div className="bg-card rounded-2xl p-8 border-2 border-accent flex flex-col relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-accent text-white text-xs font-semibold rounded-full">
                {lang === "zh" ? "最受欢迎" : "Most Popular"}
              </span>
              <h3 className="text-lg font-semibold">{lang === "zh" ? "专业版" : "Pro"}</h3>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-bold">$29</span>
                <span className="text-text/50 text-sm">/{lang === "zh" ? "月" : "mo"}</span>
              </div>
              <ul className="space-y-3 text-sm text-text/70 flex-1">
                <li className="flex items-center gap-2"><span className="text-accent">✓</span> {lang === "zh" ? "无限项目" : "Unlimited projects"}</li>
                <li className="flex items-center gap-2"><span className="text-accent">✓</span> {lang === "zh" ? "高级分析" : "Advanced analytics"}</li>
                <li className="flex items-center gap-2"><span className="text-accent">✓</span> {lang === "zh" ? "优先支持" : "Priority support"}</li>
                <li className="flex items-center gap-2"><span className="text-accent">✓</span> {lang === "zh" ? "自定义域名" : "Custom domain"}</li>
              </ul>
              <button className="mt-8 w-full py-2.5 rounded-lg bg-accent text-white font-semibold hover:opacity-90 transition-opacity">
                {lang === "zh" ? "升级到专业版" : "Upgrade to Pro"}
              </button>
            </div>

            {/* Enterprise */}
            <div className="bg-card rounded-2xl p-8 border border-border flex flex-col">
              <h3 className="text-lg font-semibold">{lang === "zh" ? "企业版" : "Enterprise"}</h3>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-bold">$99</span>
                <span className="text-text/50 text-sm">/{lang === "zh" ? "月" : "mo"}</span>
              </div>
              <ul className="space-y-3 text-sm text-text/70 flex-1">
                <li className="flex items-center gap-2"><span className="text-accent">✓</span> {lang === "zh" ? "所有专业版功能" : "Everything in Pro"}</li>
                <li className="flex items-center gap-2"><span className="text-accent">✓</span> {lang === "zh" ? "SSO 单点登录" : "SSO authentication"}</li>
                <li className="flex items-center gap-2"><span className="text-accent">✓</span> {lang === "zh" ? "专属客户经理" : "Dedicated account manager"}</li>
                <li className="flex items-center gap-2"><span className="text-accent">✓</span> {lang === "zh" ? "SLA 保障" : "SLA guarantee"}</li>
              </ul>
              <button className="mt-8 w-full py-2.5 rounded-lg border border-border font-semibold hover:bg-card/80 transition-colors">
                {lang === "zh" ? "联系销售" : "Contact Sales"}
              </button>
            </div>
          </div>
        </section>`;
};
