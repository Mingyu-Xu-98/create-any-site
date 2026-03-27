"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import { useLocale } from "@/components/LocaleProvider";
import { TEMPLATE_CASES } from "@/lib/template-showcase";

export default function TemplatesPage() {
  const { data: session } = useSession();
  const { t, locale } = useLocale();
  const [previewId, setPreviewId] = useState<string>(TEMPLATE_CASES[0]?.id || "");

  const previewTemplate = TEMPLATE_CASES.find((item) => item.id === previewId) || TEMPLATE_CASES[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-6 pt-24 pb-12">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t("templates.title")}</h1>
            <p className="text-sm text-gray-500 mt-2">
              {locale === "zh" ? "首页看精选，这里浏览全部模板样例，并直接进入构建。" : "Browse the full template gallery here and jump straight into building."}
            </p>
          </div>
          <Link
            href={session?.user ? `/create?template=${previewTemplate?.id || ""}` : "/login"}
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
          >
            {locale === "zh" ? "基于当前模板开始构建" : "Build From This Template"}
          </Link>
        </div>

        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {TEMPLATE_CASES.map((tpl) => {
              const isActive = previewId === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => setPreviewId(tpl.id)}
                  className={`rounded-3xl border cursor-pointer transition-all overflow-hidden ${
                    isActive ? "border-accent/40 bg-accent/5 shadow-lg shadow-accent/10" : "border-gray-200 bg-white hover:-translate-y-0.5 hover:shadow-md"
                  }`}
                >
                  <div className="relative h-44 overflow-hidden border-b border-gray-200 bg-white">
                    <div className="absolute inset-0 origin-top-left scale-[0.34] w-[294%] h-[294%] pointer-events-none">
                      <iframe
                        src={tpl.previewUrl}
                        className="w-full h-full border-0 bg-white"
                        title={`${tpl.id}-thumb`}
                        loading="lazy"
                      />
                    </div>
                    <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 bg-gradient-to-b from-black/45 to-transparent">
                      <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/85 backdrop-blur-sm">{locale === "zh" ? tpl.categoryCn : tpl.category}</span>
                      <div className="flex gap-1.5">
                        {tpl.palette.map((color) => (
                          <span key={color} className="w-2.5 h-2.5 rounded-full border border-white/60" style={{ backgroundColor: color }} />
                        ))}
                      </div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/70 via-black/30 to-transparent text-white">
                      <p className="text-[11px] text-white/70 uppercase tracking-[0.18em]">{locale === "zh" ? tpl.clientCn : tpl.client}</p>
                      <h3 className="mt-1 text-lg font-semibold">{locale === "zh" ? tpl.nameCn : tpl.name}</h3>
                    </div>
                  </div>

                  <div className="p-5">
                    <p className="text-[11px] text-accent font-medium">{locale === "zh" ? tpl.taglineCn : tpl.tagline}</p>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed min-h-[72px]">{locale === "zh" ? tpl.descriptionCn : tpl.description}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(locale === "zh" ? tpl.featuresCn : tpl.features).map((feature) => (
                        <span key={feature} className="rounded-full bg-gray-100 px-3 py-1 text-[11px] text-gray-600">{feature}</span>
                      ))}
                    </div>
                    <div className="mt-5 flex gap-2">
                      <a
                        href={tpl.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        className="flex-1 text-center px-3 py-2 rounded-lg bg-gray-100 text-xs text-gray-700 hover:bg-gray-200 transition-all"
                      >
                        {locale === "zh" ? "新窗口预览" : "Open Preview"}
                      </a>
                      <Link
                        href={session?.user ? `/create?template=${tpl.id}` : "/login"}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 text-center px-3 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-all"
                      >
                        {locale === "zh" ? "使用此模版" : "Use This Template"}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:sticky lg:top-24 overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm min-h-[680px] flex flex-col">
            {previewTemplate ? (
              <>
                <div className="shrink-0 px-4 py-3 border-b border-gray-200 bg-white">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-400/50" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
                      <div className="w-3 h-3 rounded-full bg-green-400/50" />
                    </div>
                    <div className="flex-1 px-3 py-1 rounded-lg bg-gray-100 text-xs text-gray-500 truncate">
                      {locale === "zh" ? `${previewTemplate.clientCn} · ${previewTemplate.nameCn}` : `${previewTemplate.client} · ${previewTemplate.name}`}
                    </div>
                    <Link
                      href={session?.user ? `/create?template=${previewTemplate.id}` : "/login"}
                      className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-all"
                    >
                      {locale === "zh" ? "使用此模版" : "Use This Template"}
                    </Link>
                  </div>
                </div>
                <iframe
                  key={previewTemplate.id}
                  src={previewTemplate.previewUrl}
                  className="flex-1 w-full border-0 bg-white"
                  title="Template Preview"
                />
                <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-gray-400">{locale === "zh" ? previewTemplate.categoryCn : previewTemplate.category}</p>
                      <h3 className="mt-1 text-sm font-semibold text-gray-900">{locale === "zh" ? previewTemplate.clientCn : previewTemplate.client}</h3>
                      <p className="mt-1 text-xs text-gray-500">{locale === "zh" ? previewTemplate.taglineCn : previewTemplate.tagline}</p>
                    </div>
                    <Link
                      href={session?.user ? `/create?template=${previewTemplate.id}` : "/login"}
                      className="px-3 py-2 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-all"
                    >
                      {locale === "zh" ? "使用此模版" : "Use This Template"}
                    </Link>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
