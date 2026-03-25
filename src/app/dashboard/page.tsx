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
    draft: "bg-yellow-500/20 text-yellow-400",
    published: "bg-green-500/20 text-green-400",
    archived: "bg-gray-100 text-gray-400",
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
              <div key={site.id} className="group p-5 rounded-2xl bg-white border border-gray-200 hover:border-accent/30 hover:bg-gray-50 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-medium text-sm group-hover:text-accent transition-colors truncate">
                    {site.name}
                  </h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[site.status] || statusColors.draft}`}>
                    {site.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="px-2 py-0.5 rounded bg-gray-100">{themeLabels[site.theme] || site.theme}</span>
                  <span>{site.siteType}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">{new Date(site.createdAt).toLocaleDateString()}</span>
                  <Link
                    href={site.conversationId ? `/create?siteId=${site.id}` : `/create`}
                    className="px-3 py-1 rounded-lg bg-accent/10 text-accent text-[10px] hover:bg-accent/20 transition-all"
                  >
                    {locale === "zh" ? "继续编辑" : "Continue Editing"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
