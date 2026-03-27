"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import { useLocale } from "@/components/LocaleProvider";
import { TEMPLATE_CASES } from "@/lib/template-showcase";

export default function LandingPage() {
  const { data: session } = useSession();
  const { t, locale } = useLocale();
  const featuredTemplates = TEMPLATE_CASES.slice(0, 4);

  const featureCards = [
    {
      icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
      title: t("landing.themes"),
      desc: t("landing.themesDesc"),
      accent: "from-fuchsia-500/20 via-violet-500/10 to-transparent",
    },
    {
      icon: "M13 10V3L4 14h7v7l9-11h-7z",
      title: t("landing.aiPowered"),
      desc: t("landing.aiPoweredDesc"),
      accent: "from-cyan-500/20 via-sky-500/10 to-transparent",
    },
    {
      icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064",
      title: t("landing.hosting"),
      desc: t("landing.hostingDesc"),
      accent: "from-amber-500/20 via-orange-500/10 to-transparent",
    },
  ];

  const siteTypes = [
    { label: "Portfolio", icon: "✦" },
    { label: "Brand Site", icon: "◉" },
    { label: "Blog", icon: "✎" },
    { label: "Landing Page", icon: "▲" },
    { label: "SaaS", icon: "▣" },
    { label: "E-commerce", icon: "◌" },
    { label: "Event Page", icon: "✸" },
    { label: "Docs Site", icon: "☰" },
  ];

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[radial-gradient(circle_at_top,#eef2ff_0%,#f8fafc_45%,#ffffff_100%)]">
      <div className="wizard-bg"><div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" /></div>
      <Navbar />

      <section className="relative z-10 pt-28 pb-20 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full bg-white/75 border border-accent/15 text-xs text-accent font-medium shadow-sm">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              {t("landing.badge")}
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.02] tracking-tight text-gray-900">
              {t("landing.title1")}
              <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent"> {t("landing.titleHighlight")} </span>
              {t("landing.title3")}
            </h1>
            <p className="mt-6 text-lg text-gray-600 max-w-2xl leading-relaxed">{t("landing.desc")}</p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link href={session?.user ? "/create" : "/login"} className="px-8 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-all shadow-lg shadow-accent/20">
                {t("landing.cta")}
              </Link>
              <Link href="/templates" className="px-8 py-3 rounded-xl bg-white/90 border border-gray-200 text-gray-700 hover:text-gray-900 hover:border-gray-300 transition-all shadow-sm">
                {t("landing.browseTemplates")}
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-200/40 via-cyan-100/40 to-transparent blur-3xl" />
            <div className="relative rounded-[28px] border border-white/60 bg-white/80 backdrop-blur-xl shadow-[0_30px_80px_rgba(99,102,241,0.15)] p-5">
              <div className="grid grid-cols-2 gap-4">
                {featuredTemplates.map((template, index) => (
                  <div key={template.id} className={`${index === 0 ? "col-span-2" : ""} rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-medium text-gray-500 uppercase tracking-[0.18em]">{locale === "zh" ? template.categoryCn : template.category}</span>
                      <div className="flex gap-1.5">
                        {template.palette.map((color) => (
                          <span key={color} className="w-2.5 h-2.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: color }} />
                        ))}
                      </div>
                    </div>
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 h-40 bg-white">
                      <div className="absolute inset-0 origin-top-left scale-[0.34] w-[294%] h-[294%] pointer-events-none">
                        <iframe
                          src={template.previewUrl}
                          className="w-full h-full border-0 bg-white"
                          title={`${template.id}-landing-thumb`}
                          loading="lazy"
                        />
                      </div>
                      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent text-white">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/65">{locale === "zh" ? template.clientCn : template.client}</p>
                        <h3 className="mt-1 text-lg font-semibold">{locale === "zh" ? template.nameCn : template.name}</h3>
                        <p className="mt-1 text-xs text-white/80 line-clamp-2">{locale === "zh" ? template.taglineCn : template.tagline}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 py-16 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {featureCards.map((feature) => (
            <div key={feature.title} className="group relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_24px_60px_rgba(79,70,229,0.14)]">
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.accent} opacity-80`} />
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-white/90 shadow-sm flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={feature.icon} /></svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-end justify-between gap-4 mb-10">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">{locale === "zh" ? "精选网站案例" : "Featured Website Cases"}</h2>
              <p className="text-gray-600">{locale === "zh" ? "这里展示的是不同类型的网站示例，不只是配色风格。" : "These are full website examples across categories, not just style swatches."}</p>
            </div>
            <Link href="/templates" className="text-sm text-accent font-medium hover:underline">
              {locale === "zh" ? "查看全部模板" : "View all templates"}
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {featuredTemplates.map((template) => (
              <div key={template.id} className="rounded-3xl border border-gray-200/80 bg-white p-5 shadow-sm">
                <div className="relative rounded-2xl h-56 overflow-hidden border border-gray-200 bg-white">
                  <div className="absolute inset-0 origin-top-left scale-[0.42] w-[238%] h-[238%] pointer-events-none">
                    <iframe
                      src={template.previewUrl}
                      className="w-full h-full border-0 bg-white"
                      title={`${template.id}-featured-thumb`}
                      loading="lazy"
                    />
                  </div>
                  <div className="absolute inset-x-0 top-0 flex justify-between items-start p-4 bg-gradient-to-b from-black/45 to-transparent">
                    <span className="rounded-full bg-white/20 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/80 backdrop-blur-sm">{locale === "zh" ? template.categoryCn : template.category}</span>
                    <div className="flex gap-1.5">
                      {template.palette.map((color) => (
                        <span key={color} className="w-2.5 h-2.5 rounded-full border border-white/60" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/75 via-black/35 to-transparent text-white">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/70">{locale === "zh" ? template.clientCn : template.client}</p>
                    <h3 className="mt-1 text-2xl font-semibold">{locale === "zh" ? template.nameCn : template.name}</h3>
                  </div>
                </div>
                <p className="mt-4 text-[11px] text-accent font-medium">{locale === "zh" ? template.taglineCn : template.tagline}</p>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{locale === "zh" ? template.descriptionCn : template.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(locale === "zh" ? template.featuresCn : template.features).slice(0, 3).map((feature) => (
                    <span key={feature} className="rounded-full bg-gray-100 px-3 py-1 text-[11px] text-gray-600">{feature}</span>
                  ))}
                </div>
                <Link
                  href="/templates"
                  className="mt-5 inline-flex text-sm text-accent font-medium hover:underline"
                >
                  {locale === "zh" ? "查看这个案例" : "View this case"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">{t("landing.siteTypes")}</h2>
          <p className="text-gray-600 mb-12 text-center">{t("landing.siteTypesDesc")}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {siteTypes.map((type) => (
              <div key={type.label} className="rounded-2xl border border-white/70 bg-white/80 px-4 py-5 shadow-sm hover:shadow-md transition-all">
                <div className="text-2xl">{type.icon}</div>
                <div className="mt-4 text-sm font-medium text-gray-800">{type.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-20 px-6">
        <div className="max-w-3xl mx-auto rounded-[32px] border border-white/70 bg-white/80 backdrop-blur-xl p-10 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{t("landing.readyTitle")}</h2>
          <p className="text-gray-600 mb-8">{t("landing.readyDesc")}</p>
          <Link href={session?.user ? "/create" : "/login"} className="inline-block px-8 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-all shadow-lg shadow-accent/20">
            {t("landing.getStarted")}
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-gray-100 py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-gray-400">
          <span>CreateAnySite</span><span>Built with AI</span>
        </div>
      </footer>
    </div>
  );
}
