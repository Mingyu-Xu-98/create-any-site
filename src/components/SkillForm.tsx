"use client";

import { useState } from "react";

const CATEGORIES = ["design", "content", "layout", "interaction", "seo", "other"];
const SITE_TYPES = ["portfolio", "brand", "blog", "landing", "ecommerce", "saas", "event", "docs"];

interface SkillFormProps {
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
}

export default function SkillForm({ initialData, onSubmit }: SkillFormProps) {
  const [name, setName] = useState((initialData?.name as string) || "");
  const [description, setDescription] = useState((initialData?.description as string) || "");
  const [category, setCategory] = useState((initialData?.category as string) || "design");
  const [content, setContent] = useState((initialData?.content as string) || "");
  const [siteTypes, setSiteTypes] = useState<string[]>((initialData?.siteTypes as string[]) || []);
  const [enabled, setEnabled] = useState(initialData?.enabled !== false);
  const [saving, setSaving] = useState(false);

  const toggleSiteType = (type: string) => {
    setSiteTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSubmit({ name, description, category, content, siteTypes, enabled });
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium mb-2">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50"
          placeholder="e.g., Glassmorphism Design System"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-2">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50"
          placeholder="Brief description of what this skill does"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium mb-2">Category</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                category === c
                  ? "bg-accent text-white"
                  : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}
            >
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Applicable Site Types */}
      <div>
        <label className="block text-sm font-medium mb-2">Applicable Site Types</label>
        <div className="flex flex-wrap gap-2">
          {SITE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleSiteType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                siteTypes.includes(t)
                  ? "bg-accent/20 text-accent border border-accent/30"
                  : "bg-white/5 text-white/40 border border-transparent hover:bg-white/10"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-white/20 mt-1">Leave empty to apply to all site types</p>
      </div>

      {/* Content */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Skill Content <span className="text-white/30 font-normal">(Markdown / Prompt)</span>
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={16}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50 font-mono resize-y"
          placeholder="Enter the skill prompt or instructions in Markdown format..."
        />
      </div>

      {/* Enabled */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className={`w-10 h-6 rounded-full relative transition-colors ${
            enabled ? "bg-accent" : "bg-white/10"
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
              enabled ? "left-5" : "left-1"
            }`}
          />
        </button>
        <span className="text-sm text-white/60">Enabled</span>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3 pt-4">
        <button
          type="submit"
          disabled={saving || !name || !content}
          className="px-6 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-all disabled:opacity-50 shadow-lg shadow-accent/20"
        >
          {saving ? "Saving..." : initialData ? "Update Skill" : "Create Skill"}
        </button>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-6 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-all"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
