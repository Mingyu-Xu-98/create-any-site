"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import { useLocale } from "@/components/LocaleProvider";

interface TemplateItem {
  id: string;
  name: string;
  description: string;
  category: string;
  siteType: string;
  theme: string;
  preview: string; // gradient placeholder
}

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "portfolio", label: "Portfolio" },
  { value: "brand", label: "Brand" },
  { value: "blog", label: "Blog" },
  { value: "landing", label: "Landing" },
  { value: "saas", label: "SaaS" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "event", label: "Event" },
  { value: "docs", label: "Docs" },
];

// Built-in template showcase (from existing themes)
const BUILT_IN_TEMPLATES: TemplateItem[] = [
  {
    id: "cyberpunk", name: "Cyberpunk", description: "Neon glow, particle animations, glassmorphism",
    category: "portfolio", siteType: "portfolio", theme: "cyberpunk",
    preview: "from-purple-600 via-pink-500 to-cyan-500",
  },
  {
    id: "minimalist", name: "Minimalist", description: "Maximum whitespace, sharp typography, clean",
    category: "portfolio", siteType: "portfolio", theme: "minimalist",
    preview: "from-gray-100 to-gray-300",
  },
  {
    id: "ghibli", name: "Ghibli", description: "Watercolor textures, hand-drawn, warm organic",
    category: "portfolio", siteType: "portfolio", theme: "ghibli",
    preview: "from-green-400 via-emerald-300 to-sky-400",
  },
  {
    id: "glassmorphism", name: "Glassmorphism", description: "Frosted glass, blur effects, translucent cards",
    category: "portfolio", siteType: "portfolio", theme: "glassmorphism",
    preview: "from-blue-400 via-violet-400 to-purple-500",
  },
  {
    id: "brutalist", name: "Brutalist", description: "Dark background, monospace, dev-style",
    category: "portfolio", siteType: "portfolio", theme: "brutalist",
    preview: "from-gray-900 via-gray-800 to-gray-700",
  },
  {
    id: "cinematic", name: "Cinematic", description: "Dramatic lighting, widescreen, film grain",
    category: "brand", siteType: "brand", theme: "cinematic",
    preview: "from-amber-700 via-red-900 to-gray-900",
  },
  {
    id: "editorial", name: "Editorial", description: "Magazine typography, elegant serifs, premium",
    category: "blog", siteType: "blog", theme: "editorial",
    preview: "from-stone-200 via-amber-100 to-stone-300",
  },
  {
    id: "bold-creative", name: "Bold Creative", description: "Vivid colors, oversized type, irregular layouts",
    category: "brand", siteType: "brand", theme: "bold-creative",
    preview: "from-yellow-400 via-red-500 to-pink-600",
  },
  {
    id: "nature", name: "Nature", description: "Earth tones, organic shapes, natural textures",
    category: "portfolio", siteType: "portfolio", theme: "nature",
    preview: "from-green-700 via-emerald-600 to-lime-500",
  },
  {
    id: "gradient-mesh", name: "Gradient Mesh", description: "Vivid gradient backgrounds, flowing colors",
    category: "landing", siteType: "landing", theme: "gradient-mesh",
    preview: "from-indigo-500 via-purple-500 to-pink-500",
  },
  {
    id: "neo-tokyo", name: "Neo Tokyo", description: "Japanese urban aesthetic, neon meets tradition",
    category: "portfolio", siteType: "portfolio", theme: "neo-tokyo",
    preview: "from-red-600 via-pink-600 to-violet-700",
  },
  {
    id: "retro", name: "Retro", description: "Film grain, vintage typography, muted palette",
    category: "portfolio", siteType: "portfolio", theme: "retro",
    preview: "from-orange-300 via-yellow-200 to-amber-400",
  },
  {
    id: "tpl-business", name: "Business Pro", description: "Purple glassmorphism, bento grid, typewriter hero",
    category: "brand", siteType: "brand", theme: "tpl-business",
    preview: "from-violet-600 via-purple-700 to-indigo-800",
  },
  {
    id: "tpl-resume-bold", name: "Resume Bold", description: "Pop art colors, thick borders, hard shadows",
    category: "portfolio", siteType: "portfolio", theme: "tpl-resume-bold",
    preview: "from-pink-500 via-cyan-400 to-yellow-300",
  },
  {
    id: "tpl-resume-dark", name: "Resume Dark", description: "Ultra-dark, pill nav, ambient blobs, grain",
    category: "portfolio", siteType: "portfolio", theme: "tpl-resume-dark",
    preview: "from-gray-900 via-slate-800 to-zinc-900",
  },
  {
    id: "tpl-blog", name: "Blog Classic", description: "Warm earthy tones, serif fonts, paper texture",
    category: "blog", siteType: "blog", theme: "tpl-blog",
    preview: "from-amber-200 via-orange-100 to-stone-200",
  },
];

export default function TemplatesPage() {
  const { data: session } = useSession();
  const { t } = useLocale();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = BUILT_IN_TEMPLATES.filter((t) => {
    if (filter !== "all" && t.category !== filter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen relative">
      <div className="wizard-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>
      <Navbar />

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold">{t("templates.title")}</h1>
          <p className="text-white/40 mt-2">Choose a template and start building your site</p>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-8">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("templates.search")}
            className="w-full md:w-64 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50"
          />
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setFilter(c.value)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                  filter === c.value
                    ? "bg-accent text-white"
                    : "bg-white/5 text-white/50 hover:bg-white/10"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((template) => (
            <div
              key={template.id}
              className="group rounded-2xl bg-white/[0.03] border border-white/5 hover:border-accent/20 overflow-hidden transition-all"
            >
              {/* Preview gradient */}
              <div className={`h-40 bg-gradient-to-br ${template.preview} opacity-80 group-hover:opacity-100 transition-opacity`} />

              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">{template.name}</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40">
                    {template.siteType}
                  </span>
                </div>
                <p className="text-xs text-white/30 mb-4">{template.description}</p>
                <div className="flex gap-2">
                  <Link
                    href={session?.user ? `/create?theme=${template.theme}` : "/login"}
                    className="flex-1 text-center px-3 py-2 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-all"
                  >
                    {t("templates.useTemplate")}
                  </Link>
                  <button className="px-3 py-2 rounded-lg bg-white/5 text-xs text-white/50 hover:bg-white/10 transition-all">
                    Preview
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 text-white/30">
            {t("templates.noMatch")}
          </div>
        )}
      </div>
    </div>
  );
}
