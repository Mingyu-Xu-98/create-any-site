"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useLocale } from "@/components/LocaleProvider";
import type { KnowledgeItem, KnowledgeCategory, SourceType } from "@/lib/knowledge";
import { CATEGORY_META, SOURCE_TYPE_META } from "@/lib/knowledge";

interface KGGroup {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  sourceFile: string | null;
  sourceType: string | null;
  indexMd: string | null;
  itemCount: number;
  selectedCount: number;
  categoryCounts: Record<string, number>;
}

interface UploadingFile {
  id: string;
  name: string;
  type: string;
  status: "uploading" | "extracting" | "done" | "error";
  progress: string;
  itemCount?: number;
  error?: string;
}

const ACCEPTED_TYPES = ".pdf,.docx,.doc,.txt,.md,.zip,.png,.jpg,.jpeg,.gif,.webp,.svg";

export default function KnowledgePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { locale } = useLocale();
  const zh = locale === "zh";

  // Knowledge Bases (new system)
  const [bases, setBases] = useState<Array<{ id: string; name: string; description: string; fileCount: number; totalChars: number; updatedAt: string }>>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBaseName, setNewBaseName] = useState("");

  // Legacy state
  const [groups, setGroups] = useState<KGGroup[]>([]);
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<"list">("list");
  const [search, setSearch] = useState("");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [groupItems, setGroupItems] = useState<KnowledgeItem[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlType, setUrlType] = useState<"git" | "bilibili" | "youtube">("git");

  // Auth guard
  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Load data
  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge-groups");
      if (res.ok) { const d = await res.json(); setGroups(d.groups || []); }
    } catch {}
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge");
      if (res.ok) { const d = await res.json(); setItems(d.items || []); }
    } catch {}
    setLoaded(true);
  }, []);

  const loadBases = useCallback(async () => {
    try {
      const res = await fetch("/api/kb");
      if (res.ok) { const d = await res.json(); setBases(d.bases || []); }
    } catch {}
  }, []);

  const createBase = async () => {
    if (!newBaseName.trim()) return;
    const res = await fetch("/api/kb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newBaseName.trim() }),
    });
    if (res.ok) {
      const d = await res.json();
      setNewBaseName("");
      setShowCreateModal(false);
      router.push(`/knowledge/${d.id}`);
    }
  };

  useEffect(() => {
    if (session?.user) { loadBases(); loadGroups(); loadItems(); }
  }, [session, loadBases, loadGroups, loadItems]);

  // Stats
  const selectedCount = items.filter(i => i.selected).length;
  const totalCount = items.length;

  // Load tasks from server (persisted, survives page navigation)
  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/ingestion");
      if (res.ok) {
        const d = await res.json();
        const tasks = (d.tasks || []) as Array<{ id: string; fileName: string; fileType: string; status: string; progress: string; itemCount: number | null; error: string | null }>;
        setUploadingFiles(tasks.map(t => ({
          id: t.id,
          name: t.fileName,
          type: t.fileType,
          status: t.status === "done" ? "done" : t.status === "error" ? "error" : t.status === "processing" ? "extracting" : "uploading",
          progress: t.progress || "",
          itemCount: t.itemCount || undefined,
          error: t.error || undefined,
        })));
      }
    } catch {}
  }, []);

  // Track whether there are active tasks
  const hasActiveTasks = uploadingFiles.some(f => f.status === "uploading" || f.status === "extracting");

  // Load tasks on mount (restores in-progress tasks after page navigation)
  useEffect(() => {
    if (session?.user) loadTasks();
  }, [session, loadTasks]);

  // Poll while tasks are active
  useEffect(() => {
    if (!hasActiveTasks || !session?.user) return;
    const interval = setInterval(async () => {
      await loadTasks();
      await loadGroups();
      await loadItems();
    }, 2000);
    return () => clearInterval(interval);
  }, [hasActiveTasks, loadTasks, loadGroups, loadItems]);

  // Upload handler — submits to server, doesn't block
  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", file.name.split(".").pop()?.toLowerCase() || "txt");

    try {
      const res = await fetch("/api/ingestion", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Submit failed");
      const { taskId } = await res.json();
      // Immediately add to local state
      setUploadingFiles(prev => [...prev, {
        id: taskId,
        name: file.name,
        type: file.name.split(".").pop()?.toLowerCase() || "txt",
        status: "extracting",
        progress: zh ? "AI 正在提取知识..." : "AI extracting...",
      }]);
    } catch (err) {
      setUploadingFiles(prev => [...prev, {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.name.split(".").pop()?.toLowerCase() || "txt",
        status: "error",
        progress: zh ? "提交失败" : "Submit failed",
        error: err instanceof Error ? err.message : "Failed",
      }]);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(uploadFile);
  };

  const uploadUrl = async (url: string, type: string) => {
    if (!url.trim()) return;
    try {
      const res = await fetch("/api/ingestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, type }),
      });
      if (!res.ok) throw new Error("Submit failed");
      const { taskId } = await res.json();
      setUploadingFiles(prev => [...prev, {
        id: taskId,
        name: url,
        type,
        status: "extracting",
        progress: zh ? "AI 提取中..." : "Extracting...",
      }]);
    } catch {
      setUploadingFiles(prev => [...prev, {
        id: crypto.randomUUID(),
        name: url,
        type,
        status: "error",
        progress: zh ? "提交失败" : "Submit failed",
      }]);
    }
  };

  // Toggle selection
  const toggleAll = async () => {
    const allSel = items.every(i => i.selected);
    const newVal = !allSel;
    setItems(prev => prev.map(i => ({ ...i, selected: newVal })));
    await fetch("/api/knowledge", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selected: newVal }) });
    await loadGroups();
  };

  // Expand group
  const openGroup = async (groupId: string) => {
    setExpandedGroup(groupId);
    try {
      const res = await fetch(`/api/knowledge-groups/${groupId}`);
      if (res.ok) { const d = await res.json(); setGroupItems(d.items || []); }
    } catch {}
  };

  // Delete group
  const deleteGroup = async (groupId: string) => {
    if (!confirm(zh ? "确认删除该知识组及所有条目？" : "Delete this group and all items?")) return;
    await fetch(`/api/knowledge-groups/${groupId}`, { method: "DELETE" });
    await loadGroups();
    await loadItems();
    if (expandedGroup === groupId) setExpandedGroup(null);
  };

  if (status === "loading" || !session?.user) {
    return <div className="min-h-screen bg-bg"><Navbar /><div className="pt-20 flex justify-center"><div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div></div>;
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <Navbar />
      <div className="pt-14">
        <div className="max-w-6xl mx-auto px-6 py-8">

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{zh ? "知识库" : "Knowledge Base"}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {zh ? `${bases.length} 个知识库 · ${groups.length} 个旧知识组` : `${bases.length} bases · ${groups.length} legacy groups`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-all shadow-sm shadow-accent/20">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {zh ? "新建知识库" : "New Knowledge Base"}
              </button>
              <input type="text" placeholder={zh ? "搜索..." : "Search..."} value={search} onChange={e => setSearch(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:border-accent/50 w-48" />
                  <button onClick={toggleAll} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-500 hover:bg-gray-50 transition-all">
                    {items.every(i => i.selected) ? (zh ? "全部取消" : "Deselect all") : (zh ? "全部选择" : "Select all")}
                  </button>
            </div>
          </div>

          {/* ===== Knowledge Bases (new system) ===== */}
          {bases.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">{zh ? "知识库" : "Knowledge Bases"}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bases.map(b => (
                  <div key={b.id} onClick={() => router.push(`/knowledge/${b.id}`)} className="rounded-xl border border-gray-200 bg-white p-5 cursor-pointer hover:border-accent/20 hover:shadow-sm transition-all group">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-800 group-hover:text-accent truncate">{b.name}</h3>
                      <button onClick={async (e) => { e.stopPropagation(); if (confirm(zh ? "删除此知识库？" : "Delete?")) { await fetch(`/api/kb/${b.id}`, { method: "DELETE" }); loadBases(); } }} className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-300 hover:text-red-500 transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    {b.description && <p className="text-xs text-gray-500 line-clamp-1 mb-2">{b.description}</p>}
                    <div className="flex items-center gap-3 text-[10px] text-gray-400">
                      <span>{b.fileCount} {zh ? "文件" : "files"}</span>
                      <span>{(b.totalChars || 0).toLocaleString()} {zh ? "字" : "chars"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bases.length === 0 && groups.length === 0 && (
            <div className="text-center py-16 mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center"><span className="text-2xl opacity-30">📚</span></div>
              <p className="text-gray-500 mb-2">{zh ? "还没有知识库" : "No knowledge bases yet"}</p>
              <p className="text-xs text-gray-400 mb-4">{zh ? "新建一个知识库，上传你的资料" : "Create a knowledge base and upload your materials"}</p>
              <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent/90">{zh ? "新建知识库" : "Create Knowledge Base"}</button>
            </div>
          )}

          {/* Create Knowledge Base Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="text-base font-semibold">{zh ? "新建知识库" : "Create Knowledge Base"}</h3>
                </div>
                <div className="p-6">
                  <label className="text-xs text-gray-500 mb-1 block">{zh ? "名称" : "Name"}</label>
                  <input type="text" value={newBaseName} onChange={e => setNewBaseName(e.target.value)} placeholder={zh ? "例如：我的简历资料" : "e.g., My Resume Materials"} className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-accent/50" autoFocus onKeyDown={e => { if (e.key === "Enter") createBase(); }} />
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">{zh ? "取消" : "Cancel"}</button>
                    <button onClick={createBase} disabled={!newBaseName.trim()} className="px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent/90 disabled:opacity-30">{zh ? "创建" : "Create"}</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Processing tasks — shown inline as cards in the group list */}

          {/* ===== Upload Modal ===== */}
          {showUploadModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setShowUploadModal(false)}>
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()} style={{ animation: "fadeSlideUp 0.25s ease forwards" }}>
                {/* Modal header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h3 className="text-base font-semibold text-gray-900">{zh ? "添加资料" : "Add Source"}</h3>
                  <button onClick={() => setShowUploadModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* File upload zone */}
                <div className="p-6">
                  <div
                    className={`rounded-xl border-2 border-dashed transition-all p-8 text-center ${dragOver ? "border-accent bg-accent/5" : "border-gray-200 hover:border-gray-300"}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                  >
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{zh ? "拖拽文件到这里" : "Drag files here"}</p>
                    <p className="text-xs text-gray-400 mb-4">PDF, DOCX, TXT, MD, ZIP</p>
                    <label className="inline-flex px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium cursor-pointer hover:bg-accent/90 transition-all">
                      {zh ? "选择文件" : "Choose files"}
                      <input type="file" className="hidden" accept={ACCEPTED_TYPES} multiple onChange={e => { handleFiles(e.target.files); }} />
                    </label>
                  </div>

                  {/* URL input */}
                  <div className="mt-5 pt-5 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-3">{zh ? "或通过链接添加" : "Or add via URL"}</p>
                    <div className="flex gap-2">
                      <select value={urlType} onChange={e => setUrlType(e.target.value as "git" | "bilibili" | "youtube")} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white text-gray-700">
                        <option value="git">GitHub</option>
                        <option value="bilibili">Bilibili</option>
                        <option value="youtube">YouTube</option>
                      </select>
                      <input
                        type="text"
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                        placeholder={urlType === "git" ? "https://github.com/user/repo" : urlType === "bilibili" ? "https://www.bilibili.com/video/BV..." : "https://youtube.com/watch?v=..."}
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:border-accent/50"
                        onKeyDown={e => { if (e.key === "Enter" && urlInput.trim()) { uploadUrl(urlInput.trim(), urlType); setUrlInput(""); } }}
                      />
                      <button
                        onClick={() => { if (urlInput.trim()) { uploadUrl(urlInput.trim(), urlType); setUrlInput(""); } }}
                        className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-all"
                      >
                        {zh ? "添加" : "Add"}
                      </button>
                    </div>
                  </div>

                  {/* Upload progress inside modal */}
                  {uploadingFiles.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-gray-100 space-y-2 max-h-40 overflow-y-auto">
                      {uploadingFiles.filter(f => f.status !== "error").map(f => (
                        <div key={f.id} className="flex items-center gap-3 text-sm">
                          <span className="text-xs">{SOURCE_TYPE_META[f.type as SourceType]?.icon || "📄"}</span>
                          <span className="text-gray-700 truncate flex-1">{f.name}</span>
                          {f.status === "uploading" || f.status === "extracting" ? (
                            <span className="flex items-center gap-2 text-xs text-accent">
                              <span className="w-3 h-3 border border-accent/30 border-t-accent rounded-full animate-spin" />
                              {f.progress}
                            </span>
                          ) : (
                            <span className="text-xs text-green-600">{f.progress}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Knowledge groups list + inline task cards */}
          {(groups.length > 0 || uploadingFiles.length > 0) && (
            <div>
              {!loaded ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-white border border-gray-200 animate-pulse" />)}</div>
              ) : expandedGroup ? (
                // Expanded group detail
                (() => {
                  const g = groups.find(gr => gr.id === expandedGroup);
                  if (!g) return null;
                  const filtered = search ? groupItems.filter(i => i.title.toLowerCase().includes(search.toLowerCase()) || i.content.toLowerCase().includes(search.toLowerCase())) : groupItems;
                  return (
                    <div>
                      <button onClick={() => setExpandedGroup(null)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        {zh ? "返回知识组列表" : "Back to groups"}
                      </button>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900">{g.name}</h2>
                          <p className="text-xs text-gray-500">{g.itemCount} {zh ? "条知识" : "items"}</p>
                        </div>
                        <div className="flex gap-1">
                          {Object.entries(g.categoryCounts).map(([cat, count]) => (
                            <span key={cat} className={`text-xs px-2 py-0.5 rounded-md ${CATEGORY_META[cat as KnowledgeCategory]?.color}`}>
                              {CATEGORY_META[cat as KnowledgeCategory]?.icon} {count}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {filtered.map(item => (
                          <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 hover:border-accent/20 transition-all">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_META[item.category as KnowledgeCategory]?.color}`}>
                                    {CATEGORY_META[item.category as KnowledgeCategory]?.icon} {item.category}
                                  </span>
                                  <h3 className="text-sm font-medium text-gray-800 truncate">{item.title}</h3>
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-2">{item.content}</p>
                                {item.tags?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {(typeof item.tags === "string" ? JSON.parse(item.tags) : item.tags).slice(0, 5).map((tag: string) => (
                                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{tag}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={async () => {
                                  const newSel = !item.selected;
                                  setGroupItems(prev => prev.map(i => i.id === item.id ? { ...i, selected: newSel } : i));
                                  setItems(prev => prev.map(i => i.id === item.id ? { ...i, selected: newSel } : i));
                                  await fetch(`/api/knowledge/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selected: newSel }) });
                                }}
                                className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${item.selected ? "bg-accent border-accent" : "border-gray-300"}`}
                              >
                                {item.selected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              ) : (
                // Group list (with inline task status cards)
                <div className="space-y-3">
                  {/* Active + recent tasks shown as cards in the list */}
                  {uploadingFiles.map(f => (
                    <div key={`task-${f.id}`} className={`rounded-xl border p-4 transition-all ${
                      f.status === "error" ? "border-red-200 bg-red-50/50" :
                      f.status === "done" ? "border-green-200 bg-green-50/30" :
                      "border-accent/20 bg-accent/3"
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 ${
                          f.status === "error" ? "bg-red-100" :
                          f.status === "done" ? "bg-green-100" :
                          "bg-accent/10"
                        }`}>
                          {SOURCE_TYPE_META[f.type as SourceType]?.icon || "📄"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-800 truncate">{f.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {f.status === "uploading" || f.status === "extracting" ? (
                              <span className="flex items-center gap-1.5 text-xs text-accent font-medium">
                                <span className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                                {f.progress || (zh ? "处理中..." : "Processing...")}
                              </span>
                            ) : f.status === "done" ? (
                              <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                {f.itemCount ? (zh ? `完成，提取 ${f.itemCount} 条知识` : `Done, ${f.itemCount} items extracted`) : (zh ? "处理完成" : "Done")}
                              </span>
                            ) : (
                              <span className="text-xs text-red-500">{f.error || (zh ? "处理失败" : "Failed")}</span>
                            )}
                          </div>
                        </div>
                        {f.status === "done" && (
                          <button onClick={() => setUploadingFiles(prev => prev.filter(t => t.id !== f.id))} className="p-2 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-all" title={zh ? "清除" : "Dismiss"}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                        {f.status === "error" && (
                          <button onClick={() => setUploadingFiles(prev => prev.filter(t => t.id !== f.id))} className="p-2 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all" title={zh ? "清除" : "Dismiss"}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {groups.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase())).map(g => (
                    <div key={g.id} onClick={() => openGroup(g.id)} className="rounded-xl border border-gray-200 bg-white p-4 hover:border-accent/20 hover:shadow-sm transition-all cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-lg shrink-0">
                          {SOURCE_TYPE_META[g.sourceType as SourceType]?.icon || "📁"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-gray-800 truncate">{g.name}</h3>
                            {g.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-accent/8 text-accent">{tag}</span>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400">{g.itemCount} {zh ? "条" : "items"}</span>
                            <span className="text-xs text-gray-300">·</span>
                            <span className="text-xs text-gray-400">{g.selectedCount} {zh ? "已选" : "selected"}</span>
                            <span className="text-xs text-gray-300">·</span>
                            {Object.entries(g.categoryCounts).map(([cat, count]) => (
                              <span key={cat} className={`text-[9px] px-1 py-0.5 rounded ${CATEGORY_META[cat as KnowledgeCategory]?.color}`}>
                                {CATEGORY_META[cat as KnowledgeCategory]?.icon} {count}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button onClick={e => { e.stopPropagation(); deleteGroup(g.id); }} className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                        <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
