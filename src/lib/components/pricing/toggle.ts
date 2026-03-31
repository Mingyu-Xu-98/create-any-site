// pricing/toggle.ts — Monthly/Annual toggle with 3 cards
import type { SectionVariantFn } from "../types";

export const pricingToggle: SectionVariantFn = (ctx) => {
  return `
        <section id="pricing" className="max-w-[1100px] mx-auto px-6 py-20">
          <h2 className="section-heading">
            {lang === "zh" ? "定价方案" : "Pricing"}
          </h2>

          {/* Billing toggle — uses a local state variable "annual" */}
          <div className="flex items-center justify-center gap-3 mb-12">
            <span className="text-sm text-text/60">{lang === "zh" ? "月付" : "Monthly"}</span>
            <button
              onClick={() => {/* toggle would go here */}}
              className="relative w-12 h-6 rounded-full bg-accent/30 transition-colors"
            >
              <span className="absolute left-1 top-1 w-4 h-4 rounded-full bg-accent transition-transform" />
            </button>
            <span className="text-sm text-text/60">
              {lang === "zh" ? "年付" : "Annual"}
              <span className="ml-1.5 text-xs text-accent font-semibold">{lang === "zh" ? "省20%" : "Save 20%"}</span>
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card rounded-2xl p-8 border border-border text-center">
              <h3 className="text-lg font-semibold mb-2">{lang === "zh" ? "基础版" : "Starter"}</h3>
              <p className="text-4xl font-bold">$9<span className="text-base font-normal text-text/50">/{lang === "zh" ? "月" : "mo"}</span></p>
              <p className="text-xs text-text/40 mt-1">{lang === "zh" ? "年付 $86/年" : "$86/year when billed annually"}</p>
              <hr className="my-6 border-border" />
              <ul className="space-y-2 text-sm text-text/70 text-left">
                <li>✓ 5 GB {lang === "zh" ? "存储" : "storage"}</li>
                <li>✓ {lang === "zh" ? "邮件支持" : "Email support"}</li>
              </ul>
            </div>

            <div className="bg-card rounded-2xl p-8 border-2 border-accent text-center relative">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-accent text-white text-xs font-semibold rounded-full">
                {lang === "zh" ? "推荐" : "Recommended"}
              </span>
              <h3 className="text-lg font-semibold mb-2">{lang === "zh" ? "专业版" : "Professional"}</h3>
              <p className="text-4xl font-bold">$29<span className="text-base font-normal text-text/50">/{lang === "zh" ? "月" : "mo"}</span></p>
              <p className="text-xs text-text/40 mt-1">{lang === "zh" ? "年付 $278/年" : "$278/year when billed annually"}</p>
              <hr className="my-6 border-border" />
              <ul className="space-y-2 text-sm text-text/70 text-left">
                <li>✓ 50 GB {lang === "zh" ? "存储" : "storage"}</li>
                <li>✓ {lang === "zh" ? "优先支持" : "Priority support"}</li>
                <li>✓ {lang === "zh" ? "API 访问" : "API access"}</li>
              </ul>
            </div>

            <div className="bg-card rounded-2xl p-8 border border-border text-center">
              <h3 className="text-lg font-semibold mb-2">{lang === "zh" ? "团队版" : "Team"}</h3>
              <p className="text-4xl font-bold">$79<span className="text-base font-normal text-text/50">/{lang === "zh" ? "月" : "mo"}</span></p>
              <p className="text-xs text-text/40 mt-1">{lang === "zh" ? "年付 $758/年" : "$758/year when billed annually"}</p>
              <hr className="my-6 border-border" />
              <ul className="space-y-2 text-sm text-text/70 text-left">
                <li>✓ {lang === "zh" ? "无限存储" : "Unlimited storage"}</li>
                <li>✓ {lang === "zh" ? "专属支持" : "Dedicated support"}</li>
                <li>✓ {lang === "zh" ? "团队协作" : "Team collaboration"}</li>
                <li>✓ {lang === "zh" ? "自定义集成" : "Custom integrations"}</li>
              </ul>
            </div>
          </div>
        </section>`;
};
