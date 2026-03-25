"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useLocale } from "@/components/LocaleProvider";

interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  siteType: string;
  theme: string;
  layout: string;
  previewImage: string | null;
  featured: number | null;
  createdAt: string | null;
}

export default function TemplatesAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/templates");
    const data = await res.json();
    setTemplates(data.templates || []);
    setLoading(false);
  }, []);

  useEffect(() => { if (session?.user) load(); }, [session, load]);

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/admin/templates/${id}`, { method: "DELETE" });
    load();
  };

  const { locale } = useLocale();
  const zh = locale === "zh";

  if (status === "loading" || !session?.user) return null;

  return (
    <div className="min-h-screen relative">
      <div className="wizard-bg"><div className="orb orb-1" /><div className="orb orb-2" /></div>
      <Navbar />
      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-24 pb-12">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-600 transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {zh ? "返回管理后台" : "Back to Admin"}
        </Link>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{zh ? "网站模板" : "Site Templates"}</h1>
            <p className="text-sm text-text-muted mt-1">{zh ? "管理模板市场的完整网站模板" : "Manage website templates for the marketplace"}</p>
          </div>
          <Link
            href="/admin/templates/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Template
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-48 rounded-2xl bg-gray-100 animate-pulse" />)}
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-600">No templates yet</h3>
            <p className="text-sm text-gray-500 mt-1">Add your first complete website template</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <div key={tpl.id} className="rounded-2xl bg-white border border-gray-200 hover:border-gray-200 overflow-hidden transition-all group">
                {/* Preview */}
                <div className="h-32 bg-gradient-to-br from-violet-500/10 to-cyan-500/10 flex items-center justify-center">
                  {tpl.previewImage ? (
                    <img src={tpl.previewImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl opacity-20">🌐</span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-medium truncate">{tpl.name}</h3>
                    {tpl.featured ? (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Featured</span>
                    ) : null}
                  </div>
                  <p className="text-[10px] text-gray-500 mb-3 line-clamp-2">{tpl.description || "No description"}</p>
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{tpl.siteType}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{tpl.category}</span>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/templates/${tpl.id}`}
                      className="flex-1 text-center px-3 py-1.5 rounded-lg bg-gray-100 text-xs text-gray-500 hover:bg-gray-100 transition-all"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => deleteTemplate(tpl.id)}
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20 transition-all"
                    >
                      Delete
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
