"use client";

import { useState, useRef } from "react";
import { useLocale } from "@/components/LocaleProvider";

const CATEGORIES = ["design", "content", "layout", "interaction", "seo", "other"];
const SITE_TYPES = ["portfolio", "brand", "blog", "landing", "ecommerce", "saas", "event", "docs"];

interface SkillFormProps {
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
}

export default function SkillForm({ initialData, onSubmit }: SkillFormProps) {
  const { locale } = useLocale();
  const zh = locale === "zh";

  const [name, setName] = useState((initialData?.name as string) || "");
  const [description, setDescription] = useState((initialData?.description as string) || "");
  const [category, setCategory] = useState((initialData?.category as string) || "design");
  const [indexContent, setIndexContent] = useState((initialData?.indexContent as string) || "");
  const [references, setReferences] = useState<{ name: string; content: string }[]>(
    (() => { try { return JSON.parse((initialData?.references as string) || "[]"); } catch { return []; } })()
  );
  const [siteTypes, setSiteTypes] = useState<string[]>(
    (() => { try { return JSON.parse((initialData?.siteTypes as string) || "[]"); } catch { return []; } })()
  );
  const [enabled, setEnabled] = useState(initialData?.enabled !== 0);
  const [saving, setSaving] = useState(false);

  // Upload
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleSiteType = (type: string) => {
    setSiteTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/skills/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Redirect to the created skill's edit page
      window.location.href = `/admin/skills/${data.id}`;
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSubmit({ name, description, category, indexContent, references, siteTypes, enabled });
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Upload skill package */}
      {!initialData && (
        <div className="rounded-xl border-2 border-dashed border-white/10 p-6 text-center hover:border-white/20 transition-all">
          <input ref={fileRef} type="file" accept=".zip,.md" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }} />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <p className="text-xs text-white/40">{zh ? "正在解析技能包..." : "Parsing skill package..."}</p>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-white/5 flex items-center justify-center">
                <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              </div>
              <button type="button" onClick={() => fileRef.current?.click()} className="text-sm text-accent hover:text-accent/80 transition-colors">
                {zh ? "上传技能包（ZIP 或 Markdown）" : "Upload skill package (ZIP or Markdown)"}
              </button>
              <p className="text-[10px] text-white/20 mt-1">
                {zh ? "ZIP 内需包含 index.md（主指令）+ 可选 reference 文件" : "ZIP should contain index.md (main instructions) + optional reference files"}
              </p>
              <div className="mt-3 text-[9px] text-white/10 space-y-0.5">
                <p>{zh ? "📄 index.md / SKILL.md → 技能主指令（Level 1）" : "📄 index.md / SKILL.md → Main instructions (Level 1)"}</p>
                <p>{zh ? "📁 其他文件 → 参考文档（Level 2，按需加载）" : "📁 Other files → Reference docs (Level 2, loaded on demand)"}</p>
              </div>
            </>
          )}
          {uploadError && <p className="text-xs text-red-400 mt-2">{uploadError}</p>}
        </div>
      )}

      {!initialData && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-[10px] text-white/20">{zh ? "或手动填写" : "or fill manually"}</span>
          <div className="flex-1 h-px bg-white/5" />
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-sm font-medium mb-2">{zh ? "名称" : "Name"}</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} required
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50"
          placeholder={zh ? "如：Glassmorphism Design" : "e.g., Glassmorphism Design"} />
      </div>

      {/* Description — Level 0 trigger condition */}
      <div>
        <label className="block text-sm font-medium mb-1">
          {zh ? "触发描述" : "Trigger Description"} <span className="text-white/20 font-normal">(Level 0)</span>
        </label>
        <p className="text-[10px] text-white/20 mb-2">{zh ? "构建 AI 会一次性读完所有技能的触发描述，决定要不要调用。描述什么时候该用，而不是怎么用。" : "Builder AI reads all trigger descriptions at once to decide which skills to activate. Describe WHEN to use, not HOW."}</p>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50"
          placeholder={zh ? "如：当网站需要毛玻璃效果和半透明卡片时激活" : "e.g., Activate when the site needs frosted glass effects and translucent cards"} />
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium mb-2">{zh ? "分类" : "Category"}</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(c => (
            <button key={c} type="button" onClick={() => setCategory(c)}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${category === c ? "bg-accent text-white" : "bg-white/5 text-white/50 hover:bg-white/10"}`}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Applicable Site Types */}
      <div>
        <label className="block text-sm font-medium mb-2">{zh ? "适用站点类型" : "Applicable Site Types"}</label>
        <div className="flex flex-wrap gap-2">
          {SITE_TYPES.map(t => (
            <button key={t} type="button" onClick={() => toggleSiteType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${siteTypes.includes(t) ? "bg-accent/20 text-accent border border-accent/30" : "bg-white/5 text-white/40 border border-transparent hover:bg-white/10"}`}>
              {t}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-white/20 mt-1">{zh ? "留空表示适用于所有类型" : "Leave empty to apply to all types"}</p>
      </div>

      {/* Index Content — Level 1 */}
      <div>
        <label className="block text-sm font-medium mb-1">
          {zh ? "技能指令" : "Skill Instructions"} <span className="text-white/20 font-normal">(Level 1 — index.md)</span>
        </label>
        <p className="text-[10px] text-white/20 mb-2">{zh ? "当技能被激活后，构建 AI 会阅读此内容决定怎么应用" : "When activated, the builder AI reads this to decide HOW to apply the skill"}</p>
        <textarea value={indexContent} onChange={e => setIndexContent(e.target.value)} required rows={16}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50 font-mono resize-y"
          placeholder={zh ? "技能的完整指令..." : "Full skill instructions..."} />
      </div>

      {/* References — Level 2 */}
      {references.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1">
            {zh ? "参考文档" : "Reference Docs"} <span className="text-white/20 font-normal">(Level 2)</span>
          </label>
          <p className="text-[10px] text-white/20 mb-2">{zh ? "深度参考，仅在需要时按需加载" : "Deep references, loaded on demand only"}</p>
          <div className="space-y-2">
            {references.map((ref, i) => (
              <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                <span className="text-xs text-white/30">📄</span>
                <span className="text-xs text-white/50 flex-1 truncate">{ref.name}</span>
                <span className="text-[10px] text-white/20">{ref.content.length} chars</span>
                <button type="button" onClick={() => setReferences(prev => prev.filter((_, j) => j !== i))} className="text-red-400/50 hover:text-red-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enabled */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setEnabled(!enabled)}
          className={`w-10 h-6 rounded-full relative transition-colors ${enabled ? "bg-accent" : "bg-white/10"}`}>
          <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${enabled ? "left-5" : "left-1"}`} />
        </button>
        <span className="text-sm text-white/60">{zh ? "启用" : "Enabled"}</span>
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3 pt-4">
        <button type="submit" disabled={saving || !name || !indexContent}
          className="px-6 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-all disabled:opacity-50 shadow-lg shadow-accent/20">
          {saving ? (zh ? "保存中..." : "Saving...") : initialData ? (zh ? "更新技能" : "Update Skill") : (zh ? "创建技能" : "Create Skill")}
        </button>
        <button type="button" onClick={() => window.history.back()}
          className="px-6 py-2.5 rounded-xl bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-all">
          {zh ? "取消" : "Cancel"}
        </button>
      </div>
    </form>
  );
}
