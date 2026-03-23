"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";

interface SkillItem {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  siteTypes: string;
  templates: string;
  enabled: number;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "design", label: "Design" },
  { value: "content", label: "Content" },
  { value: "layout", label: "Layout" },
  { value: "interaction", label: "Interaction" },
  { value: "seo", label: "SEO" },
  { value: "other", label: "Other" },
];

export default function SkillsAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchSkills = useCallback(async () => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (search) params.set("search", search);
    const res = await fetch(`/api/admin/skills?${params}`);
    const data = await res.json();
    setSkills(data.skills || []);
    setLoading(false);
  }, [category, search]);

  useEffect(() => {
    if (session?.user) fetchSkills();
  }, [session, fetchSkills]);

  const toggleEnabled = async (skill: SkillItem) => {
    await fetch(`/api/admin/skills/${skill.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !skill.enabled }),
    });
    fetchSkills();
  };

  const deleteSkill = async (id: string) => {
    if (!confirm("Delete this skill?")) return;
    await fetch(`/api/admin/skills/${id}`, { method: "DELETE" });
    fetchSkills();
  };

  if (status === "loading") return null;
  if (!session?.user) return null;

  const categoryColors: Record<string, string> = {
    design: "bg-violet-500/20 text-violet-400",
    content: "bg-cyan-500/20 text-cyan-400",
    layout: "bg-amber-500/20 text-amber-400",
    interaction: "bg-pink-500/20 text-pink-400",
    seo: "bg-green-500/20 text-green-400",
    other: "bg-white/10 text-white/50",
  };

  return (
    <div className="min-h-screen relative">
      <div className="wizard-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>
      <Navbar />

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Skill Hub</h1>
            <p className="text-sm text-text-muted mt-1">
              Manage skills that assist website building
            </p>
          </div>
          <Link
            href="/admin/skills/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Skill
          </Link>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search skills..."
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50"
            />
          </div>
          <div className="flex gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                  category === c.value
                    ? "bg-accent text-white"
                    : "bg-white/5 text-white/50 hover:bg-white/10"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Skills list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : skills.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
              <svg className="w-7 h-7 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white/60">No skills yet</h3>
            <p className="text-sm text-white/30 mt-1">Add your first skill to enhance site generation</p>
          </div>
        ) : (
          <div className="space-y-2">
            {skills.map((skill) => {
              const siteTypes = (() => {
                try { return JSON.parse(skill.siteTypes || "[]"); } catch { return []; }
              })();

              return (
                <div
                  key={skill.id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all group"
                >
                  {/* Toggle */}
                  <button
                    onClick={() => toggleEnabled(skill)}
                    className={`w-10 h-6 rounded-full relative transition-colors ${
                      skill.enabled ? "bg-accent" : "bg-white/10"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                        skill.enabled ? "left-5" : "left-1"
                      }`}
                    />
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm truncate">{skill.name}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${categoryColors[skill.category] || categoryColors.other}`}>
                        {skill.category}
                      </span>
                    </div>
                    <p className="text-xs text-white/30 mt-0.5 truncate">{skill.description}</p>
                    {siteTypes.length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {siteTypes.map((t: string) => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      href={`/admin/skills/${skill.id}`}
                      className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/50 hover:bg-white/10 hover:text-white transition-all"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => deleteSkill(skill.id)}
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
