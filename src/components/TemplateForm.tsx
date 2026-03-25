"use client";

import { useState } from "react";

const SITE_TYPES = ["portfolio", "brand", "blog", "landing", "ecommerce", "saas", "event", "docs", "other"];
const CATEGORIES = ["starter", "professional", "creative", "business", "developer", "other"];

interface Props {
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
}

export default function TemplateForm({ initialData, onSubmit }: Props) {
  const [name, setName] = useState((initialData?.name as string) || "");
  const [description, setDescription] = useState((initialData?.description as string) || "");
  const [category, setCategory] = useState((initialData?.category as string) || "starter");
  const [siteType, setSiteType] = useState((initialData?.siteType as string) || "portfolio");
  const [theme, setTheme] = useState((initialData?.theme as string) || "minimalist");
  const [layout, setLayout] = useState((initialData?.layout as string) || "card-grid");
  const [previewImage, setPreviewImage] = useState((initialData?.previewImage as string) || "");
  const [previewUrl, setPreviewUrl] = useState((initialData?.previewUrl as string) || "");
  const [featured, setFeatured] = useState(!!(initialData?.featured));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSubmit({ name, description, category, siteType, theme, layout, previewImage, previewUrl, featured });
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">Template Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
          className="w-full px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-accent/50"
          placeholder="e.g., Developer Portfolio Pro" />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
          className="w-full px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-accent/50 resize-none"
          placeholder="Describe what this template is best for..." />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Site Type</label>
          <div className="flex flex-wrap gap-1.5">
            {SITE_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setSiteType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${siteType === t ? "bg-accent text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-100"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Category</label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${category === c ? "bg-accent text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-100"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Default Theme</label>
          <input type="text" value={theme} onChange={(e) => setTheme(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-sm text-white focus:outline-none focus:border-accent/50"
            placeholder="minimalist" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Default Layout</label>
          <input type="text" value={layout} onChange={(e) => setLayout(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-sm text-white focus:outline-none focus:border-accent/50"
            placeholder="card-grid" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Preview Image URL</label>
          <input type="text" value={previewImage} onChange={(e) => setPreviewImage(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-accent/50"
            placeholder="https://..." />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Preview URL</label>
          <input type="text" value={previewUrl} onChange={(e) => setPreviewUrl(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-accent/50"
            placeholder="https://..." />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setFeatured(!featured)}
          className={`w-10 h-6 rounded-full relative transition-colors ${featured ? "bg-accent" : "bg-gray-100"}`}>
          <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${featured ? "left-5" : "left-1"}`} />
        </button>
        <span className="text-sm text-gray-600">Featured template</span>
      </div>

      <div className="flex items-center gap-3 pt-4">
        <button type="submit" disabled={saving || !name}
          className="px-6 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-all disabled:opacity-50 shadow-lg shadow-accent/20">
          {saving ? "Saving..." : initialData ? "Update Template" : "Create Template"}
        </button>
        <button type="button" onClick={() => window.history.back()}
          className="px-6 py-2.5 rounded-xl bg-gray-100 text-gray-500 text-sm hover:bg-gray-100 transition-all">
          Cancel
        </button>
      </div>
    </form>
  );
}
