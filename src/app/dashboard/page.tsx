"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
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
  isPublic?: number | null;
  publicDesc?: string | null;
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sites.map((site) => (
              <div key={site.id} className="group overflow-hidden rounded-2xl bg-white border border-gray-200 hover:border-accent/30 transition-all shadow-sm hover:shadow-md">
                {site.previewUrl ? (
                  <div className="relative h-36 overflow-hidden bg-gray-50 border-b border-gray-100 cursor-pointer" onClick={() => window.open(site.previewUrl!, "_blank")}>
                    <div className="absolute inset-0 origin-top-left scale-[0.3] w-[334%] h-[334%] pointer-events-none">
                      <iframe src={`${site.previewUrl}${site.previewUrl!.includes("?") ? "&" : "?"}v=${site.lastBuiltAt || site.updatedAt || ""}`} className="w-full h-full border-0" title={site.name} loading="lazy" sandbox="allow-same-origin" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ) : (
                  <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${site.theme === "cyberpunk" ? "#00fff0" : site.theme === "ghibli" ? "#7d9b5f" : site.theme === "glassmorphism" ? "#c89bda" : site.theme === "bold-creative" ? "#ff6b6b" : site.theme === "brutalist" ? "#4493f8" : site.theme === "cinematic" ? "#e94560" : site.theme === "retro" ? "#c0392b" : site.theme === "neo-tokyo" ? "#ff2e63" : "#6366f1"}, ${site.theme === "cyberpunk" ? "#ff00ff" : site.theme === "ghibli" ? "#e8a87c" : site.theme === "glassmorphism" ? "#e8b88a" : site.theme === "bold-creative" ? "#4d96ff" : "#818cf8"})` }} />
                )}
                <div className="p-5">
                  {/* Header: name + status */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <h3
                      className="font-semibold text-base text-gray-900 group-hover:text-accent transition-colors truncate cursor-text min-w-0 flex-1"
                      title={locale === "zh" ? "双击重命名" : "Double-click to rename"}
                      contentEditable={false}
                      suppressContentEditableWarning
                      onDoubleClick={(e) => {
                        const el = e.currentTarget;
                        el.contentEditable = "true";
                        el.focus();
                        const range = document.createRange();
                        range.selectNodeContents(el);
                        window.getSelection()?.removeAllRanges();
                        window.getSelection()?.addRange(range);
                      }}
                      onBlur={async (e) => {
                        const el = e.currentTarget;
                        el.contentEditable = "false";
                        const newName = el.textContent?.trim();
                        if (newName && newName !== site.name) {
                          await fetch(`/api/sites/${site.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName }) });
                          setSites(prev => prev.map(s => s.id === site.id ? { ...s, name: newName } : s));
                        } else {
                          el.textContent = site.name;
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                        if (e.key === "Escape") { e.currentTarget.textContent = site.name; e.currentTarget.blur(); }
                      }}
                    >
                      {site.name}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${statusColors[site.status] || statusColors.draft}`}>
                        {site.status === "published" ? (locale === "zh" ? "已发布" : "Live") : (locale === "zh" ? "草稿" : "Draft")}
                      </span>
                    </div>
                  </div>

                  {/* Meta info */}
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: site.theme === "cyberpunk" ? "#00fff0" : site.theme === "ghibli" ? "#7d9b5f" : site.theme === "glassmorphism" ? "#c89bda" : "#6366f1" }} />
                      {themeLabels[site.theme] || site.theme}
                    </span>
                    <span className="text-gray-300">|</span>
                    <span>{site.siteType}</span>
                    {site.buildStatus === "failed" && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span className="text-red-500 font-medium">{locale === "zh" ? "构建失败" : "Build failed"}</span>
                      </>
                    )}
                  </div>

                  {/* Build error */}
                  {site.buildError && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                      <p className="text-xs text-red-600 line-clamp-2">{site.buildError}</p>
                    </div>
                  )}

                  {/* Timestamp */}
                  <div className="text-xs text-gray-400 mb-4">
                    {site.lastBuiltAt
                      ? `${locale === "zh" ? "最近构建" : "Built"} ${new Date(site.lastBuiltAt).toLocaleDateString()}`
                      : `${locale === "zh" ? "创建于" : "Created"} ${new Date(site.createdAt).toLocaleDateString()}`}
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/edit/${site.id}`}
                      className="px-3 py-1.5 rounded-lg bg-accent text-xs text-white font-medium hover:bg-accent/90 transition-all"
                    >
                      {locale === "zh" ? "编辑" : "Edit"}
                    </Link>
                    {site.previewUrl && (
                      <a href={site.previewUrl} target="_blank" rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-all">
                        {locale === "zh" ? "预览" : "Preview"}
                      </a>
                    )}
                    {site.publishedUrl && (
                      <a href={site.publishedUrl} target="_blank" rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-all">
                        {locale === "zh" ? "访问" : "Visit"}
                      </a>
                    )}
                    {site.status === "published" && site.publishedUrl && (
                      site.isPublic ? (
                        <button
                          onClick={async () => {
                            const msg = locale === "zh" ? "确定要取消公开吗？网站将不再展示在首页。" : "Remove from public showcase?";
                            if (!confirm(msg)) return;
                            await fetch(`/api/sites/${site.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublic: 0, publicDesc: null }) });
                            setSites(prev => prev.map(s => s.id === site.id ? { ...s, isPublic: 0, publicDesc: null } : s));
                          }}
                          className="px-3 py-1.5 rounded-lg border border-green-300 text-green-600 bg-green-50 hover:bg-red-50 hover:border-red-300 hover:text-red-500 text-xs transition-all"
                        >
                          {locale === "zh" ? "已公开" : "Public"}
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            const desc = prompt(locale === "zh" ? "输入一句话描述（展示在首页）：" : "Enter a short description (shown on homepage):") || "";
                            await fetch(`/api/sites/${site.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublic: 1, publicDesc: desc }) });
                            setSites(prev => prev.map(s => s.id === site.id ? { ...s, isPublic: 1, publicDesc: desc } : s));
                          }}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 text-xs transition-all"
                        >
                          {locale === "zh" ? "公开" : "Make Public"}
                        </button>
                      )
                    )}
                    <button
                      onClick={async () => {
                        const msg = locale === "zh" ? `确定要删除「${site.name}」吗？此操作不可撤销。` : `Delete "${site.name}"? This cannot be undone.`;
                        if (!confirm(msg)) return;
                        await fetch(`/api/sites/${site.id}`, { method: "DELETE" });
                        setSites(prev => prev.filter(s => s.id !== site.id));
                      }}
                      className="ml-auto px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50 transition-all"
                    >
                      {locale === "zh" ? "删除" : "Delete"}
                    </button>
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
