"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import type { KnowledgeItem, Source, SourceType, KnowledgeCategory } from "@/lib/knowledge";
import { CATEGORY_META, SOURCE_TYPE_META } from "@/lib/knowledge";
import { getAutoLayout, getStylesForSiteType } from "@/lib/questions";
import { getImageTasks } from "@/lib/image-prompts";

type Tab = "sources" | "knowledge" | "build";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function CreatePage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("sources");

  // Sources (ephemeral - just for uploading)
  const [sources, setSources] = useState<Source[]>([]);
  const [addMode, setAddMode] = useState<SourceType | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Pending items from latest analysis (not yet saved to KB)
  const [pendingItems, setPendingItems] = useState<KnowledgeItem[]>([]);
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null);
  const [pendingSourceName, setPendingSourceName] = useState("");
  const [pendingSourceType, setPendingSourceType] = useState("");

  // Knowledge (persisted in DB)
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [filterCat, setFilterCat] = useState<KnowledgeCategory | "all">("all");

  // Build
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [genStatus, setGenStatus] = useState<"idle" | "generating" | "ready">("idle");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.push("/login");
  }, [authStatus, router]);

  // Load knowledge items from DB on mount
  const loadKnowledge = useCallback(async () => {
    const res = await fetch("/api/knowledge");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
    }
    setItemsLoaded(true);
  }, []);

  useEffect(() => {
    if (session?.user) loadKnowledge();
  }, [session, loadKnowledge]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ─── Source upload → analyze → show pending for review ───
  const addFileSource = async (file: File, type: SourceType) => {
    const sourceId = crypto.randomUUID();
    const source: Source = { id: sourceId, type, name: file.name, status: "analyzing", addedAt: new Date().toISOString() };
    setSources((prev) => [...prev, source]);
    setAddMode(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      const res = await fetch("/api/analyze-source", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Store as pending — user reviews before saving
      const newItems = (data.items as KnowledgeItem[]).map((item) => ({ ...item, sourceId }));
      setPendingItems(newItems);
      setPendingSourceId(sourceId);
      setPendingSourceName(file.name);
      setPendingSourceType(type);

      setSources((prev) => prev.map((s) => (s.id === sourceId ? { ...s, status: "done" as const } : s)));
    } catch (err) {
      setSources((prev) =>
        prev.map((s) =>
          s.id === sourceId ? { ...s, status: "error" as const, error: err instanceof Error ? err.message : "Failed" } : s
        )
      );
    }
  };

  const addUrlSource = async (url: string, type: SourceType) => {
    const sourceId = crypto.randomUUID();
    const source: Source = { id: sourceId, type, name: url, status: "analyzing", addedAt: new Date().toISOString() };
    setSources((prev) => [...prev, source]);
    setAddMode(null);
    setUrlInput("");

    try {
      const res = await fetch("/api/analyze-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const newItems = (data.items as KnowledgeItem[]).map((item) => ({ ...item, sourceId }));
      setPendingItems(newItems);
      setPendingSourceId(sourceId);
      setPendingSourceName(url);
      setPendingSourceType(type);

      setSources((prev) => prev.map((s) => (s.id === sourceId ? { ...s, status: "done" as const } : s)));
    } catch (err) {
      setSources((prev) =>
        prev.map((s) =>
          s.id === sourceId ? { ...s, status: "error" as const, error: err instanceof Error ? err.message : "Failed" } : s
        )
      );
    }
  };

  const removeSource = async (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/knowledge?sourceId=${id}`, { method: "DELETE" });
    await loadKnowledge();
  };

  const handleFile = (file: File) => {
    if (file.name.endsWith(".zip") || file.type.includes("zip")) addFileSource(file, "zip");
    else if (file.name.endsWith(".pdf") || file.type.includes("pdf")) addFileSource(file, "pdf");
  };

  // ─── Pending items review/edit ───
  const updatePendingItem = (id: string, field: string, value: unknown) => {
    setPendingItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const deletePendingItem = (id: string) => {
    setPendingItems((prev) => prev.filter((item) => item.id !== id));
  };

  const togglePendingItem = (id: string) => {
    setPendingItems((prev) => prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)));
  };

  const savePendingToKnowledge = async () => {
    const selected = pendingItems.filter((i) => i.selected);
    if (selected.length === 0) return;

    await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: selected,
        sourceId: pendingSourceId,
        sourceName: pendingSourceName,
        sourceType: pendingSourceType,
      }),
    });

    setPendingItems([]);
    setPendingSourceId(null);
    setPendingSourceName("");
    setPendingSourceType("");
    await loadKnowledge();
  };

  const discardPending = () => {
    setPendingItems([]);
    setPendingSourceId(null);
  };

  // ─── Knowledge item updates (persist to DB) ───
  const updateItem = async (id: string, field: string, value: unknown) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
    await fetch(`/api/knowledge/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  };

  const deleteItem = async (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
  };

  const toggleItem = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (item) updateItem(id, "selected", !item.selected);
  };

  // ─── Chat ───
  const sendChat = async (overrideInput?: string) => {
    const msg = overrideInput || chatInput;
    if (!msg.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: msg };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          knowledge: items.filter((i) => i.selected),
          currentSelections: {},
        }),
      });
      const data = await res.json();
      if (data.content) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
      }
      if (data.action?.type === "generate") {
        handleGenerate(data.action);
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerate = async (config: Record<string, string>) => {
    setGenStatus("generating");
    try {
      const selectedItems = items.filter((i) => i.selected);
      const data = buildWorkspaceDataFromKnowledge(selectedItems);
      const theme = config.theme || "minimalist";
      const selections = {
        siteType: config.siteType || "portfolio",
        theme,
        layout: config.layout || getAutoLayout(theme, config.siteType || "portfolio"),
        customSiteType: "",
        customTheme: config.customTheme || "",
        customLayout: "",
        features: { chatbot: true, i18n: true, animations: true, share: true },
      };

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, selections }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const { url } = await res.json();

      // Generate images
      const imageTasks = getImageTasks(theme as import("@/lib/types").ThemeStyle, data.name, data.projects.map((p: { title: string; tags: string[] }) => ({ title: p.title, tags: p.tags })));
      for (const task of imageTasks) {
        try {
          await fetch("/api/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: task.prompt, filename: task.filename, style: theme }),
          });
        } catch { /* best-effort */ }
      }

      // Wait for server
      const start = Date.now();
      while (Date.now() - start < 30000) {
        try { await fetch(url, { mode: "no-cors" }); break; } catch { /* */ }
        await new Promise((r) => setTimeout(r, 1000));
      }

      setPreviewUrl(url);
      setGenStatus("ready");
    } catch {
      setGenStatus("idle");
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Generation failed. Please try again." }]);
    }
  };

  const quickGenerate = () => handleGenerate({ siteType: "portfolio", theme: "minimalist" });

  if (authStatus === "loading" || !session?.user) return null;

  const filteredItems = filterCat === "all" ? items : items.filter((i) => i.category === filterCat);
  const selectedCount = items.filter((i) => i.selected).length;
  const categoryCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  // Unique sources from knowledge items
  const knownSources = [...new Map(items.filter((i) => i.sourceId).map((i) => [i.sourceId, { id: i.sourceId!, name: i.sourceName, type: i.sourceType }])).values()];

  const TABS: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: "sources", label: "Sources", icon: "M12 4v16m8-8H4" },
    { id: "knowledge", label: "Knowledge", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", badge: items.length || undefined },
    { id: "build", label: "Build", icon: "M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar />

      <div className="flex-1 flex pt-14 overflow-hidden">
        {/* ====== LEFT SIDEBAR ====== */}
        <div className="w-[380px] shrink-0 border-r border-white/5 flex flex-col bg-[#0a0a0a]/60 overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-white/5 shrink-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium border-b-2 transition-all ${
                  tab === t.id ? "border-accent text-accent" : "border-transparent text-white/35 hover:text-white/55"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={t.icon} />
                </svg>
                {t.label}
                {t.badge && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 leading-none">{t.badge}</span>
                )}
              </button>
            ))}
          </div>

          {/* ─── SOURCES TAB ─── */}
          {tab === "sources" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <p className="text-[10px] text-white/20 leading-relaxed">
                Add data sources. AI will analyze and extract knowledge items into your Knowledge Base.
              </p>

              {/* Add source buttons */}
              <div className="grid grid-cols-5 gap-1.5">
                {(Object.keys(SOURCE_TYPE_META) as SourceType[]).map((type) => {
                  const meta = SOURCE_TYPE_META[type];
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        if (type === "pdf" || type === "zip") {
                          setAddMode(type);
                          setTimeout(() => fileRef.current?.click(), 100);
                        } else {
                          setAddMode(addMode === type ? null : type);
                        }
                      }}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-lg text-[10px] transition-all ${
                        addMode === type ? "bg-accent/20 text-accent border border-accent/30" : "bg-white/[0.03] text-white/40 border border-white/5 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span className="text-base">{meta.icon}</span>
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept={addMode === "pdf" ? ".pdf" : ".zip"}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && addMode) { addFileSource(file, addMode); e.target.value = ""; }
                }}
              />

              {/* URL input */}
              {addMode && !["pdf", "zip"].includes(addMode) && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder={SOURCE_TYPE_META[addMode].placeholder}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50"
                    onKeyDown={(e) => { if (e.key === "Enter" && urlInput.trim()) addUrlSource(urlInput.trim(), addMode); }}
                  />
                  <button
                    onClick={() => urlInput.trim() && addUrlSource(urlInput.trim(), addMode)}
                    className="px-3 py-2 rounded-lg bg-accent text-white text-xs hover:bg-accent/90"
                  >
                    Add
                  </button>
                </div>
              )}

              {/* Active uploads */}
              {sources.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-[10px] text-white/25 font-medium uppercase tracking-wider">Recent Uploads</h3>
                  {sources.map((source) => (
                    <div key={source.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 group">
                      <span className="text-sm">{SOURCE_TYPE_META[source.type].icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/60 truncate">{source.name}</p>
                        <p className={`text-[10px] ${
                          source.status === "done" ? "text-green-400" :
                          source.status === "error" ? "text-red-400" :
                          "text-accent"
                        }`}>
                          {source.status === "analyzing" ? "Analyzing..." :
                           source.status === "done" ? "Done — items saved to Knowledge" :
                           source.error || "Pending"}
                        </p>
                      </div>
                      {source.status === "analyzing" && (
                        <div className="w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Persisted sources summary */}
              {knownSources.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-[10px] text-white/25 font-medium uppercase tracking-wider">Saved Sources</h3>
                  {knownSources.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 group">
                      <span className="text-sm">{SOURCE_TYPE_META[s.type as SourceType]?.icon || "📎"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/50 truncate">{s.name}</p>
                        <p className="text-[10px] text-white/20">
                          {items.filter((i) => i.sourceId === s.id).length} items
                        </p>
                      </div>
                      <button
                        onClick={() => removeSource(s.id!)}
                        className="opacity-0 group-hover:opacity-100 text-white/15 hover:text-red-400 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── KNOWLEDGE TAB ─── */}
          {tab === "knowledge" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Category filter */}
              <div className="shrink-0 px-4 py-3 border-b border-white/5 flex flex-wrap gap-1.5">
                <button
                  onClick={() => setFilterCat("all")}
                  className={`px-2.5 py-1 rounded text-[10px] transition-all ${
                    filterCat === "all" ? "bg-accent text-white" : "bg-white/5 text-white/35 hover:bg-white/10"
                  }`}
                >
                  All {items.length}
                </button>
                {(Object.keys(CATEGORY_META) as KnowledgeCategory[]).map((cat) => {
                  const count = categoryCounts[cat] || 0;
                  if (count === 0) return null;
                  return (
                    <button
                      key={cat}
                      onClick={() => setFilterCat(cat)}
                      className={`px-2.5 py-1 rounded text-[10px] transition-all ${
                        filterCat === cat ? "bg-accent text-white" : "bg-white/5 text-white/35 hover:bg-white/10"
                      }`}
                    >
                      {CATEGORY_META[cat].icon} {count}
                    </button>
                  );
                })}
              </div>

              {/* Items list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {!itemsLoaded ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />)}
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-16 text-white/15 text-xs">
                    {items.length === 0 ? "No knowledge yet. Add sources first." : "No items in this category."}
                  </div>
                ) : (
                  filteredItems.map((item) => {
                    const catMeta = CATEGORY_META[item.category as KnowledgeCategory];
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border transition-all group ${
                          item.selected ? "bg-white/[0.03] border-white/8" : "bg-white/[0.01] border-white/5 opacity-40"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleItem(item.id)}
                            className={`mt-0.5 w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-all ${
                              item.selected ? "bg-accent border-accent" : "border-white/20"
                            }`}
                          >
                            {item.selected && (
                              <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`text-[8px] px-1 py-0.5 rounded ${catMeta?.color || "bg-white/10 text-white/40"}`}>
                                {catMeta?.icon}
                              </span>
                              <input
                                className="flex-1 bg-transparent text-[11px] font-medium text-white/80 focus:outline-none focus:text-white truncate"
                                value={item.title}
                                onChange={(e) => updateItem(item.id, "title", e.target.value)}
                              />
                              <button
                                onClick={() => deleteItem(item.id)}
                                className="opacity-0 group-hover:opacity-100 text-white/10 hover:text-red-400"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            <textarea
                              className="w-full bg-transparent text-[10px] text-white/35 leading-relaxed resize-none focus:outline-none focus:text-white/60"
                              rows={2}
                              value={item.content}
                              onChange={(e) => updateItem(item.id, "content", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom stats */}
              {items.length > 0 && (
                <div className="shrink-0 px-4 py-2.5 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-white/20">{selectedCount}/{items.length} selected</span>
                  <button
                    onClick={() => setTab("build")}
                    className="px-4 py-1.5 rounded-lg bg-accent text-white text-[10px] font-medium hover:bg-accent/90"
                  >
                    Build Site →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ─── BUILD TAB ─── */}
          {tab === "build" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-[10px] text-white/20 mb-4">
                      Describe the site you want, or use a quick action:
                    </p>
                    <div className="space-y-1.5">
                      {[
                        "Build me a portfolio site",
                        "What site type fits my content?",
                        "Create a minimalist blog",
                        "Make a bold creative brand page",
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => { setChatInput(prompt); setTimeout(() => sendChat(prompt), 0); }}
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
                    <div className={`max-w-[90%] px-3 py-2 rounded-xl text-[11px] leading-relaxed ${
                      msg.role === "user" ? "bg-accent text-white" : "bg-white/[0.05] text-white/65"
                    }`}>
                      {msg.content.replace(/```action[\s\S]*?```/g, "").trim()}
                    </div>
                  </div>
                ))}

                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="px-4 py-2.5 rounded-xl bg-white/[0.05]">
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
              <div className="shrink-0 p-3 border-t border-white/5 space-y-2">
                {genStatus === "idle" && !previewUrl && items.length > 0 && (
                  <button
                    onClick={quickGenerate}
                    className="w-full py-2 rounded-lg bg-white/[0.03] border border-white/5 text-[10px] text-white/25 hover:text-accent hover:border-accent/20 transition-all"
                  >
                    ⚡ Quick generate with defaults
                  </button>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                    placeholder="Describe what you want..."
                    className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50"
                  />
                  <button
                    onClick={() => sendChat()}
                    disabled={!chatInput.trim() || chatLoading}
                    className="px-3 py-2 rounded-xl bg-accent text-white hover:bg-accent/90 disabled:opacity-30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ====== RIGHT: MAIN AREA ====== */}
        <div className="flex-1 flex flex-col bg-[#060606] overflow-hidden">
          {/* Preview when building */}
          {tab === "build" && genStatus === "generating" ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 mx-auto mb-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                <p className="text-sm text-white/25">Generating your website...</p>
              </div>
            </div>
          ) : tab === "build" && previewUrl ? (
            <>
              <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-white/[0.02] border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/50" />
                  <div className="w-3 h-3 rounded-full bg-green-400/50" />
                </div>
                <div className="flex-1 px-3 py-1 rounded-lg bg-white/5 text-xs text-white/30 truncate">{previewUrl}</div>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                  className="px-3 py-1 rounded-lg bg-white/5 text-xs text-white/40 hover:text-white hover:bg-white/10 transition-all">
                  Open ↗
                </a>
              </div>
              <iframe src={previewUrl} className="flex-1 w-full border-0 bg-white" title="Preview" />
            </>
          ) : (
            /* Default right panel — context-aware */
            <>
              {/* ── Sources tab: show pending review or empty state ── */}
              {tab === "sources" && pendingItems.length > 0 ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Header */}
                  <div className="shrink-0 px-5 py-3 border-b border-white/5 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Analysis Results</h3>
                      <p className="text-[10px] text-white/30 mt-0.5">
                        {pendingSourceName} — {pendingItems.length} items extracted. Review and edit before saving.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={discardPending}
                        className="px-3 py-1.5 rounded-lg bg-white/5 text-[10px] text-white/40 hover:text-white/60 hover:bg-white/10 transition-all"
                      >
                        Discard
                      </button>
                      <button
                        onClick={savePendingToKnowledge}
                        className="px-4 py-1.5 rounded-lg bg-accent text-white text-[10px] font-medium hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
                      >
                        Save {pendingItems.filter((i) => i.selected).length} items to Knowledge
                      </button>
                    </div>
                  </div>

                  {/* Category summary */}
                  <div className="shrink-0 px-5 py-2 border-b border-white/5 flex flex-wrap gap-1.5">
                    {(Object.keys(CATEGORY_META) as KnowledgeCategory[]).map((cat) => {
                      const count = pendingItems.filter((i) => i.category === cat).length;
                      if (count === 0) return null;
                      const meta = CATEGORY_META[cat];
                      return (
                        <span key={cat} className={`text-[10px] px-2 py-1 rounded-full ${meta.color}`}>
                          {meta.icon} {meta.label} ({count})
                        </span>
                      );
                    })}
                  </div>

                  {/* Pending items grid */}
                  <div className="flex-1 overflow-y-auto p-5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {pendingItems.map((item) => {
                        const catMeta = CATEGORY_META[item.category as KnowledgeCategory];
                        return (
                          <div
                            key={item.id}
                            className={`p-3.5 rounded-xl border transition-all group ${
                              item.selected ? "bg-white/[0.03] border-white/8" : "bg-white/[0.01] border-white/5 opacity-40"
                            }`}
                          >
                            <div className="flex items-start gap-2 mb-2">
                              <button
                                onClick={() => togglePendingItem(item.id)}
                                className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all ${
                                  item.selected ? "bg-accent border-accent" : "border-white/20 hover:border-accent/50"
                                }`}
                              >
                                {item.selected && (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <input
                                  className="w-full bg-transparent text-xs font-medium text-white/80 focus:outline-none focus:text-white"
                                  value={item.title}
                                  onChange={(e) => updatePendingItem(item.id, "title", e.target.value)}
                                />
                              </div>
                              <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full ${catMeta?.color || "bg-white/10 text-white/40"}`}>
                                {catMeta?.icon} {catMeta?.label}
                              </span>
                              <button
                                onClick={() => deletePendingItem(item.id)}
                                className="opacity-0 group-hover:opacity-100 text-white/15 hover:text-red-400 transition-all"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            <textarea
                              className="w-full bg-transparent text-[11px] text-white/50 leading-relaxed resize-none focus:outline-none focus:text-white/70"
                              rows={Math.min(5, Math.max(2, Math.ceil(item.content.length / 50)))}
                              value={item.content}
                              onChange={(e) => updatePendingItem(item.id, "content", e.target.value)}
                            />
                            {item.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {item.tags.map((tag, i) => (
                                  <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/25">{tag}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : tab === "sources" && sources.some((s) => s.status === "analyzing") ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    <h3 className="text-sm font-medium text-white/40 mb-1">Analyzing source...</h3>
                    <p className="text-xs text-white/20">AI is extracting knowledge from your content</p>
                  </div>
                </div>
              ) : tab === "sources" ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center max-w-md px-8">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                      <span className="text-3xl opacity-20">📎</span>
                    </div>
                    <h3 className="text-sm font-medium text-white/30 mb-2">Add Your Data Sources</h3>
                    <p className="text-xs text-white/15 leading-relaxed">
                      Upload PDFs, ZIPs, or paste links to Git repos, Bilibili and YouTube videos.
                      AI will analyze your content and extract structured knowledge.
                    </p>
                  </div>
                </div>
              ) : tab === "knowledge" ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center max-w-md px-8">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                      <span className="text-3xl opacity-20">📚</span>
                    </div>
                    <h3 className="text-sm font-medium text-white/30 mb-2">Your Knowledge Base</h3>
                    <p className="text-xs text-white/15 leading-relaxed">
                      {items.length === 0
                        ? "Add sources first. Knowledge items will appear here after analysis."
                        : `${items.length} items across ${Object.keys(categoryCounts).length} categories. Edit, organize, and select items to include in your website.`
                      }
                    </p>
                    {items.length > 0 && (
                      <div className="mt-6 flex flex-wrap justify-center gap-2">
                        {(Object.entries(categoryCounts) as [KnowledgeCategory, number][]).map(([cat, count]) => (
                          <span key={cat} className={`text-[10px] px-2 py-1 rounded-full ${CATEGORY_META[cat]?.color || "bg-white/10 text-white/30"}`}>
                            {CATEGORY_META[cat]?.icon} {CATEGORY_META[cat]?.label} ({count})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : tab === "build" ? (
                <StyleSelectorPanel />
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center max-w-md px-8">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center">
                      <svg className="w-8 h-8 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-medium text-white/30 mb-2">Website Preview</h3>
                    <p className="text-xs text-white/15 leading-relaxed">
                      {items.length === 0
                        ? "Add sources and build your knowledge base first."
                        : "Chat with AI or click quick generate to see your site here."
                      }
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Style Selector Panel (Build tab right side) ───
function StyleSelectorPanel() {
  const STYLE_THEMES = [
    { id: "cyberpunk", name: "Cyberpunk", desc: "Neon glow, particle animations", gradient: "from-purple-600 via-pink-500 to-cyan-500" },
    { id: "minimalist", name: "Minimalist", desc: "Clean whitespace, sharp typography", gradient: "from-gray-200 to-gray-400" },
    { id: "ghibli", name: "Ghibli", desc: "Watercolor, hand-drawn, warm organic", gradient: "from-green-400 via-emerald-300 to-sky-400" },
    { id: "glassmorphism", name: "Glassmorphism", desc: "Frosted glass, blur effects", gradient: "from-blue-400 via-violet-400 to-purple-500" },
    { id: "retro", name: "Retro", desc: "Film grain, vintage typography", gradient: "from-orange-300 via-yellow-200 to-amber-400" },
    { id: "brutalist", name: "Brutalist", desc: "Dark, monospace, dev-style", gradient: "from-gray-900 via-gray-800 to-gray-700" },
    { id: "cinematic", name: "Cinematic", desc: "Dramatic lighting, film grain", gradient: "from-amber-700 via-red-900 to-gray-900" },
    { id: "bold-creative", name: "Bold Creative", desc: "Vivid colors, oversized type", gradient: "from-yellow-400 via-red-500 to-pink-600" },
    { id: "editorial", name: "Editorial", desc: "Magazine typography, elegant serifs", gradient: "from-stone-200 via-amber-100 to-stone-300" },
    { id: "nature", name: "Nature", desc: "Earth tones, organic shapes", gradient: "from-green-700 via-emerald-600 to-lime-500" },
    { id: "gradient-mesh", name: "Gradient Mesh", desc: "Vivid gradients, flowing colors", gradient: "from-indigo-500 via-purple-500 to-pink-500" },
    { id: "neo-tokyo", name: "Neo Tokyo", desc: "Japanese urban, neon meets tradition", gradient: "from-red-600 via-pink-600 to-violet-700" },
    { id: "tpl-business", name: "Business Pro", desc: "Purple glassmorphism, bento grid", gradient: "from-violet-600 via-purple-700 to-indigo-800" },
    { id: "tpl-resume-bold", name: "Resume Bold", desc: "Pop art colors, thick borders", gradient: "from-pink-500 via-cyan-400 to-yellow-300" },
    { id: "tpl-resume-dark", name: "Resume Dark", desc: "Ultra-dark, ambient blobs", gradient: "from-gray-900 via-slate-800 to-zinc-900" },
    { id: "tpl-blog", name: "Blog Classic", desc: "Warm earthy, serif fonts", gradient: "from-amber-200 via-orange-100 to-stone-200" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 py-4 border-b border-white/5">
        <h3 className="text-sm font-medium">Style Themes</h3>
        <p className="text-[10px] text-white/25 mt-1">Choose a visual style or describe one in the chat</p>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {STYLE_THEMES.map((theme) => (
            <div
              key={theme.id}
              className="rounded-xl overflow-hidden border border-white/5 hover:border-accent/20 transition-all cursor-pointer group"
            >
              <div className={`h-20 bg-gradient-to-br ${theme.gradient} opacity-70 group-hover:opacity-100 transition-opacity`} />
              <div className="p-3">
                <h4 className="text-xs font-medium group-hover:text-accent transition-colors">{theme.name}</h4>
                <p className="text-[9px] text-white/25 mt-0.5">{theme.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Build WorkspaceData from knowledge items ───
function buildWorkspaceDataFromKnowledge(items: KnowledgeItem[]) {
  const get = (cat: string) => items.filter((i) => i.category === cat);
  const factual = get("factual");
  const skills = get("skills");
  const experience = get("experience");
  const media = get("media");
  const meta = get("meta");

  const nameItem = factual.find((i) => /name|姓名|称呼/i.test(i.title));
  const name = nameItem?.content || "Your Name";
  const titleItem = factual.find((i) => /title|职位|头衔|role/i.test(i.title));
  const title = titleItem?.content || "";
  const emailItem = factual.find((i) => /email|邮箱/i.test(i.title));
  const bioItem = meta.find((i) => /summary|简介|overview|bio/i.test(i.title));
  const bio = bioItem?.content || meta[0]?.content || "";

  return {
    name, nameEn: name, title, titleEn: title,
    email: emailItem?.content || "", location: "", locationEn: "",
    bio, bioEn: bio,
    bioTags: meta.flatMap((m) => m.tags).slice(0, 6),
    bioTagsEn: meta.flatMap((m) => m.tags).slice(0, 6),
    skills: skills.length > 0 ? [{ title: "Skills", skills: skills.map((s) => s.title) }] : [],
    skillsEn: skills.length > 0 ? [{ title: "Skills", skills: skills.map((s) => s.title) }] : [],
    projects: experience.filter((e) => /project|项目/i.test(e.title)).map((e) => ({
      title: e.title, org: "", desc: e.content.slice(0, 200), tags: e.tags, image: "", link: "",
    })),
    projectsEn: experience.filter((e) => /project|项目/i.test(e.title)).map((e) => ({
      title: e.title, org: "", desc: e.content.slice(0, 200), tags: e.tags, image: "", link: "",
    })),
    timeline: experience.filter((e) => !/project|项目/i.test(e.title)).map((e, i) => ({
      date: "", title: e.title, desc: e.content.slice(0, 200), active: i === 0,
    })),
    timelineEn: experience.filter((e) => !/project|项目/i.test(e.title)).map((e, i) => ({
      date: "", title: e.title, desc: e.content.slice(0, 200), active: i === 0,
    })),
    education: [], educationEn: [],
    tags: skills.map((s) => s.title).slice(0, 6),
    tagsEn: skills.map((s) => s.title).slice(0, 6),
    links: media.map((m) => ({ label: m.title, labelEn: m.title, url: m.content, icon: "website" })),
    visibleSections: [
      "about",
      ...(skills.length > 0 ? ["skills"] : []),
      ...(experience.length > 0 ? ["projects", "timeline"] : []),
      ...(media.length > 0 ? ["links"] : []),
    ],
    chatbotContext: items.map((i) => `${i.title}: ${i.content}`).join("\n"),
  };
}
