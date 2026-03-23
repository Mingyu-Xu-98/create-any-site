"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useLocale } from "@/components/LocaleProvider";
import type { KnowledgeItem, Source, SourceType, KnowledgeCategory } from "@/lib/knowledge";
import { CATEGORY_META, SOURCE_TYPE_META } from "@/lib/knowledge";
import { getAutoLayout } from "@/lib/questions";
import { getImageTasks } from "@/lib/image-prompts";

type SidePanel = "chat" | "sources" | "knowledge";

interface ChatMessage { role: "user" | "assistant"; content: string }

export default function CreatePage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { t } = useLocale();

  const [panel, setPanel] = useState<SidePanel>("chat");

  // Sources
  const [sources, setSources] = useState<Source[]>([]);
  const [addMode, setAddMode] = useState<SourceType | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Pending
  const [pendingItems, setPendingItems] = useState<KnowledgeItem[]>([]);
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null);
  const [pendingSourceName, setPendingSourceName] = useState("");
  const [pendingSourceType, setPendingSourceType] = useState("");
  const [saveError, setSaveError] = useState("");

  // Knowledge
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [filterCat, setFilterCat] = useState<KnowledgeCategory | "all">("all");

  // Chat & Build
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [genStatus, setGenStatus] = useState<"idle" | "generating" | "ready">("idle");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (authStatus === "unauthenticated") router.push("/login"); }, [authStatus, router]);

  const loadKnowledge = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge");
      if (res.ok) { const data = await res.json(); setItems(data.items || []); }
    } catch { /* */ }
    setItemsLoaded(true);
  }, []);

  useEffect(() => { if (session?.user) loadKnowledge(); }, [session, loadKnowledge]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  // ─── Source upload ───
  const addFileSource = async (file: File, type: SourceType) => {
    const sourceId = crypto.randomUUID();
    setSources((p) => [...p, { id: sourceId, type, name: file.name, status: "analyzing", addedAt: new Date().toISOString() }]);
    setAddMode(null);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("type", type);
      const res = await fetch("/api/analyze-source", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPendingItems((data.items as KnowledgeItem[]).map((i) => ({ ...i, sourceId })));
      setPendingSourceId(sourceId); setPendingSourceName(file.name); setPendingSourceType(type);
      setSources((p) => p.map((s) => s.id === sourceId ? { ...s, status: "done" as const } : s));
      setPanel("sources"); // Show results
    } catch (err) {
      setSources((p) => p.map((s) => s.id === sourceId ? { ...s, status: "error" as const, error: err instanceof Error ? err.message : "Failed" } : s));
    }
  };

  const addUrlSource = async (url: string, type: SourceType) => {
    const sourceId = crypto.randomUUID();
    setSources((p) => [...p, { id: sourceId, type, name: url, status: "analyzing", addedAt: new Date().toISOString() }]);
    setAddMode(null); setUrlInput("");
    try {
      const res = await fetch("/api/analyze-source", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, type }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPendingItems((data.items as KnowledgeItem[]).map((i) => ({ ...i, sourceId })));
      setPendingSourceId(sourceId); setPendingSourceName(url); setPendingSourceType(type);
      setSources((p) => p.map((s) => s.id === sourceId ? { ...s, status: "done" as const } : s));
      setPanel("sources");
    } catch (err) {
      setSources((p) => p.map((s) => s.id === sourceId ? { ...s, status: "error" as const, error: err instanceof Error ? err.message : "Failed" } : s));
    }
  };

  const removeSource = async (id: string) => {
    setSources((p) => p.filter((s) => s.id !== id));
    await fetch(`/api/knowledge?sourceId=${id}`, { method: "DELETE" });
    await loadKnowledge();
  };

  const handleFile = (file: File) => {
    if (file.name.endsWith(".zip") || file.type.includes("zip")) addFileSource(file, "zip");
    else if (file.name.endsWith(".pdf") || file.type.includes("pdf")) addFileSource(file, "pdf");
  };

  // ─── Pending ───
  const updatePendingItem = (id: string, field: string, value: unknown) => { setPendingItems((p) => p.map((i) => i.id === id ? { ...i, [field]: value } : i)); };
  const deletePendingItem = (id: string) => { setPendingItems((p) => p.filter((i) => i.id !== id)); };
  const togglePendingItem = (id: string) => { setPendingItems((p) => p.map((i) => i.id === id ? { ...i, selected: !i.selected } : i)); };

  const savePendingToKnowledge = async () => {
    const selected = pendingItems.filter((i) => i.selected);
    if (selected.length === 0) return;
    setSaveError("");
    try {
      const res = await fetch("/api/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: selected, sourceId: pendingSourceId, sourceName: pendingSourceName, sourceType: pendingSourceType }) });
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { setSaveError(`Server error (${res.status})`); return; }
      if (!res.ok) { setSaveError(data.error || "Save failed"); return; }
      setPendingItems([]); setPendingSourceId(null); setPendingSourceName(""); setPendingSourceType("");
      await loadKnowledge();
      setPanel("knowledge");
    } catch (err) { setSaveError(err instanceof Error ? err.message : "Save failed"); }
  };

  const discardPending = () => { setPendingItems([]); setPendingSourceId(null); };

  // ─── Knowledge ───
  const updateItem = async (id: string, field: string, value: unknown) => {
    setItems((p) => p.map((i) => i.id === id ? { ...i, [field]: value } : i));
    await fetch(`/api/knowledge/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
  };
  const deleteItem = async (id: string) => { setItems((p) => p.filter((i) => i.id !== id)); await fetch(`/api/knowledge/${id}`, { method: "DELETE" }); };
  const toggleItem = (id: string) => { const item = items.find((i) => i.id === id); if (item) updateItem(id, "selected", !item.selected); };

  // ─── Chat ───
  const sendChat = async (overrideInput?: string) => {
    const msg = overrideInput || chatInput;
    if (!msg.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: msg };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages); setChatInput(""); setChatLoading(true);
    try {
      const res = await fetch("/api/chat-build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: newMessages.map((m) => ({ role: m.role, content: m.content })), knowledge: items.filter((i) => i.selected), currentSelections: {} }) });
      const data = await res.json();
      if (data.content) setChatMessages((p) => [...p, { role: "assistant", content: data.content }]);
      if (data.action?.type === "generate") handleGenerate(data.action);
    } catch { setChatMessages((p) => [...p, { role: "assistant", content: "Something went wrong." }]); }
    finally { setChatLoading(false); }
  };

  const handleGenerate = async (config: Record<string, string>) => {
    setGenStatus("generating");
    try {
      const sel = items.filter((i) => i.selected);
      const data = buildWorkspaceDataFromKnowledge(sel);
      const theme = config.theme || "minimalist";
      const selections = { siteType: config.siteType || "portfolio", theme, layout: config.layout || getAutoLayout(theme, config.siteType || "portfolio"), customSiteType: "", customTheme: config.customTheme || "", customLayout: "", features: { chatbot: true, i18n: true, animations: true, share: true } };
      const res = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, selections }) });
      if (!res.ok) throw new Error("Generation failed");
      const { url } = await res.json();
      const imageTasks = getImageTasks(theme as import("@/lib/types").ThemeStyle, data.name, data.projects.map((p: { title: string; tags: string[] }) => ({ title: p.title, tags: p.tags })));
      for (const task of imageTasks) { try { await fetch("/api/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: task.prompt, filename: task.filename, style: theme }) }); } catch { /* */ } }
      const start = Date.now();
      while (Date.now() - start < 30000) { try { await fetch(url, { mode: "no-cors" }); break; } catch { /* */ } await new Promise((r) => setTimeout(r, 1000)); }
      setPreviewUrl(url); setGenStatus("ready");
    } catch { setGenStatus("idle"); setChatMessages((p) => [...p, { role: "assistant", content: "Generation failed." }]); }
  };

  const quickGenerate = () => handleGenerate({ siteType: "portfolio", theme: "minimalist" });

  if (authStatus === "loading" || !session?.user) return null;

  const filteredItems = filterCat === "all" ? items : items.filter((i) => i.category === filterCat);
  const selectedCount = items.filter((i) => i.selected).length;
  const categoryCounts = items.reduce<Record<string, number>>((acc, i) => { acc[i.category] = (acc[i.category] || 0) + 1; return acc; }, {});
  const knownSources = [...new Map(items.filter((i) => i.sourceId).map((i) => [i.sourceId, { id: i.sourceId!, name: i.sourceName, type: i.sourceType }])).values()];

  const SIDE_ITEMS: { id: SidePanel; icon: string; label: string; badge?: number }[] = [
    { id: "chat", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", label: t("create.build") },
    { id: "sources", icon: "M12 4v16m8-8H4", label: t("create.sources"), badge: sources.filter((s) => s.status === "analyzing").length || undefined },
    { id: "knowledge", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", label: t("create.knowledge"), badge: items.length || undefined },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar />
      <div className="flex-1 flex pt-14 overflow-hidden">

        {/* ====== ICON SIDEBAR ====== */}
        <div className="w-14 shrink-0 border-r border-white/5 flex flex-col items-center py-3 gap-1 bg-[#0a0a0a]">
          {SIDE_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setPanel(item.id)}
              className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all group ${
                panel === item.id ? "bg-accent/20 text-accent" : "text-white/25 hover:bg-white/5 hover:text-white/50"
              }`}
              title={item.label}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
              </svg>
              {item.badge && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent text-white text-[8px] flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ====== CHAT (always visible center) ====== */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-white/5">
          {/* Chat header */}
          <div className="shrink-0 px-5 py-3 border-b border-white/5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium">{t("create.build")}</h2>
              <p className="text-[10px] text-white/20">
                {items.length > 0 ? `${selectedCount} ${t("create.knowledge")} ${t("create.selected")}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              {/* Upload shortcut */}
              <button
                onClick={() => { setPanel("sources"); fileRef.current?.click(); setAddMode("pdf"); }}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-[10px] text-white/35 hover:bg-white/10 hover:text-white/60 transition-all flex items-center gap-1.5"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t("create.sources")}
              </button>
              {genStatus === "idle" && items.length > 0 && (
                <button onClick={quickGenerate} className="px-3 py-1.5 rounded-lg bg-accent/20 text-[10px] text-accent hover:bg-accent/30 transition-all">
                  {t("create.quickGenerate")}
                </button>
              )}
            </div>
          </div>

          <input ref={fileRef} type="file" accept=".pdf,.zip" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-sm text-white/30 mb-1">{t("create.chatDesc")}</p>
                <p className="text-[10px] text-white/15 mb-6 max-w-sm">
                  上传文件到知识库可以让 AI 更了解你的需求，生成更高质量的网站
                </p>
                <div className="space-y-1.5 w-full max-w-xs">
                  {[
                    "帮我搭建一个个人作品集网站",
                    "我想做一个极简风格的博客",
                    "根据我的知识库内容推荐网站类型",
                    "创建一个科技感十足的品牌官网",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => sendChat(prompt)}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-[11px] text-white/35 hover:text-white/60 hover:bg-white/[0.06] transition-all text-left"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-[12px] leading-relaxed ${
                  msg.role === "user" ? "bg-accent text-white" : "bg-white/[0.05] text-white/65"
                }`}>
                  <div className="whitespace-pre-wrap">{msg.content.replace(/```action[\s\S]*?```/g, "").trim()}</div>
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-xl bg-white/[0.05]">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" />
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" style={{ animationDelay: "0.2s" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" style={{ animationDelay: "0.4s" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 px-5 py-3 border-t border-white/5">
            <div className="flex gap-2">
              <input
                type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                placeholder={t("create.chatPlaceholder")}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50"
              />
              <button onClick={() => sendChat()} disabled={!chatInput.trim() || chatLoading}
                className="px-4 py-2.5 rounded-xl bg-accent text-white hover:bg-accent/90 disabled:opacity-30 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ====== RIGHT PANEL ====== */}
        <div className="w-[420px] shrink-0 flex flex-col bg-[#060606] overflow-hidden">

          {/* === PREVIEW (when generating/ready) === */}
          {(genStatus === "generating" || previewUrl) && panel === "chat" ? (
            genStatus === "generating" ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-10 h-10 mx-auto mb-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                  <p className="text-sm text-white/25">{t("create.generating")}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-white/[0.02] border-b border-white/5">
                  <div className="flex gap-1"><div className="w-2.5 h-2.5 rounded-full bg-red-400/50" /><div className="w-2.5 h-2.5 rounded-full bg-yellow-400/50" /><div className="w-2.5 h-2.5 rounded-full bg-green-400/50" /></div>
                  <div className="flex-1 px-2 py-0.5 rounded bg-white/5 text-[10px] text-white/25 truncate">{previewUrl}</div>
                  <a href={previewUrl!} target="_blank" rel="noopener noreferrer" className="text-[10px] text-white/30 hover:text-white">↗</a>
                </div>
                <iframe src={previewUrl!} className="flex-1 w-full border-0 bg-white" title="Preview" />
              </>
            )
          ) : panel === "sources" ? (
            /* === SOURCES PANEL === */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="shrink-0 px-4 py-3 border-b border-white/5">
                <h3 className="text-sm font-medium">{t("create.sources")}</h3>
                <p className="text-[10px] text-white/20 mt-0.5">{t("create.sourcesDesc")}</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Add buttons */}
                <div className="grid grid-cols-5 gap-1.5">
                  {(Object.keys(SOURCE_TYPE_META) as SourceType[]).map((type) => {
                    const meta = SOURCE_TYPE_META[type];
                    return (
                      <button key={type} onClick={() => { if (type === "pdf" || type === "zip") { setAddMode(type); setTimeout(() => fileRef.current?.click(), 100); } else setAddMode(addMode === type ? null : type); }}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-lg text-[10px] transition-all ${addMode === type ? "bg-accent/20 text-accent border border-accent/30" : "bg-white/[0.03] text-white/40 border border-white/5 hover:bg-white/[0.06]"}`}>
                        <span className="text-base">{meta.icon}</span><span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>

                {addMode && !["pdf", "zip"].includes(addMode) && (
                  <div className="flex gap-2">
                    <input type="text" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder={SOURCE_TYPE_META[addMode].placeholder}
                      className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50"
                      onKeyDown={(e) => { if (e.key === "Enter" && urlInput.trim()) addUrlSource(urlInput.trim(), addMode); }} />
                    <button onClick={() => urlInput.trim() && addUrlSource(urlInput.trim(), addMode)} className="px-3 py-2 rounded-lg bg-accent text-white text-xs">Add</button>
                  </div>
                )}

                {/* Active uploads */}
                {sources.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] text-white/25 font-medium uppercase tracking-wider">{t("create.recentUploads")}</h4>
                    {sources.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                        <span className="text-sm">{SOURCE_TYPE_META[s.type].icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/60 truncate">{s.name}</p>
                          <p className={`text-[10px] ${s.status === "done" ? "text-green-400" : s.status === "error" ? "text-red-400" : "text-accent"}`}>
                            {s.status === "analyzing" ? t("create.analyzing") : s.status === "done" ? t("create.done") : s.error || "Pending"}
                          </p>
                        </div>
                        {s.status === "analyzing" && <div className="w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />}
                      </div>
                    ))}
                  </div>
                )}

                {/* Saved sources */}
                {knownSources.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] text-white/25 font-medium uppercase tracking-wider">{t("create.savedSources")}</h4>
                    {knownSources.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 group">
                        <span className="text-sm">{SOURCE_TYPE_META[s.type as SourceType]?.icon || "📎"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/50 truncate">{s.name}</p>
                          <p className="text-[10px] text-white/20">{items.filter((i) => i.sourceId === s.id).length} {t("create.items")}</p>
                        </div>
                        <button onClick={() => removeSource(s.id!)} className="opacity-0 group-hover:opacity-100 text-white/15 hover:text-red-400 transition-all">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending items */}
                {pendingItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] text-white/25 font-medium uppercase tracking-wider">{t("create.analysisResults")}</h4>
                      <div className="flex gap-1.5">
                        <button onClick={discardPending} className="px-2 py-1 rounded text-[9px] text-white/30 bg-white/5 hover:bg-white/10">{t("create.discard")}</button>
                        <button onClick={savePendingToKnowledge} className="px-2 py-1 rounded text-[9px] text-white bg-accent hover:bg-accent/90">{t("create.saveToKnowledge")} ({pendingItems.filter((i) => i.selected).length})</button>
                      </div>
                    </div>
                    {saveError && <p className="text-[10px] text-red-400">{saveError}</p>}
                    {pendingItems.map((item) => {
                      const catMeta = CATEGORY_META[item.category as KnowledgeCategory];
                      return (
                        <div key={item.id} className={`p-2.5 rounded-lg border transition-all group ${item.selected ? "bg-white/[0.03] border-white/8" : "bg-white/[0.01] border-white/5 opacity-40"}`}>
                          <div className="flex items-start gap-1.5 mb-1">
                            <button onClick={() => togglePendingItem(item.id)} className={`mt-0.5 w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center ${item.selected ? "bg-accent border-accent" : "border-white/20"}`}>
                              {item.selected && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </button>
                            <input className="flex-1 bg-transparent text-[10px] font-medium text-white/80 focus:outline-none" value={item.title} onChange={(e) => updatePendingItem(item.id, "title", e.target.value)} />
                            <span className={`text-[8px] px-1 py-0.5 rounded-full shrink-0 ${catMeta?.color || "bg-white/10 text-white/40"}`}>{catMeta?.icon}</span>
                            <button onClick={() => deletePendingItem(item.id)} className="opacity-0 group-hover:opacity-100 text-white/10 hover:text-red-400">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                          <textarea className="w-full bg-transparent text-[9px] text-white/35 leading-relaxed resize-none focus:outline-none focus:text-white/60" rows={2} value={item.content} onChange={(e) => updatePendingItem(item.id, "content", e.target.value)} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          ) : panel === "knowledge" ? (
            /* === KNOWLEDGE PANEL === */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="shrink-0 px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">{t("create.knowledge")}</h3>
                  <p className="text-[10px] text-white/20 mt-0.5">{selectedCount}/{items.length} {t("create.selected")}</p>
                </div>
              </div>

              {/* Category filter */}
              <div className="shrink-0 px-4 py-2 border-b border-white/5 flex flex-wrap gap-1">
                <button onClick={() => setFilterCat("all")} className={`px-2 py-0.5 rounded text-[9px] transition-all ${filterCat === "all" ? "bg-accent text-white" : "bg-white/5 text-white/30"}`}>All {items.length}</button>
                {(Object.keys(CATEGORY_META) as KnowledgeCategory[]).map((cat) => {
                  const count = categoryCounts[cat] || 0; if (count === 0) return null;
                  return <button key={cat} onClick={() => setFilterCat(cat)} className={`px-2 py-0.5 rounded text-[9px] transition-all ${filterCat === cat ? "bg-accent text-white" : "bg-white/5 text-white/30"}`}>{CATEGORY_META[cat].icon} {count}</button>;
                })}
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {!itemsLoaded ? (
                  <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />)}</div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-12 text-white/15 text-xs">{items.length === 0 ? t("create.noKnowledge") : "No items in this category."}</div>
                ) : (
                  filteredItems.map((item) => {
                    const catMeta = CATEGORY_META[item.category as KnowledgeCategory];
                    return (
                      <div key={item.id} className={`p-2.5 rounded-lg border transition-all group ${item.selected ? "bg-white/[0.03] border-white/8" : "bg-white/[0.01] border-white/5 opacity-40"}`}>
                        <div className="flex items-start gap-1.5">
                          <button onClick={() => toggleItem(item.id)} className={`mt-0.5 w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center ${item.selected ? "bg-accent border-accent" : "border-white/20"}`}>
                            {item.selected && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className={`text-[8px] px-1 py-0.5 rounded ${catMeta?.color || "bg-white/10 text-white/40"}`}>{catMeta?.icon}</span>
                              <input className="flex-1 bg-transparent text-[10px] font-medium text-white/70 focus:outline-none truncate" value={item.title} onChange={(e) => updateItem(item.id, "title", e.target.value)} />
                            </div>
                            <textarea className="w-full bg-transparent text-[9px] text-white/30 leading-relaxed resize-none focus:outline-none focus:text-white/50" rows={2} value={item.content} onChange={(e) => updateItem(item.id, "content", e.target.value)} />
                          </div>
                          <button onClick={() => deleteItem(item.id)} className="opacity-0 group-hover:opacity-100 text-white/10 hover:text-red-400">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          ) : (
            /* === DEFAULT: Style themes === */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="shrink-0 px-4 py-3 border-b border-white/5">
                <h3 className="text-sm font-medium">{t("create.styleThemes")}</h3>
                <p className="text-[10px] text-white/20 mt-0.5">{t("create.styleThemesDesc")}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-2">
                  {STYLE_THEMES.map((theme) => (
                    <div key={theme.id} className="rounded-lg overflow-hidden border border-white/5 hover:border-accent/20 transition-all cursor-pointer group"
                      onClick={() => sendChat(`使用 ${theme.name} 风格创建网站`)}>
                      <div className={`h-14 bg-gradient-to-br ${theme.gradient} opacity-60 group-hover:opacity-100 transition-opacity`} />
                      <div className="p-2">
                        <h4 className="text-[10px] font-medium group-hover:text-accent transition-colors">{theme.name}</h4>
                        <p className="text-[8px] text-white/20 mt-0.5">{theme.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Style themes data ───
const STYLE_THEMES = [
  { id: "cyberpunk", name: "Cyberpunk", desc: "霓虹光效，粒子动画", gradient: "from-purple-600 via-pink-500 to-cyan-500" },
  { id: "minimalist", name: "Minimalist", desc: "极简留白，锐利排版", gradient: "from-gray-200 to-gray-400" },
  { id: "ghibli", name: "Ghibli", desc: "水彩质感，温暖有机", gradient: "from-green-400 via-emerald-300 to-sky-400" },
  { id: "glassmorphism", name: "Glassmorphism", desc: "毛玻璃，模糊效果", gradient: "from-blue-400 via-violet-400 to-purple-500" },
  { id: "retro", name: "Retro", desc: "胶片质感，复古排版", gradient: "from-orange-300 via-yellow-200 to-amber-400" },
  { id: "brutalist", name: "Brutalist", desc: "暗色系，等宽字体", gradient: "from-gray-900 via-gray-800 to-gray-700" },
  { id: "cinematic", name: "Cinematic", desc: "戏剧性光影，电影质感", gradient: "from-amber-700 via-red-900 to-gray-900" },
  { id: "bold-creative", name: "Bold Creative", desc: "鲜艳色彩，大字排版", gradient: "from-yellow-400 via-red-500 to-pink-600" },
  { id: "editorial", name: "Editorial", desc: "杂志排版，优雅衬线", gradient: "from-stone-200 via-amber-100 to-stone-300" },
  { id: "nature", name: "Nature", desc: "大地色调，有机形状", gradient: "from-green-700 via-emerald-600 to-lime-500" },
  { id: "gradient-mesh", name: "Gradient Mesh", desc: "渐变网格，流动色彩", gradient: "from-indigo-500 via-purple-500 to-pink-500" },
  { id: "neo-tokyo", name: "Neo Tokyo", desc: "日式都市，霓虹传统", gradient: "from-red-600 via-pink-600 to-violet-700" },
];

// ─── Build WorkspaceData from knowledge items ───
function buildWorkspaceDataFromKnowledge(items: KnowledgeItem[]) {
  const get = (cat: string) => items.filter((i) => i.category === cat);
  const factual = get("factual"); const skills = get("skills"); const experience = get("experience"); const media = get("media"); const meta = get("meta");
  const nameItem = factual.find((i) => /name|姓名|称呼/i.test(i.title));
  const name = nameItem?.content || "Your Name";
  const titleItem = factual.find((i) => /title|职位|头衔|role/i.test(i.title));
  const emailItem = factual.find((i) => /email|邮箱/i.test(i.title));
  const bioItem = meta.find((i) => /summary|简介|overview|bio/i.test(i.title));
  const bio = bioItem?.content || meta[0]?.content || "";
  return {
    name, nameEn: name, title: titleItem?.content || "", titleEn: titleItem?.content || "",
    email: emailItem?.content || "", location: "", locationEn: "", bio, bioEn: bio,
    bioTags: meta.flatMap((m) => m.tags).slice(0, 6), bioTagsEn: meta.flatMap((m) => m.tags).slice(0, 6),
    skills: skills.length > 0 ? [{ title: "Skills", skills: skills.map((s) => s.title) }] : [],
    skillsEn: skills.length > 0 ? [{ title: "Skills", skills: skills.map((s) => s.title) }] : [],
    projects: experience.filter((e) => /project|项目/i.test(e.title)).map((e) => ({ title: e.title, org: "", desc: e.content.slice(0, 200), tags: e.tags, image: "", link: "" })),
    projectsEn: experience.filter((e) => /project|项目/i.test(e.title)).map((e) => ({ title: e.title, org: "", desc: e.content.slice(0, 200), tags: e.tags, image: "", link: "" })),
    timeline: experience.filter((e) => !/project|项目/i.test(e.title)).map((e, i) => ({ date: "", title: e.title, desc: e.content.slice(0, 200), active: i === 0 })),
    timelineEn: experience.filter((e) => !/project|项目/i.test(e.title)).map((e, i) => ({ date: "", title: e.title, desc: e.content.slice(0, 200), active: i === 0 })),
    education: [], educationEn: [],
    tags: skills.map((s) => s.title).slice(0, 6), tagsEn: skills.map((s) => s.title).slice(0, 6),
    links: media.map((m) => ({ label: m.title, labelEn: m.title, url: m.content, icon: "website" })),
    visibleSections: ["about", ...(skills.length > 0 ? ["skills"] : []), ...(experience.length > 0 ? ["projects", "timeline"] : []), ...(media.length > 0 ? ["links"] : [])],
    chatbotContext: items.map((i) => `${i.title}: ${i.content}`).join("\n"),
  };
}
