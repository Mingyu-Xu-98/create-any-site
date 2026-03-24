"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import { useLocale } from "@/components/LocaleProvider";

interface TemplateCase {
  id: string;
  name: string;
  nameCn: string;
  description: string;
  descriptionCn: string;
  category: string;
  previewUrl: string;
  features: string[];
  featuresCn: string[];
  style: string;
  styleCn: string;
}

const TEMPLATE_CASES: TemplateCase[] = [
  {
    id: "blog-editorial",
    name: "Editorial Blog",
    nameCn: "编辑风格博客",
    description: "A warm, editorial-style personal blog with serif typography, grain texture, dark mode support, article cards with reading time, skill tags, project showcase, and timeline.",
    descriptionCn: "温暖的编辑风格个人博客，衬线字体搭配纸质纹理，支持暗色模式。包含文章卡片、阅读时间、技能标签、项目展示和时间线。",
    category: "blog",
    previewUrl: "/templates/blog-demo.html",
    features: ["Dark mode", "Article cards", "Skill tags", "Project grid", "Timeline", "Social links", "Responsive"],
    featuresCn: ["暗色模式", "文章卡片", "技能标签", "项目网格", "时间线", "社交链接", "响应式"],
    style: "Editorial / Warm Tones",
    styleCn: "编辑风 / 暖色调",
  },
  {
    id: "resume-cyberpunk",
    name: "Developer Portfolio",
    nameCn: "开发者作品集",
    description: "A dark, modern developer portfolio with gradient glow effects, monospace accents, animated orbs, skill pills, project cards with tech tags, and a vertical timeline.",
    descriptionCn: "暗色系现代开发者作品集，渐变光效背景、等宽字体点缀、动态光球、技能胶囊、带技术标签的项目卡片和垂直时间线。",
    category: "portfolio",
    previewUrl: "/templates/resume-demo.html",
    features: ["Gradient glow", "Animated orbs", "Skill pills", "Project grid", "Timeline", "Responsive"],
    featuresCn: ["渐变光效", "动态光球", "技能胶囊", "项目网格", "时间线", "响应式"],
    style: "Cyberpunk / Dark Tech",
    styleCn: "赛博朋克 / 暗色科技",
  },
];

export default function TemplatesPage() {
  const { data: session } = useSession();
  const { t, locale } = useLocale();
  const [previewId, setPreviewId] = useState<string | null>(null);

  const previewTemplate = TEMPLATE_CASES.find((t) => t.id === previewId);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar />

      <div className="flex-1 flex pt-14 overflow-hidden">
        {/* Left: Template list */}
        <div className="w-[420px] shrink-0 border-r border-white/5 flex flex-col bg-[#0a0a0a]/60 overflow-hidden">
          <div className="shrink-0 px-6 py-5 border-b border-white/5">
            <h1 className="text-xl font-bold">{t("templates.title")}</h1>
            <p className="text-xs text-white/30 mt-1">
              {locale === "zh" ? "选择一个模板案例，创建相似风格的网站" : "Pick a template case to create a similar site"}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {TEMPLATE_CASES.map((tpl) => {
              const isActive = previewId === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => setPreviewId(tpl.id)}
                  className={`rounded-xl border cursor-pointer transition-all ${
                    isActive ? "border-accent/40 bg-accent/5" : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"
                  }`}
                >
                  {/* Mini preview bar */}
                  <div className="h-2 rounded-t-xl bg-gradient-to-r from-accent/30 to-accent/10" />

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold">{locale === "zh" ? tpl.nameCn : tpl.name}</h3>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-white/35">{tpl.category}</span>
                    </div>

                    <p className="text-[11px] text-white/35 leading-relaxed mb-3">
                      {locale === "zh" ? tpl.descriptionCn : tpl.description}
                    </p>

                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[9px] px-2 py-0.5 rounded bg-accent/10 text-accent">
                        {locale === "zh" ? tpl.styleCn : tpl.style}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {(locale === "zh" ? tpl.featuresCn : tpl.features).map((f) => (
                        <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/25">{f}</span>
                      ))}
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={(e) => { e.stopPropagation(); setPreviewId(tpl.id); }}
                        className="flex-1 text-center px-3 py-2 rounded-lg bg-white/5 text-xs text-white/50 hover:bg-white/10 transition-all"
                      >
                        {t("templates.preview")}
                      </button>
                      <Link
                        href={session?.user ? `/create?template=${tpl.id}` : "/login"}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 text-center px-3 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-all"
                      >
                        {locale === "zh" ? "使用此模板" : "Use Template"}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Preview */}
        <div className="flex-1 flex flex-col bg-[#060606] overflow-hidden">
          {previewTemplate ? (
            <>
              <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-white/[0.02] border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
                  <div className="w-3 h-3 rounded-full bg-green-400/50" />
                </div>
                <div className="flex-1 px-3 py-1 rounded-lg bg-white/5 text-xs text-white/30 truncate">
                  {locale === "zh" ? previewTemplate.nameCn : previewTemplate.name}
                </div>
                <a
                  href={previewTemplate.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-lg bg-white/5 text-xs text-white/40 hover:text-white hover:bg-white/10 transition-all"
                >
                  {locale === "zh" ? "新窗口打开" : "Open"} ↗
                </a>
              </div>
              <iframe
                src={previewTemplate.previewUrl}
                className="flex-1 w-full border-0 bg-white"
                title="Template Preview"
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-sm">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
                  </svg>
                </div>
                <p className="text-sm text-white/25">
                  {locale === "zh" ? "点击左侧模板查看预览" : "Click a template to preview"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
