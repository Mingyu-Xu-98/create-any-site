"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import { useLocale } from "@/components/LocaleProvider";
import { TEMPLATE_CASES } from "@/lib/template-showcase";

const HeroAnimation = dynamic(() => import("@/components/HeroAnimation"), { ssr: false });

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
    { label: locale === "zh" ? "个人作品集" : "Portfolio", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
    { label: locale === "zh" ? "品牌官网" : "Brand Site", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
    { label: locale === "zh" ? "博客" : "Blog", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
    { label: locale === "zh" ? "落地页" : "Landing Page", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> },
    { label: "SaaS", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg> },
    { label: locale === "zh" ? "电商" : "E-commerce", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" /></svg> },
    { label: locale === "zh" ? "活动页" : "Event Page", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
    { label: locale === "zh" ? "文档站" : "Docs Site", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
  ];

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[radial-gradient(circle_at_top,#eef2ff_0%,#f8fafc_45%,#ffffff_100%)]">
      <div className="wizard-bg"><div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" /></div>
      <Navbar />

      <section className="relative z-10 pt-28 pb-20 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_1fr] gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full bg-white/75 border border-accent/15 text-xs text-accent font-medium shadow-sm">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              {t("landing.badge")}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.15] tracking-tight text-gray-900">
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
            <HeroAnimation />
          </div>
        </div>
      </section>

      <section className="relative z-10 py-16 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {featureCards.map((feature) => (
            <div key={feature.title} className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-accent/20">
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
              <div key={template.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-all">
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
              <div key={type.label} className="rounded-xl border border-gray-200 bg-white px-5 py-5 shadow-sm hover:shadow-md hover:border-accent/20 transition-all group">
                <div className="text-accent">{type.icon}</div>
                <div className="mt-3 text-sm font-medium text-gray-800 group-hover:text-accent transition-colors">{type.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-20 px-6">
        <div className="max-w-3xl mx-auto rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-md">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{t("landing.readyTitle")}</h2>
          <p className="text-gray-600 mb-8">{t("landing.readyDesc")}</p>
          <Link href={session?.user ? "/create" : "/login"} className="inline-block px-8 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-all shadow-lg shadow-accent/20">
            {t("landing.getStarted")}
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-gray-200 py-10 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-gray-400">
          <span className="font-medium text-gray-500">CreateAnySite</span>
          <span>{locale === "zh" ? "AI 驱动的网站构建平台" : "AI-Powered Website Builder"}</span>
        </div>
      </footer>
    </div>
  );
}
