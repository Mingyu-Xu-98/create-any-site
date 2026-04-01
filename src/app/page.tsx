"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import { useLocale } from "@/components/LocaleProvider";

const HeroAnimation = dynamic(() => import("@/components/HeroAnimation"), { ssr: false });
const FoxMascot = dynamic(() => import("@/components/FoxMascot"), { ssr: false });

interface PublicSite { id: string; name: string; publishedUrl: string; publicDesc: string | null; theme: string; siteType: string; publishedAt: string }

export default function LandingPage() {
  const { data: session } = useSession();
  const { t, locale } = useLocale();
  const [publicSites, setPublicSites] = useState<PublicSite[]>([]);

  useEffect(() => {
    fetch("/api/sites/public?limit=8").then(r => r.ok ? r.json() : { sites: [] }).then(d => setPublicSites(d.sites || [])).catch(() => {});
  }, []);

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
      icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
      title: t("landing.hosting"),
      desc: t("landing.hostingDesc"),
      accent: "from-amber-500/20 via-orange-500/10 to-transparent",
    },
  ];

  const themeColors: Record<string, string> = {
    cyberpunk: "#00fff0", minimalist: "#111827", ghibli: "#7d9b5f", glassmorphism: "#c89bda",
    retro: "#c0392b", brutalist: "#4493f8", cinematic: "#e94560", "bold-creative": "#ff6b6b",
    editorial: "#b8860b", nature: "#2d5016", "gradient-mesh": "#a18cd1", "neo-tokyo": "#ff2e63",
    watercolor: "#9b8ec4", "terminal-green": "#00ff41", vaporwave: "#ff71ce", "craft-paper": "#8b4513",
    aurora: "#00d4aa", "ink-wash": "#2c2c2c",
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[radial-gradient(circle_at_top,#eef2ff_0%,#f8fafc_45%,#ffffff_100%)]">
      <div className="wizard-bg"><div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" /></div>
      <Navbar />

      {/* Hero */}
      <section className="relative z-10 pt-28 pb-16 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_1fr] gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full bg-white/75 border border-accent/15 text-xs text-accent font-medium shadow-sm">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              {t("landing.badge")}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.15] tracking-tight text-gray-900">
              {t("landing.title1")}
              <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 bg-clip-text text-transparent">{t("landing.titleHighlight")}</span>
              <br />{t("landing.title3")}
            </h1>
            <p className="mt-6 text-lg text-gray-600 max-w-xl leading-relaxed">{t("landing.desc")}</p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link href={session?.user ? "/create" : "/login"} className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-accent to-fuchsia-500 text-white font-medium hover:opacity-90 transition-all shadow-lg shadow-accent/25 text-sm">
                {t("landing.cta")}
              </Link>
              <a href="#public-sites" className="px-8 py-3.5 rounded-xl bg-white/90 border border-gray-200 text-gray-700 hover:text-gray-900 hover:border-gray-300 transition-all shadow-sm text-sm">
                {t("landing.browsePublic")}
              </a>
            </div>
          </div>
          <div className="relative">
            <HeroAnimation />
            <div className="absolute -bottom-4 -right-4 scale-50 origin-bottom-right"><FoxMascot /></div>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="relative z-10 py-12 px-6">
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

      {/* Public Sites Showcase */}
      <section id="public-sites" className="relative z-10 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">{t("landing.publicSites")}</h2>
            <p className="text-gray-600">{t("landing.publicSitesDesc")}</p>
          </div>

          {publicSites.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {publicSites.map((site) => (
                <a key={site.id} href={site.publishedUrl} target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:border-accent/30">
                  <div className="relative h-48 overflow-hidden bg-gray-50 border-b border-gray-100">
                    <div className="absolute inset-0 origin-top-left scale-[0.35] w-[286%] h-[286%] pointer-events-none">
                      <iframe src={site.publishedUrl} className="w-full h-full border-0" title={site.name} loading="lazy" sandbox="allow-same-origin" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute top-2 left-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm bg-white/80 text-gray-600 shadow-sm">{site.siteType || "portfolio"}</span>
                    </div>
                    <div className="absolute top-2 right-2 w-3 h-3 rounded-full" style={{ background: themeColors[site.theme] || "#6366f1", boxShadow: `0 0 6px ${themeColors[site.theme] || "#6366f1"}40` }} />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 group-hover:text-accent transition-colors truncate">{site.name}</h3>
                    {site.publicDesc && <p className="mt-1 text-xs text-gray-500 line-clamp-2">{site.publicDesc}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">{new Date(site.publishedAt).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US")}</span>
                      <span className="text-[10px] text-accent font-medium opacity-0 group-hover:opacity-100 transition-opacity">{locale === "zh" ? "访问 →" : "Visit →"}</span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 rounded-2xl border-2 border-dashed border-gray-200">
              <p className="text-4xl mb-4">🦊</p>
              <p className="text-gray-400">{t("landing.noPublicSites")}</p>
              <Link href={session?.user ? "/create" : "/login"} className="mt-4 inline-block text-sm text-accent font-medium hover:underline">
                {t("landing.cta")}
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-3xl mx-auto rounded-2xl bg-gradient-to-br from-accent/5 to-fuchsia-500/5 border border-accent/10 p-10 text-center shadow-md">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{t("landing.readyTitle")}</h2>
          <p className="text-gray-600 mb-8">{t("landing.readyDesc")}</p>
          <Link href={session?.user ? "/create" : "/login"} className="inline-block px-8 py-3.5 rounded-xl bg-gradient-to-r from-accent to-fuchsia-500 text-white font-medium hover:opacity-90 transition-all shadow-lg shadow-accent/25">
            {t("landing.getStarted")}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-200 py-10 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-gray-400">
          <span className="font-medium text-gray-500">CreateAnySite</span>
          <span>{locale === "zh" ? "AI 个人网站生成器" : "AI Personal Site Generator"}</span>
        </div>
      </footer>
    </div>
  );
}
