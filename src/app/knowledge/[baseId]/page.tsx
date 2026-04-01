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
  const [detailTab, setDetailTab] = useState<"files" | "index">("files");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlType, setUrlType] = useState("url");
  const [viewingFile, setViewingFile] = useState<{ id: string; content: string; name: string } | null>(null);

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

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadProgress(zh ? `正在处理 ${file.name}...` : `Processing ${file.name}...`);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/kb/${baseId}/files`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      await loadData();
      setUploadProgress("");
    } catch {
      setUploadProgress(zh ? "上传失败" : "Upload failed");
    } finally { setUploading(false); }
  };

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
        <div className="max-w-4xl mx-auto px-6 py-8">

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
          {detailTab === "index" && base?.indexMd && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">{base.indexMd}</pre>
            </div>
          )}

          {/* Upload progress */}
          {uploadProgress && (
            <div className="mb-4 rounded-lg border border-accent/20 bg-accent/5 px-4 py-2 flex items-center gap-2 text-sm text-accent">
              {uploading && <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />}
              {uploadProgress}
            </div>
          )}

          {/* File list tab */}
          {detailTab === "files" && (files.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center"><span className="text-2xl opacity-30">📁</span></div>
              <p className="text-gray-500">{zh ? "暂无文件。点击上方添加。" : "No files yet. Add some above."}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map(f => {
                const kw: string[] = f.keywords ? JSON.parse(f.keywords) : [];
                return (
                  <div key={f.id} className="rounded-xl border border-gray-200 bg-white p-4 hover:border-accent/20 transition-all group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">{f.type === "image" ? "🖼️" : f.type === "link" ? "🔗" : f.type === "pdf" ? "📄" : "📝"}</span>
                          <h3 className="text-sm font-medium text-gray-800 truncate">{f.name}</h3>
                          <span className="text-[10px] text-gray-400 shrink-0">{f.contentLength.toLocaleString()} {zh ? "字" : "chars"}</span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1">{f.description}</p>
                        {kw.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {kw.slice(0, 6).map(k => <span key={k} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{k}</span>)}
                          </div>
                        )}
                        {f.originalUrl && <p className="text-[10px] text-accent mt-1 truncate">{f.originalUrl}</p>}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        {f.type !== "image" && (
                          <button onClick={() => viewFileContent(f.id, f.name)} className="px-2 py-1 rounded text-[10px] text-gray-500 hover:bg-gray-100">{zh ? "查看" : "View"}</button>
                        )}
                        <button onClick={() => deleteFile(f.id)} className="px-2 py-1 rounded text-[10px] text-red-500 hover:bg-red-50">{zh ? "删除" : "Delete"}</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

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
                    <p className="text-xs text-gray-400">PDF, DOCX, TXT, MD, PNG, JPG</p>
                    <label className="mt-3 inline-flex px-4 py-2 rounded-lg bg-accent text-white text-sm cursor-pointer hover:bg-accent/90">
                      {zh ? "选择文件" : "Choose"}
                      <input type="file" className="hidden" accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg,.gif,.webp,.svg,.zip" multiple onChange={e => { if (e.target.files) Array.from(e.target.files).forEach(uploadFile); setShowUploadModal(false); }} />
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
