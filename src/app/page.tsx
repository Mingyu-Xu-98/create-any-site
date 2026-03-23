"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import { useLocale } from "@/components/LocaleProvider";

export default function LandingPage() {
  const { data: session } = useSession();
  const { t } = useLocale();

  return (
    <div className="min-h-screen relative">
      <div className="wizard-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <Navbar />

      {/* Hero */}
      <section className="relative z-10 pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/50">
            {t("landing.badge")}
          </div>
          <h1 className="text-5xl md:text-6xl font-bold leading-tight tracking-tight">
            {t("landing.title1")}<span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">{t("landing.titleHighlight")}</span>
            <br />{t("landing.title3")}
          </h1>
          <p className="mt-6 text-lg text-white/50 max-w-2xl mx-auto leading-relaxed">
            {t("landing.desc")}
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href={session?.user ? "/create" : "/login"}
              className="px-8 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
            >
              {t("landing.cta")}
            </Link>
            <Link
              href="/templates"
              className="px-8 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all"
            >
              {t("landing.browseTemplates")}
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", title: t("landing.themes"), desc: t("landing.themesDesc") },
            { icon: "M13 10V3L4 14h7v7l9-11h-7z", title: t("landing.aiPowered"), desc: t("landing.aiPoweredDesc") },
            { icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064", title: t("landing.hosting"), desc: t("landing.hostingDesc") },
          ].map((f, i) => (
            <div key={i} className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={f.icon} />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Site Types */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">{t("landing.siteTypes")}</h2>
          <p className="text-white/40 mb-12">{t("landing.siteTypesDesc")}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              "Portfolio", "Brand Site", "Blog", "Landing Page",
              "SaaS", "E-commerce", "Event Page", "Docs Site",
            ].map((type) => (
              <div key={type} className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 text-sm text-white/60">
                {type}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">{t("landing.readyTitle")}</h2>
          <p className="text-white/40 mb-8">{t("landing.readyDesc")}</p>
          <Link
            href={session?.user ? "/create" : "/login"}
            className="inline-block px-8 py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
          >
            {t("landing.getStarted")}
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 py-8 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-white/20">
          <span>CreateAnySite</span>
          <span>Built with AI</span>
        </div>
      </footer>
    </div>
  );
}
