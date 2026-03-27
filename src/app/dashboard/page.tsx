"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useLocale } from "@/components/LocaleProvider";

interface SiteItem {
  id: string;
  slug: string;
  name: string;
  siteType: string;
  theme: string;
  status: string;
  buildStatus?: string | null;
  buildError?: string | null;
  previewUrl?: string | null;
  lastBuiltAt?: string | null;
  publishedUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  conversationId?: string | null;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t, locale } = useLocale();
  const [sites, setSites] = useState<SiteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetch("/api/sites")
        .then((r) => r.json())
        .then((data) => {
          setSites(data.sites || []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [session]);

  if (status === "loading") return null;
  if (!session?.user) return null;

  const themeLabels: Record<string, string> = {
    cyberpunk: "Cyberpunk", minimalist: "Minimalist", ghibli: "Ghibli",
    glassmorphism: "Glassmorphism", retro: "Retro", brutalist: "Brutalist",
    cinematic: "Cinematic", "bold-creative": "Bold Creative", editorial: "Editorial",
    nature: "Nature", "gradient-mesh": "Gradient Mesh", "neo-tokyo": "Neo Tokyo",
    "tpl-business": "Business", "tpl-resume-bold": "Resume Bold",
    "tpl-resume-dark": "Resume Dark", "tpl-blog": "Blog", custom: "Custom",
  };

  const statusColors: Record<string, string> = {
    draft: "bg-amber-100 text-amber-800",
    published: "bg-emerald-100 text-emerald-800",
    archived: "bg-gray-200 text-gray-700",
  };

  const buildStatusColors: Record<string, string> = {
    idle: "bg-gray-100 text-gray-600",
    queued: "bg-blue-100 text-blue-700",
    building: "bg-violet-100 text-violet-700",
    ready: "bg-emerald-100 text-emerald-700",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <div className="min-h-screen relative">
      <div className="wizard-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>
      <Navbar />

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
            <p className="text-sm text-text-muted mt-1">
              {sites.length} {t("dashboard.siteCount")}
            </p>
          </div>
          <Link
            href="/create"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t("dashboard.createNew")}
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : sites.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-600">{t("dashboard.noSites")}</h3>
            <p className="text-sm text-gray-500 mt-1">{t("dashboard.noSitesDesc")}</p>
            <Link
              href="/create"
              className="inline-block mt-6 px-6 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-all"
            >
              {t("dashboard.createNew")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sites.map((site) => (
              <div key={site.id} className="group overflow-hidden rounded-3xl bg-white border border-gray-200 hover:border-accent/30 transition-all shadow-sm hover:shadow-lg">
                <div className="h-2 w-full" style={{ background: `linear-gradient(90deg, ${site.theme === "cyberpunk" ? "#00fff0" : site.theme === "ghibli" ? "#7d9b5f" : site.theme === "glassmorphism" ? "#c89bda" : site.theme === "bold-creative" ? "#ff6b6b" : "#111827"}, ${site.theme === "cyberpunk" ? "#ff00ff" : site.theme === "ghibli" ? "#e8a87c" : site.theme === "glassmorphism" ? "#e8b88a" : site.theme === "bold-creative" ? "#4d96ff" : "#6b7280"})` }} />
                <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-medium text-sm group-hover:text-accent transition-colors truncate">
                    {site.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${buildStatusColors[site.buildStatus || "idle"] || buildStatusColors.idle}`}>
                      {site.buildStatus || "idle"}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[site.status] || statusColors.draft}`}>
                      {site.status}
                    </span>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-[0.16em]">
                    <span>{themeLabels[site.theme] || site.theme}</span>
                    <span>{site.siteType}</span>
                  </div>
                  <div className="mt-3 h-24 rounded-2xl border border-white bg-white shadow-inner px-4 py-3">
                    <div className="w-16 h-1.5 rounded-full bg-gray-200" />
                    <div className="mt-3 w-28 h-3 rounded-full bg-gray-900/80" />
                    <div className="mt-2 w-20 h-2 rounded-full bg-gray-300" />
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="h-8 rounded-lg bg-gray-100" />
                      <div className="h-8 rounded-lg bg-gray-100" />
                      <div className="h-8 rounded-lg bg-gray-100" />
                    </div>
                  </div>
                </div>
                {site.buildError && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-[10px] font-medium text-red-700">{locale === "zh" ? "最近一次构建失败" : "Last build failed"}</p>
                    <p className="mt-1 text-[10px] text-red-600 line-clamp-2">{site.buildError}</p>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">
                    {site.lastBuiltAt
                      ? `${locale === "zh" ? "最近构建" : "Built"} · ${new Date(site.lastBuiltAt).toLocaleDateString()}`
                      : new Date(site.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    {site.previewUrl && (
                      <a
                        href={site.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px] hover:bg-gray-200 transition-all"
                      >
                        {locale === "zh" ? "预览站点" : "Preview"}
                      </a>
                    )}
                    {site.publishedUrl && (
                      <a
                        href={site.publishedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px] hover:bg-gray-200 transition-all"
                      >
                        {locale === "zh" ? "访问站点" : "Visit Site"}
                      </a>
                    )}
                    <Link
                      href={site.conversationId ? `/create?siteId=${site.id}` : `/create`}
                      className="px-3 py-1 rounded-lg bg-accent/10 text-accent text-[10px] hover:bg-accent/20 transition-all"
                    >
                      {locale === "zh" ? "继续编辑" : "Continue Editing"}
                    </Link>
                  </div>
                </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
