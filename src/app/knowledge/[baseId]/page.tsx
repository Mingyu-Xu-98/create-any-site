"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useLocale } from "@/components/LocaleProvider";

interface KBFile {
  id: string;
  name: string;
  type: string;
  description: string;
  keywords: string;
  originalUrl: string | null;
  contentLength: number;
  assetPath: string | null;
  createdAt: string;
}

interface KBBase {
  id: string;
  name: string;
  description: string;
  indexMd: string;
  fileCount: number;
  totalChars: number;
}

export default function KnowledgeBaseDetail() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const baseId = params.baseId as string;
  const { locale } = useLocale();
  const zh = locale === "zh";

  const [base, setBase] = useState<KBBase | null>(null);
  const [files, setFiles] = useState<KBFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadQueue, setUploadQueue] = useState<Array<{ id: string; name: string; status: "waiting" | "processing" | "done" | "error" }>>(() => {
    // Restore from localStorage on mount
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(`kb-upload-queue-${baseId}`);
      if (saved) {
        const parsed = JSON.parse(saved) as Array<{ id: string; name: string; status: string }>;
        // Only restore non-done items (still processing or waiting)
        return parsed.filter(q => q.status === "processing" || q.status === "waiting")
          .map(q => ({ ...q, status: "processing" as const }));
      }
    } catch {}
    return [];
  });
  const [detailTab, setDetailTab] = useState<"files" | "index">("files");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlType, setUrlType] = useState("url");
  const [viewingFile, setViewingFile] = useState<{ id: string; content: string; name: string } | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/kb/${baseId}`);
      if (res.ok) {
        const d = await res.json();
        setBase(d.base);
        setFiles(d.files || []);
      }
    } catch {} finally { setLoading(false); }
  }, [baseId]);

  useEffect(() => { if (session?.user) loadData(); }, [session, loadData]);

  // Persist upload queue to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const active = uploadQueue.filter(q => q.status !== "done");
    if (active.length > 0) {
      localStorage.setItem(`kb-upload-queue-${baseId}`, JSON.stringify(active));
    } else {
      localStorage.removeItem(`kb-upload-queue-${baseId}`);
    }
  }, [uploadQueue, baseId]);

  // Poll for restored processing items — check if they've finished (appeared in file list)
  useEffect(() => {
    const restored = uploadQueue.filter(q => q.status === "processing");
    if (restored.length === 0) return;
    const interval = setInterval(async () => {
      await loadData();
      // Check if any restored items' names now appear in the file list
      setUploadQueue(prev => {
        const fileNames = new Set(files.map(f => f.name));
        let changed = false;
        const updated = prev.map(q => {
          if (q.status === "processing" && fileNames.has(q.name)) {
            changed = true;
            setTimeout(() => setUploadQueue(p => p.filter(x => x.id !== q.id)), 2000);
            return { ...q, status: "done" as const };
          }
          return q;
        });
        return changed ? updated : prev;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [uploadQueue.length, files, loadData]); // eslint-disable-line react-hooks/exhaustive-deps

  const uploadFiles = async (fileList: File[]) => {
    if (fileList.length === 0) return;
    const items = fileList.map(f => ({ id: crypto.randomUUID(), name: f.name, status: "waiting" as const }));
    setUploadQueue(prev => [...prev, ...items]);
    setUploading(true);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const itemId = items[i].id;
      setUploadQueue(prev => prev.map(q => q.id === itemId ? { ...q, status: "processing" } : q));
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`/api/kb/${baseId}/files`, { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload failed");
        setUploadQueue(prev => prev.map(q => q.id === itemId ? { ...q, status: "done" } : q));
        // Auto-remove completed item after 2s
        setTimeout(() => setUploadQueue(prev => prev.filter(q => q.id !== itemId)), 2000);
      } catch {
        setUploadQueue(prev => prev.map(q => q.id === itemId ? { ...q, status: "error" } : q));
      }
    }
    await loadData();
    setUploading(false);
  };

  // Legacy single-file compat
  const uploadFile = (file: File) => uploadFiles([file]);

  const addLink = async () => {
    if (!urlInput.trim()) return;
    setUploading(true);
    setUploadProgress(zh ? "正在获取链接内容..." : "Fetching link...");
    try {
      const res = await fetch(`/api/kb/${baseId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim(), type: urlType }),
      });
      if (!res.ok) throw new Error("Failed");
      setUrlInput("");
      await loadData();
      setUploadProgress("");
    } catch {
      setUploadProgress(zh ? "添加失败" : "Failed");
    } finally { setUploading(false); }
  };

  const deleteFile = async (fileId: string) => {
    if (!confirm(zh ? "确认删除此文件？" : "Delete this file?")) return;
    await fetch(`/api/kb/${baseId}/files/${fileId}`, { method: "DELETE" });
    await loadData();
  };

  const viewFileContent = async (fileId: string, fileName: string) => {
    const res = await fetch(`/api/kb/${baseId}/files/${fileId}`);
    if (res.ok) {
      const d = await res.json();
      setViewingFile({ id: fileId, content: d.file.content || "(无内容)", name: fileName });
    }
  };

  if (status === "loading" || !session?.user || loading) {
    return <div className="min-h-screen bg-[#f8f9fc]"><Navbar /><div className="pt-20 flex justify-center"><div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div></div>;
  }

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <Navbar />
      <div className="pt-14">
        <div className="max-w-5xl mx-auto px-6 py-8">

          {/* Back + Header */}
          <button onClick={() => router.push("/knowledge")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            {zh ? "返回知识库列表" : "Back to list"}
          </button>

          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{base?.name}</h1>
              <p className="text-sm text-gray-500 mt-1">{base?.description || (zh ? "暂无描述" : "No description")}</p>
              <p className="text-xs text-gray-400 mt-1">{base?.fileCount || 0} {zh ? "个文件" : "files"} · {base?.totalChars || 0} {zh ? "字" : "chars"}</p>
            </div>
            <div className="flex gap-2">
              {/* Tab toggle: Files / Index */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                <button onClick={() => setDetailTab("files")} className={`px-3 py-1.5 text-xs transition-all ${detailTab === "files" ? "bg-accent text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                  {zh ? "文件列表" : "Files"}
                </button>
                <button onClick={() => setDetailTab("index")} className={`px-3 py-1.5 text-xs transition-all ${detailTab === "index" ? "bg-accent text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
                  Index
                </button>
              </div>
              <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent text-white text-sm hover:bg-accent/90">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {zh ? "添加文件" : "Add File"}
              </button>
            </div>
          </div>

          {/* Index tab */}
          {detailTab === "index" && (
            <div className="space-y-4">
              {/* Category summary cards */}
              {files.length > 0 && (() => {
                const docCount = files.filter(f => f.type !== "image" && f.type !== "link").length;
                const linkCount = files.filter(f => f.type === "link").length;
                const imgCount = files.filter(f => f.type === "image").length;
                const totalChars = files.reduce((sum, f) => sum + (f.contentLength || 0), 0);
                return (
                  <div className="grid grid-cols-4 gap-3">
                    <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
                      <div className="text-lg font-bold text-gray-800">{files.length}</div>
                      <div className="text-[10px] text-gray-500">{zh ? "总文件" : "Total"}</div>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-center">
                      <div className="text-lg font-bold text-blue-600">{docCount}</div>
                      <div className="text-[10px] text-blue-500">{zh ? "文档" : "Docs"}</div>
                    </div>
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-center">
                      <div className="text-lg font-bold text-emerald-600">{linkCount}</div>
                      <div className="text-[10px] text-emerald-500">{zh ? "链接" : "Links"}</div>
                    </div>
                    <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3 text-center">
                      <div className="text-lg font-bold text-purple-600">{imgCount}</div>
                      <div className="text-[10px] text-purple-500">{zh ? "图片" : "Images"}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Auto-generated index content */}
              {base?.indexMd ? (
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">{base.indexMd}</pre>
                </div>
              ) : (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-400">{zh ? "索引将在文件上传后自动生成" : "Index will be generated after uploading files"}</p>
                </div>
              )}
            </div>
          )}

          {/* Upload progress (inline fallback for link uploads) */}
          {uploadProgress && !uploadQueue.length && (
            <div className="mb-4 rounded-lg border border-accent/20 bg-accent/5 px-4 py-2 flex items-center gap-2 text-sm text-accent">
              {uploading && <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />}
              {uploadProgress}
            </div>
          )}

          {/* File list tab — flex: upload queue (left) + file sections (right) */}
          {detailTab === "files" && (() => {
            const docs = files.filter(f => f.type !== "image" && f.type !== "link");
            const links = files.filter(f => f.type === "link");
            const images = files.filter(f => f.type === "image");
            if (files.length === 0) return (
              <div className="text-center py-20">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center"><span className="text-2xl opacity-30">📁</span></div>
                <p className="text-gray-500">{zh ? "暂无文件。点击上方添加。" : "No files yet. Add some above."}</p>
              </div>
            );
            return (
              <div className="flex gap-5 items-start">
                {/* Left: Upload queue — independent panel, top aligned with first doc card */}
                {uploadQueue.length > 0 && (
                  <div className="w-52 shrink-0 sticky top-20 mt-10">
                    <div className="rounded-xl border border-accent/15 bg-white shadow-sm overflow-hidden">
                      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {uploadQueue.some(q => q.status === "processing") && <div className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />}
                          <h3 className="text-[11px] font-semibold text-gray-600">{zh ? "上传队列" : "Uploads"}</h3>
                        </div>
                        <span className="text-[9px] text-gray-400">{uploadQueue.filter(q => q.status === "done").length}/{uploadQueue.length}</span>
                      </div>
                      <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-50">
                        {uploadQueue.map(q => (
                          <div key={q.id} className={`px-3 py-2 flex items-center gap-2 ${q.status === "done" ? "opacity-40" : ""}`}>
                            {q.status === "waiting" && <div className="w-3 h-3 rounded-full border-2 border-gray-200 shrink-0" />}
                            {q.status === "processing" && <div className="w-3 h-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin shrink-0" />}
                            {q.status === "done" && <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                            {q.status === "error" && <svg className="w-3 h-3 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-gray-700 truncate">{q.name}</p>
                              <p className="text-[9px] text-gray-400">
                                {q.status === "waiting" && (zh ? "等待中" : "Waiting")}
                                {q.status === "processing" && (zh ? "处理中..." : "Processing...")}
                                {q.status === "done" && (zh ? "完成" : "Done")}
                                {q.status === "error" && (zh ? "失败" : "Failed")}
                              </p>
                            </div>
                            {q.status === "error" && (
                              <button onClick={() => setUploadQueue(prev => prev.filter(p => p.id !== q.id))} className="shrink-0 w-4 h-4 rounded-full hover:bg-red-100 flex items-center justify-center" title={zh ? "移除" : "Remove"}>
                                <svg className="w-2.5 h-2.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {uploadQueue.some(q => q.status === "done" || q.status === "error") && (
                        <div className="px-3 py-1.5 border-t border-gray-100">
                          <button onClick={() => setUploadQueue(prev => prev.filter(q => q.status === "processing" || q.status === "waiting"))} className="text-[9px] text-gray-400 hover:text-gray-600">{zh ? "清除" : "Clear"}</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Right: All file sections */}
                <div className="flex-1 min-w-0 space-y-6">
                {/* Documents section */}
                {docs.length > 0 && (
                  <div>
                    <button onClick={() => setCollapsed(p => ({ ...p, docs: !p.docs }))} className="flex items-center gap-2 mb-3 w-full text-left group/hdr">
                      <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center"><svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                      <h3 className="text-sm font-semibold text-gray-700">{zh ? "文档" : "Documents"} <span className="text-gray-400 font-normal">({docs.length})</span></h3>
                      <svg className={`w-4 h-4 text-gray-400 ml-auto transition-transform ${collapsed.docs ? "-rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {!collapsed.docs && <div className="space-y-2">
                      {docs.map(f => {
                        const kw: string[] = f.keywords ? JSON.parse(f.keywords) : [];
                        const typeIcon = f.type === "link" ? "🔗" : f.type === "pdf" ? "📄" : "📝";
                        const typeLabel = f.type === "link" ? (zh ? "链接" : "Link") : f.type === "pdf" ? "PDF" : (zh ? "文档" : "Doc");
                        return (
                          <div key={f.id} className="rounded-xl border border-gray-200 bg-white p-4 hover:border-accent/20 hover:shadow-sm transition-all group">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm">{typeIcon}</span>
                                  <h3 className="text-sm font-medium text-gray-800 truncate">{f.name}</h3>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 shrink-0">{typeLabel}</span>
                                  <span className="text-[10px] text-gray-400 shrink-0">{f.contentLength.toLocaleString()} {zh ? "字" : "chars"}</span>
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-2">{f.description}</p>
                                {kw.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {kw.slice(0, 6).map(k => <span key={k} className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100">{k}</span>)}
                                  </div>
                                )}
                                {f.originalUrl && <p className="text-[10px] text-accent mt-1 truncate">{f.originalUrl}</p>}
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                <button onClick={() => viewFileContent(f.id, f.name)} className="px-2.5 py-1 rounded-lg text-[10px] text-gray-500 hover:bg-gray-100 transition-colors">{zh ? "查看" : "View"}</button>
                                <button onClick={() => deleteFile(f.id)} className="px-2.5 py-1 rounded-lg text-[10px] text-red-500 hover:bg-red-50 transition-colors">{zh ? "删除" : "Delete"}</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>}
                  </div>
                )}

                {/* Links section */}
                {links.length > 0 && (
                  <div>
                    <button onClick={() => setCollapsed(p => ({ ...p, links: !p.links }))} className="flex items-center gap-2 mb-3 w-full text-left group/hdr">
                      <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center"><svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg></div>
                      <h3 className="text-sm font-semibold text-gray-700">{zh ? "链接" : "Links"} <span className="text-gray-400 font-normal">({links.length})</span></h3>
                      <svg className={`w-4 h-4 text-gray-400 ml-auto transition-transform ${collapsed.links ? "-rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {!collapsed.links && <div className="space-y-2">
                      {links.map(f => {
                        const kw: string[] = f.keywords ? JSON.parse(f.keywords) : [];
                        const domain = f.originalUrl ? (() => { try { return new URL(f.originalUrl).hostname; } catch { return ""; } })() : "";
                        return (
                          <div key={f.id} className="rounded-xl border border-gray-200 bg-white p-4 hover:border-emerald-200 hover:shadow-sm transition-all group">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm">🔗</span>
                                  <h3 className="text-sm font-medium text-gray-800 truncate">{f.name}</h3>
                                  {domain && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 shrink-0">{domain}</span>}
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-2">{f.description}</p>
                                {f.originalUrl && (
                                  <a href={f.originalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline mt-1.5">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    {f.originalUrl.length > 60 ? f.originalUrl.slice(0, 60) + "..." : f.originalUrl}
                                  </a>
                                )}
                                {kw.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {kw.slice(0, 6).map(k => <span key={k} className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100">{k}</span>)}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                <button onClick={() => viewFileContent(f.id, f.name)} className="px-2.5 py-1 rounded-lg text-[10px] text-gray-500 hover:bg-gray-100 transition-colors">{zh ? "查看" : "View"}</button>
                                <button onClick={() => deleteFile(f.id)} className="px-2.5 py-1 rounded-lg text-[10px] text-red-500 hover:bg-red-50 transition-colors">{zh ? "删除" : "Delete"}</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>}
                  </div>
                )}

                {/* Images section — grid with thumbnails */}
                {images.length > 0 && (
                  <div>
                    <button onClick={() => setCollapsed(p => ({ ...p, images: !p.images }))} className="flex items-center gap-2 mb-3 w-full text-left group/hdr">
                      <div className="w-6 h-6 rounded-lg bg-purple-50 flex items-center justify-center"><svg className="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                      <h3 className="text-sm font-semibold text-gray-700">{zh ? "图片素材" : "Images"} <span className="text-gray-400 font-normal">({images.length})</span></h3>
                      <svg className={`w-4 h-4 text-gray-400 ml-auto transition-transform ${collapsed.images ? "-rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {!collapsed.images && <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {images.map(f => {
                        const imgSrc = f.assetPath ? `/api/user-assets/${f.assetPath}` : f.originalUrl || (f.name.startsWith("/") ? f.name : `/api/user-assets/${f.name}`);
                        const displayName = f.description || f.name.replace(/\.\w+$/, "") || (zh ? "图片" : "Image");
                        return (
                          <div key={f.id} className="group relative rounded-xl border border-gray-200 bg-white overflow-hidden hover:border-accent/30 hover:shadow-md transition-all">
                            <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
                              <img
                                src={imgSrc}
                                alt={displayName}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="text-2xl opacity-20">🖼️</span>'; }}
                              />
                            </div>
                            <div className="px-2 py-1.5">
                              <p className="text-[10px] text-gray-600 truncate font-medium">{displayName}</p>
                              <p className="text-[9px] text-gray-400">{(f.contentLength / 1024).toFixed(0)}KB</p>
                            </div>
                            <button
                              onClick={() => deleteFile(f.id)}
                              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>}
                  </div>
                )}
              </div>
              </div>
            );
          })()}

          {/* Upload Modal */}
          {showUploadModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setShowUploadModal(false)}>
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h3 className="text-base font-semibold">{zh ? "添加文件" : "Add File"}</h3>
                  <button onClick={() => setShowUploadModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="p-6">
                  {/* File upload */}
                  <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center hover:border-gray-300 transition-all">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{zh ? "拖拽文件或点击上传" : "Drop or click to upload"}</p>
                    <p className="text-xs text-gray-400">PDF, DOCX, TXT, MD, PNG, JPG, ZIP · {zh ? "单文件最大 50MB" : "Max 50MB per file"}</p>
                    <label className="mt-3 inline-flex px-4 py-2 rounded-lg bg-accent text-white text-sm cursor-pointer hover:bg-accent/90">
                      {zh ? "选择文件" : "Choose"}
                      <input type="file" className="hidden" accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg,.gif,.webp,.svg,.zip" multiple onChange={e => { if (e.target.files) uploadFiles(Array.from(e.target.files)); setShowUploadModal(false); }} />
                    </label>
                  </div>
                  {/* Link input */}
                  <div className="mt-5 pt-5 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-3">{zh ? "或通过链接添加" : "Or add via URL"}</p>
                    <div className="flex gap-2">
                      <select value={urlType} onChange={e => setUrlType(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                        <option value="url">URL</option>
                        <option value="git">GitHub</option>
                        <option value="bilibili">Bilibili</option>
                        <option value="youtube">YouTube</option>
                      </select>
                      <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://..." className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-accent/50" onKeyDown={e => { if (e.key === "Enter") { addLink(); setShowUploadModal(false); } }} />
                      <button onClick={() => { addLink(); setShowUploadModal(false); }} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800">{zh ? "添加" : "Add"}</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* File content viewer */}
          {viewingFile && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={() => setViewingFile(null)}>
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                  <h3 className="text-sm font-semibold truncate">{viewingFile.name}</h3>
                  <button onClick={() => setViewingFile(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">{viewingFile.content}</pre>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
