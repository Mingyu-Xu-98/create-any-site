"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useLocale } from "@/components/LocaleProvider";
import type { KnowledgeItem, Source, SourceType, KnowledgeCategory } from "@/lib/knowledge";
import { CATEGORY_META, SOURCE_TYPE_META } from "@/lib/knowledge";
import { getAutoLayout } from "@/lib/questions";
import { getImageTasks } from "@/lib/image-prompts";

type View = "build" | "sources" | "knowledge";
interface ChatMessage { role: "user" | "assistant"; content: string }
interface ConvSummary { id: string; siteId: string | null; title: string | null; updatedAt: string | null }
interface SourceGroup { sourceId: string; sourceName: string; sourceType: string; items: KnowledgeItem[] }

function CreatePageInner() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useLocale();

  const [view, setView] = useState<View>("build");

  // Conversation persistence
  const [conversationId, setConversationId] = useState<string | null>(null);
  const convIdRef = useRef<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [convList, setConvList] = useState<ConvSummary[]>([]);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  // Chat & Build
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [genStatus, setGenStatus] = useState<"idle" | "generating" | "ready">("idle");
  const [showPreview, setShowPreview] = useState(false);
  const [showKnowledgeSelector, setShowKnowledgeSelector] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Resizable
  const [splitPct, setSplitPct] = useState(50);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (!dragging.current || !containerRef.current) return; const r = containerRef.current.getBoundingClientRect(); const sideW = sidebarExpanded ? 224 : 56; const pct = Math.min(75, Math.max(25, ((e.clientX - r.left - sideW) / (r.width - sideW)) * 100)); setSplitPct(pct); };
    const onUp = () => { dragging.current = false; document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [sidebarExpanded]);

  // Sources
  const [sources, setSources] = useState<Source[]>([]);
  const [addMode, setAddMode] = useState<SourceType | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingItems, setPendingItems] = useState<KnowledgeItem[]>([]);
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null);
  const [pendingSourceName, setPendingSourceName] = useState("");
  const [pendingSourceType, setPendingSourceType] = useState("");
  const [saveError, setSaveError] = useState("");

  // Knowledge
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [knowledgeSearch, setKnowledgeSearch] = useState("");

  useEffect(() => { if (authStatus === "unauthenticated") router.push("/login"); }, [authStatus, router]);

  const loadKnowledge = useCallback(async () => {
    try { const r = await fetch("/api/knowledge"); if (r.ok) { const d = await r.json(); setItems(d.items || []); } } catch {}
    setItemsLoaded(true);
  }, []);

  useEffect(() => { if (session?.user) loadKnowledge(); }, [session, loadKnowledge]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  // Conv list
  const loadConvList = useCallback(async () => {
    try { const r = await fetch("/api/conversations"); if (r.ok) { const d = await r.json(); setConvList(d.conversations || []); } } catch {}
  }, []);
  useEffect(() => { if (session?.user) loadConvList(); }, [session, loadConvList]);

  // Restore from URL (run once on mount)
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !session?.user) return;
    const cid = searchParams.get("convId");
    const sid = searchParams.get("siteId");
    if (!cid && !sid) return;
    restoredRef.current = true;

    if (cid) {
      fetch(`/api/conversations/${cid}`).then(r => r.json()).then(d => {
        if (d.conversation) {
          convIdRef.current = cid; setConversationId(cid);
          setChatMessages(d.conversation.messages || []);
          if (d.conversation.siteId) setSiteId(d.conversation.siteId);
          if (d.conversation.previewUrl) { setPreviewUrl(d.conversation.previewUrl); setGenStatus("ready"); setShowPreview(true); }
        }
      });
    } else if (sid) {
      fetch("/api/conversations").then(r => r.json()).then(d => {
        const conv = (d.conversations || []).find((c: ConvSummary) => c.siteId === sid);
        if (conv) {
          fetch(`/api/conversations/${conv.id}`).then(r => r.json()).then(cd => {
            if (cd.conversation) {
              convIdRef.current = conv.id; setConversationId(conv.id); setSiteId(sid);
              setChatMessages(cd.conversation.messages || []);
              if (cd.conversation.previewUrl) { setPreviewUrl(cd.conversation.previewUrl); setGenStatus("ready"); }
            }
          });
        }
      });
    }
  }, [searchParams, session]);

  // Save conversation
  const saveConv = useCallback(async (msgs: ChatMessage[], preview?: string | null) => {
    if (msgs.length === 0) return;
    try {
      const cid = convIdRef.current;
      if (!cid) {
        const r = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: msgs, previewUrl: preview }) });
        const d = await r.json();
        if (d.id) { convIdRef.current = d.id; setConversationId(d.id); loadConvList(); }
        return d.id;
      } else {
        await fetch(`/api/conversations/${cid}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: msgs, previewUrl: preview }) });
        loadConvList(); return cid;
      }
    } catch {}
  }, [loadConvList]);

  // Auto-save site
  const autoSaveSite = useCallback(async (url: string, config: Record<string, unknown>, convId: string | null) => {
    try {
      if (!siteId) {
        const r = await fetch("/api/sites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: config.siteType === "blog" ? "My Blog" : "My Site", siteType: config.siteType || "portfolio", theme: config.theme || "minimalist", layout: config.layout || "card-grid", previewUrl: url }) });
        const d = await r.json();
        if (d.id) { setSiteId(d.id); if (convId) await fetch(`/api/conversations/${convId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteId: d.id }) }); }
      }
    } catch {}
  }, [siteId]);

  // ─── Source upload ───
  const addFileSource = async (file: File, type: SourceType) => {
    const sid = crypto.randomUUID();
    setSources(p => [...p, { id: sid, type, name: file.name, status: "analyzing", addedAt: new Date().toISOString() }]);
    setAddMode(null);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("type", type);
      const r = await fetch("/api/analyze-source", { method: "POST", body: fd });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      setPendingItems((d.items as KnowledgeItem[]).map(i => ({ ...i, sourceId: sid })));
      setPendingSourceId(sid); setPendingSourceName(file.name); setPendingSourceType(type);
      setSources(p => p.map(s => s.id === sid ? { ...s, status: "done" as const } : s));
    } catch (err) { setSources(p => p.map(s => s.id === sid ? { ...s, status: "error" as const, error: err instanceof Error ? err.message : "Failed" } : s)); }
  };
  const addUrlSource = async (url: string, type: SourceType) => {
    const sid = crypto.randomUUID();
    setSources(p => [...p, { id: sid, type, name: url, status: "analyzing", addedAt: new Date().toISOString() }]);
    setAddMode(null); setUrlInput("");
    try {
      const r = await fetch("/api/analyze-source", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, type }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      setPendingItems((d.items as KnowledgeItem[]).map(i => ({ ...i, sourceId: sid })));
      setPendingSourceId(sid); setPendingSourceName(url); setPendingSourceType(type);
      setSources(p => p.map(s => s.id === sid ? { ...s, status: "done" as const } : s));
    } catch (err) { setSources(p => p.map(s => s.id === sid ? { ...s, status: "error" as const, error: err instanceof Error ? err.message : "Failed" } : s)); }
  };
  const handleFile = (f: File) => { if (f.name.endsWith(".zip") || f.type.includes("zip")) addFileSource(f, "zip"); else if (f.name.endsWith(".pdf") || f.type.includes("pdf")) addFileSource(f, "pdf"); };
  const removeSource = async (id: string) => { setSources(p => p.filter(s => s.id !== id)); await fetch(`/api/knowledge?sourceId=${id}`, { method: "DELETE" }); await loadKnowledge(); };

  // Pending
  const togglePendingItem = (id: string) => setPendingItems(p => p.map(i => i.id === id ? { ...i, selected: !i.selected } : i));
  const savePendingToKB = async () => {
    const sel = pendingItems.filter(i => i.selected); if (sel.length === 0) return; setSaveError("");
    try {
      const r = await fetch("/api/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: sel, sourceId: pendingSourceId, sourceName: pendingSourceName, sourceType: pendingSourceType }) });
      const t = await r.text(); let d; try { d = JSON.parse(t); } catch { setSaveError("Server error"); return; }
      if (!r.ok) { setSaveError(d.error || "Failed"); return; }
      setPendingItems([]); setPendingSourceId(null); await loadKnowledge(); setView("knowledge");
    } catch (e) { setSaveError(e instanceof Error ? e.message : "Failed"); }
  };

  // Knowledge
  const toggleItem = async (id: string) => { const it = items.find(i => i.id === id); if (it) { setItems(p => p.map(i => i.id === id ? { ...i, selected: !i.selected } : i)); await fetch(`/api/knowledge/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selected: !it.selected }) }); } };
  const deleteItem = async (id: string) => { setItems(p => p.filter(i => i.id !== id)); await fetch(`/api/knowledge/${id}`, { method: "DELETE" }); };
  const toggleSourceGroup = async (sourceId: string) => {
    const group = items.filter(i => i.sourceId === sourceId);
    const allSelected = group.every(i => i.selected);
    const newVal = !allSelected;
    setItems(p => p.map(i => i.sourceId === sourceId ? { ...i, selected: newVal } : i));
    for (const it of group) { await fetch(`/api/knowledge/${it.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selected: newVal }) }); }
  };

  // Activated skills (Level 1 loaded)
  const [loadedSkillIds, setLoadedSkillIds] = useState<string[]>([]);

  // Chat
  const sendChat = async (overrideInput?: string) => {
    const msg = overrideInput || chatInput; if (!msg.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: msg };
    const newMsgs = [...chatMessages, userMsg];
    setChatMessages(newMsgs); setChatInput(""); setChatLoading(true);
    await saveConv(newMsgs);
    try {
      const r = await fetch("/api/chat-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMsgs.map(m => ({ role: m.role, content: m.content })),
          knowledge: items.filter(i => i.selected),
          currentSelections: {},
          loadedSkills: loadedSkillIds,
        }),
      });
      const d = await r.json();
      if (d.content) { const updated = [...newMsgs, { role: "assistant" as const, content: d.content }]; setChatMessages(updated); await saveConv(updated); }

      if (d.action?.type === "activate_skills" && Array.isArray(d.action.skillIds)) {
        // Progressive disclosure: add newly activated skill IDs
        setLoadedSkillIds(prev => [...new Set([...prev, ...d.action.skillIds])]);
      } else if (d.action?.type === "generate") {
        handleGenerate({ ...d.action, skillIds: [...new Set([...loadedSkillIds, ...(d.action.skillIds || [])])] });
      }
    } catch { setChatMessages(p => [...p, { role: "assistant", content: "Something went wrong." }]); }
    finally { setChatLoading(false); }
  };

  const handleGenerate = async (config: Record<string, unknown>) => {
    setGenStatus("generating");
    try {
      const sel = items.filter(i => i.selected);
      const data = buildWorkspaceDataFromKnowledge(sel);
      const theme = (config.theme as string) || "minimalist";
      const skillIds = Array.isArray(config.skillIds) ? config.skillIds : [];
      const selections = { siteType: (config.siteType as string) || "portfolio", theme, layout: (config.layout as string) || getAutoLayout(theme, (config.siteType as string) || "portfolio"), customSiteType: "", customTheme: (config.customTheme as string) || "", customLayout: "", features: { chatbot: true, i18n: true, animations: true, share: true } };
      const r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, selections, skillIds }) });
      if (!r.ok) throw new Error("Generation failed");
      const { url } = await r.json();
      const imageTasks = getImageTasks(theme as import("@/lib/types").ThemeStyle, data.name, data.projects.map((p: { title: string; tags: string[] }) => ({ title: p.title, tags: p.tags })));
      for (const task of imageTasks) { try { await fetch("/api/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: task.prompt, filename: task.filename, style: theme }) }); } catch {} }
      const start = Date.now(); while (Date.now() - start < 30000) { try { await fetch(url, { mode: "no-cors" }); break; } catch {} await new Promise(r => setTimeout(r, 1000)); }
      setPreviewUrl(url); setGenStatus("ready"); setShowPreview(true);
      const cid = await saveConv(chatMessages, url);
      await autoSaveSite(url, config, cid || convIdRef.current);
    } catch { setGenStatus("idle"); setChatMessages(p => [...p, { role: "assistant", content: "Generation failed." }]); }
  };

  const quickGenerate = () => handleGenerate({ siteType: "portfolio", theme: "minimalist" });
  const newConversation = () => { convIdRef.current = null; restoredRef.current = false; setConversationId(null); setSiteId(null); setChatMessages([]); setPreviewUrl(null); setGenStatus("idle"); router.replace("/create"); };

  if (authStatus === "loading" || !session?.user) return null;

  const selectedCount = items.filter(i => i.selected).length;
  const sourceGroups = getSourceGroups(items);

  // ─── NAV items ───
  const NAV = [
    { id: "build" as View, icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", label: locale === "zh" ? "构建" : "Build" },
    { id: "sources" as View, icon: "M12 4v16m8-8H4", label: locale === "zh" ? "数据源" : "Sources" },
    { id: "knowledge" as View, icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", label: locale === "zh" ? "知识库" : "Knowledge", badge: items.length || undefined },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar />
      <div className="flex-1 flex pt-14 overflow-hidden" ref={containerRef}>

        {/* ====== SIDEBAR ====== */}
        <div className={`shrink-0 border-r border-white/5 flex flex-col bg-[#0a0a0a] transition-all duration-200 ${sidebarExpanded ? "w-56" : "w-14"}`}>
          <div className={`flex items-center ${sidebarExpanded ? "px-3 py-2 justify-between" : "flex-col items-center py-3 gap-1"}`}>
            <button onClick={() => setSidebarExpanded(!sidebarExpanded)} className="w-10 h-10 rounded-xl flex items-center justify-center text-white/25 hover:bg-white/5 hover:text-white/50 transition-all">
              <svg className={`w-4 h-4 transition-transform ${sidebarExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            {sidebarExpanded && <button onClick={newConversation} className="px-2 py-1 rounded-lg bg-accent/20 text-accent text-[10px] hover:bg-accent/30">{locale === "zh" ? "+ 新对话" : "+ New"}</button>}
          </div>

          {/* Nav icons (collapsed) */}
          {!sidebarExpanded && <div className="flex flex-col items-center gap-1">{NAV.map(n => (
            <button key={n.id} onClick={() => setView(n.id)} className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${view === n.id ? "bg-accent/20 text-accent" : "text-white/25 hover:bg-white/5"}`} title={n.label}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={n.icon} /></svg>
              {n.badge && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent text-white text-[8px] flex items-center justify-center">{n.badge}</span>}
            </button>
          ))}</div>}

          {/* Expanded sidebar */}
          {sidebarExpanded && <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-2 py-1 space-y-0.5">{NAV.map(n => (
              <button key={n.id} onClick={() => setView(n.id)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] transition-all ${view === n.id ? "bg-accent/15 text-accent" : "text-white/35 hover:bg-white/5"}`}>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={n.icon} /></svg>
                {n.label}{n.badge && <span className="ml-auto text-[9px] px-1.5 rounded bg-white/10">{n.badge}</span>}
              </button>
            ))}</div>
            <div className="px-3 pt-3"><p className="text-[9px] text-white/20 uppercase tracking-wider mb-2">{locale === "zh" ? "对话记录" : "History"}</p></div>
            <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
              {convList.map(c => (
                <button key={c.id} onClick={() => { restoredRef.current = false; router.push(`/create?convId=${c.id}`); }} className={`w-full text-left px-3 py-2 rounded-lg transition-all ${conversationId === c.id ? "bg-white/[0.06] text-white/60" : "text-white/25 hover:bg-white/[0.03]"}`}>
                  <p className="text-[10px] truncate">{c.title || "Untitled"}</p>
                  <p className="text-[8px] text-white/15 mt-0.5">{c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : ""}{c.siteId ? " · 🌐" : ""}</p>
                </button>
              ))}
              {convList.length === 0 && <p className="text-[9px] text-white/10 text-center py-4">{locale === "zh" ? "暂无记录" : "No history"}</p>}
            </div>
          </div>}
        </div>

        {/* Global file input (always in DOM) */}
        <input ref={fileRef} type="file" accept=".pdf,.zip" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />

        {/* ====== BUILD VIEW ====== */}
        {view === "build" && <>
          {/* Chat */}
          <div className="flex flex-col overflow-hidden" style={{ width: showPreview ? `${splitPct}%` : "100%" }}>
            {/* Header */}
            <div className="shrink-0 px-4 py-2.5 border-b border-white/5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm font-medium shrink-0">{locale === "zh" ? "构建" : "Build"}</h2>
                {/* Knowledge selector button */}
                <div className="relative">
                  <button onClick={() => setShowKnowledgeSelector(!showKnowledgeSelector)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-[10px] text-white/40 hover:bg-white/10 transition-all">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    {locale === "zh" ? `知识库 (${selectedCount}/${items.length})` : `Knowledge (${selectedCount}/${items.length})`}
                    <svg className={`w-2.5 h-2.5 transition-transform ${showKnowledgeSelector ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {/* Knowledge dropdown */}
                  {showKnowledgeSelector && (
                    <div className="absolute top-full left-0 mt-1 w-72 max-h-80 rounded-xl bg-[#111] border border-white/10 shadow-2xl z-50 overflow-hidden">
                      <div className="p-3 border-b border-white/5">
                        <p className="text-[10px] text-white/30">{locale === "zh" ? "选择构建时使用的知识来源" : "Select knowledge sources for building"}</p>
                      </div>
                      <div className="overflow-y-auto max-h-60 p-2 space-y-1">
                        {sourceGroups.map(g => {
                          const allSel = g.items.every(i => i.selected);
                          const someSel = g.items.some(i => i.selected);
                          return (
                            <button key={g.sourceId} onClick={() => toggleSourceGroup(g.sourceId)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${allSel ? "bg-accent/10" : "hover:bg-white/5"}`}>
                              <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${allSel ? "bg-accent border-accent" : someSel ? "bg-accent/40 border-accent/60" : "border-white/20"}`}>
                                {(allSel || someSel) && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={allSel ? "M5 13l4 4L19 7" : "M5 12h14"} /></svg>}
                              </div>
                              <span className="text-sm">{SOURCE_TYPE_META[g.sourceType as SourceType]?.icon || "📎"}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-white/60 truncate">{g.sourceName}</p>
                                <p className="text-[8px] text-white/20">{g.items.filter(i => i.selected).length}/{g.items.length} {locale === "zh" ? "条" : "items"}</p>
                              </div>
                            </button>
                          );
                        })}
                        {sourceGroups.length === 0 && <p className="text-[9px] text-white/15 text-center py-4">{locale === "zh" ? "暂无知识库数据" : "No knowledge"}</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {genStatus === "idle" && items.length > 0 && <button onClick={quickGenerate} className="px-3 py-1.5 rounded-lg bg-accent/20 text-[10px] text-accent hover:bg-accent/30">{locale === "zh" ? "⚡ 快速生成" : "⚡ Quick Gen"}</button>}
                <button onClick={() => setShowPreview(!showPreview)} className={`px-2.5 py-1.5 rounded-lg text-[10px] transition-all ${showPreview ? "bg-white/5 text-white/30" : "bg-accent/10 text-accent"}`}>
                  {showPreview ? (locale === "zh" ? "隐藏预览" : "Hide") : (locale === "zh" ? "显示预览" : "Show")}
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" onClick={() => setShowKnowledgeSelector(false)}>
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  </div>
                  <p className="text-sm text-white/30 mb-1">{locale === "zh" ? "描述你想创建的网站" : "Describe the site you want"}</p>

                  {/* New user guidance: show step hints when no knowledge */}
                  {items.length === 0 ? (
                    <div className="mb-6 max-w-sm">
                      <p className="text-[10px] text-white/15 mb-4">{locale === "zh" ? "你可以直接描述需求，或先添加数据源让 AI 更了解你" : "Describe what you need, or add sources first for better results"}</p>
                      {/* Step hints */}
                      <div className="flex items-center gap-3 mb-4 px-3">
                        <div className="flex items-center gap-1.5 text-[9px]">
                          <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold">1</span>
                          <span className="text-white/25">{locale === "zh" ? "添加数据源" : "Add sources"}</span>
                        </div>
                        <svg className="w-3 h-3 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        <div className="flex items-center gap-1.5 text-[9px]">
                          <span className="w-5 h-5 rounded-full bg-white/5 text-white/25 flex items-center justify-center font-bold">2</span>
                          <span className="text-white/25">{locale === "zh" ? "整理知识库" : "Organize KB"}</span>
                        </div>
                        <svg className="w-3 h-3 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        <div className="flex items-center gap-1.5 text-[9px]">
                          <span className="w-5 h-5 rounded-full bg-white/5 text-white/25 flex items-center justify-center font-bold">3</span>
                          <span className="text-white/25">{locale === "zh" ? "对话构建" : "Build via chat"}</span>
                        </div>
                      </div>
                      <button onClick={() => setView("sources")} className="px-4 py-2 rounded-lg bg-white/[0.05] border border-white/8 text-[10px] text-white/40 hover:text-accent hover:border-accent/20 transition-all">
                        {locale === "zh" ? "📎 先去添加数据源（推荐）" : "📎 Add data sources first (recommended)"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-white/15 mb-6 max-w-sm">
                      {locale === "zh" ? `已加载 ${selectedCount} 条知识，AI 将结合知识库内容帮你构建` : `${selectedCount} knowledge items loaded, AI will use them to build`}
                    </p>
                  )}

                  <div className="space-y-1.5 w-full max-w-xs">
                    <p className="text-[9px] text-white/15 mb-1">{locale === "zh" ? "快速开始：" : "Quick start:"}</p>
                    {(locale === "zh"
                      ? ["帮我搭建一个个人作品集网站", "我想做一个极简风格的博客", "根据知识库内容推荐网站类型", "创建一个科技感品牌官网"]
                      : ["Build me a personal portfolio", "Create a minimalist blog", "Recommend a site type for my content", "Build a tech-style brand website"]
                    ).map(p => (
                      <button key={p} onClick={() => sendChat(p)} className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-[11px] text-white/35 hover:text-white/60 hover:bg-white/[0.06] transition-all text-left">{p}</button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-[12px] leading-relaxed ${msg.role === "user" ? "bg-accent text-white" : "bg-white/[0.05] text-white/65"}`}>
                    <div className="whitespace-pre-wrap">{msg.content.replace(/```action[\s\S]*?```/g, "").trim()}</div>
                  </div>
                </div>
              ))}
              {chatLoading && <div className="flex justify-start"><div className="px-4 py-3 rounded-xl bg-white/[0.05]"><div className="flex gap-1"><div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" /><div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" style={{ animationDelay: "0.2s" }} /><div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" style={{ animationDelay: "0.4s" }} /></div></div></div>}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 px-5 py-3 border-t border-white/5">
              <div className="flex gap-2">
                <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }} placeholder={locale === "zh" ? "描述你的需求..." : "Describe what you want..."} className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50" />
                <button onClick={() => sendChat()} disabled={!chatInput.trim() || chatLoading} className="px-4 py-2.5 rounded-xl bg-accent text-white hover:bg-accent/90 disabled:opacity-30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </div>
            </div>
          </div>

          {/* Splitter + Preview */}
          {showPreview && <>
            <div onMouseDown={() => { dragging.current = true; document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }} className="w-1 shrink-0 bg-white/5 hover:bg-accent/30 cursor-col-resize transition-colors" />
            <div className="flex flex-col bg-[#060606] overflow-hidden" style={{ width: `${100 - splitPct}%` }}>
              {genStatus === "generating" ? (
                <div className="flex-1 flex items-center justify-center"><div className="text-center"><div className="w-10 h-10 mx-auto mb-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /><p className="text-sm text-white/25">{locale === "zh" ? "正在生成网站..." : "Generating..."}</p></div></div>
              ) : previewUrl ? (
                <>
                  <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-white/[0.02] border-b border-white/5">
                    <div className="flex gap-1"><div className="w-2.5 h-2.5 rounded-full bg-red-400/50" /><div className="w-2.5 h-2.5 rounded-full bg-yellow-400/50" /><div className="w-2.5 h-2.5 rounded-full bg-green-400/50" /></div>
                    <div className="flex-1 px-2 py-0.5 rounded bg-white/5 text-[10px] text-white/25 truncate">{previewUrl}</div>
                    <button onClick={() => quickGenerate()} className="px-2 py-1 rounded text-[9px] text-white/25 bg-white/5 hover:bg-white/10 hover:text-white/50 transition-all">{locale === "zh" ? "重新生成" : "Regenerate"}</button>
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded text-[9px] text-white/25 bg-white/5 hover:bg-white/10 hover:text-white/50 transition-all">↗ {locale === "zh" ? "新窗口" : "Open"}</a>
                  </div>
                  <iframe src={previewUrl} className="flex-1 w-full border-0 bg-white" title="Preview" />
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center"><p className="text-sm text-white/15">{locale === "zh" ? "在对话中描述你的网站" : "Describe your site in chat"}</p></div>
              )}
            </div>
          </>}
        </>}

        {/* ====== SOURCES VIEW (full width) ====== */}
        {view === "sources" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="shrink-0 px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <div><h2 className="text-lg font-bold">{locale === "zh" ? "数据源管理" : "Source Management"}</h2><p className="text-xs text-white/25 mt-0.5">{locale === "zh" ? "上传文件或添加链接，AI 将分析内容并提取知识" : "Upload files or add links, AI will analyze and extract knowledge"}</p></div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {/* Drag & drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("border-accent", "bg-accent/5"); }}
                  onDragLeave={e => { e.currentTarget.classList.remove("border-accent", "bg-accent/5"); }}
                  onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove("border-accent", "bg-accent/5"); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  onClick={() => { setAddMode("pdf"); setTimeout(() => fileRef.current?.click(), 100); }}
                  className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center cursor-pointer hover:border-white/20 transition-all"
                >
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/5 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  </div>
                  <p className="text-sm text-white/40">{locale === "zh" ? "拖拽文件到此处，或点击上传" : "Drop files here, or click to upload"}</p>
                  <p className="text-[10px] text-white/15 mt-1">{locale === "zh" ? "支持 PDF、ZIP 文件" : "Supports PDF and ZIP files"}</p>
                </div>

                {/* Source type buttons for URLs */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/20 shrink-0">{locale === "zh" ? "或添加链接：" : "Or add links:"}</span>
                  {(Object.keys(SOURCE_TYPE_META) as SourceType[]).filter(t => !["pdf", "zip"].includes(t)).map(type => {
                    const m = SOURCE_TYPE_META[type];
                    return <button key={type} onClick={() => setAddMode(addMode === type ? null : type)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all ${addMode === type ? "bg-accent/20 text-accent border border-accent/30" : "bg-white/[0.03] text-white/40 border border-transparent hover:bg-white/[0.06]"}`}><span>{m.icon}</span><span>{m.label}</span></button>;
                  })}
                </div>

                {addMode && !["pdf", "zip"].includes(addMode) && (
                  <div className="flex gap-3"><input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder={SOURCE_TYPE_META[addMode].placeholder} className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50" onKeyDown={e => { if (e.key === "Enter" && urlInput.trim()) addUrlSource(urlInput.trim(), addMode); }} /><button onClick={() => urlInput.trim() && addUrlSource(urlInput.trim(), addMode)} className="px-6 py-3 rounded-xl bg-accent text-white text-sm">添加</button></div>
                )}

                {/* Active uploads */}
                {sources.length > 0 && <div className="space-y-2">{sources.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-lg">{SOURCE_TYPE_META[s.type].icon}</span>
                    <div className="flex-1"><p className="text-sm text-white/60">{s.name}</p><p className={`text-xs ${s.status === "done" ? "text-green-400" : s.status === "error" ? "text-red-400" : "text-accent"}`}>{s.status === "analyzing" ? "分析中..." : s.status === "done" ? "已完成" : s.error || "等待中"}</p></div>
                    {s.status === "analyzing" && <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />}
                  </div>
                ))}</div>}

                {/* Pending review */}
                {pendingItems.length > 0 && (
                  <div className="rounded-xl border border-accent/20 bg-accent/5 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">{locale === "zh" ? `解析完成 — ${pendingItems.filter(i => i.selected).length} 条待保存` : `Parsed — ${pendingItems.filter(i => i.selected).length} items to save`}</h3>
                      <div className="flex gap-2">
                        <button onClick={() => setPendingItems([])} className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-white/40">{locale === "zh" ? "丢弃" : "Discard"}</button>
                        <button onClick={savePendingToKB} className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs">{locale === "zh" ? "保存到知识库" : "Save to Knowledge"}</button>
                      </div>
                    </div>
                    {saveError && <p className="text-xs text-red-400">{saveError}</p>}
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {pendingItems.map(it => (
                        <div key={it.id} className={`flex items-start gap-2 p-2 rounded-lg ${it.selected ? "bg-white/[0.03]" : "opacity-30"}`}>
                          <button onClick={() => togglePendingItem(it.id)} className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center ${it.selected ? "bg-accent border-accent" : "border-white/20"}`}>{it.selected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</button>
                          <div className="flex-1 min-w-0"><p className="text-xs text-white/60 truncate">{it.title}</p><p className="text-[10px] text-white/25 mt-0.5 line-clamp-1">{it.content}</p></div>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${CATEGORY_META[it.category as KnowledgeCategory]?.color}`}>{CATEGORY_META[it.category as KnowledgeCategory]?.icon}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Existing sources */}
                {sourceGroups.length > 0 && <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white/40">{locale === "zh" ? "已有数据源" : "Existing Sources"}</h3>
                  {sourceGroups.map(g => (
                    <div key={g.sourceId} className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 group">
                      <span className="text-lg">{SOURCE_TYPE_META[g.sourceType as SourceType]?.icon || "📎"}</span>
                      <div className="flex-1"><p className="text-sm text-white/50">{g.sourceName}</p><p className="text-[10px] text-white/20">{g.items.length} {locale === "zh" ? "条知识" : "items"}</p></div>
                      <button onClick={() => { if (confirm(locale === "zh" ? "确认删除该数据源及其所有知识？" : "Delete this source and all its knowledge?")) removeSource(g.sourceId); }} className="opacity-0 group-hover:opacity-100 px-3 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs">{locale === "zh" ? "删除" : "Remove"}</button>
                    </div>
                  ))}
                </div>}
              </div>
            </div>
          </div>
        )}

        {/* ====== KNOWLEDGE VIEW (full width, grouped by source) ====== */}
        {view === "knowledge" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="shrink-0 px-6 py-4 border-b border-white/5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">{locale === "zh" ? "知识库" : "Knowledge Base"}</h2>
                <p className="text-xs text-white/25 mt-0.5">{selectedCount}/{items.length} {locale === "zh" ? "条已选中用于构建" : "selected for building"}</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="text" placeholder={locale === "zh" ? "搜索知识..." : "Search..."} value={knowledgeSearch} onChange={e => setKnowledgeSearch(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-accent/50 w-48" />
                <button onClick={() => { const all = items.every(i => i.selected); items.forEach(i => toggleItem(i.id)); }} className="px-3 py-1.5 rounded-lg bg-white/5 text-[10px] text-white/30 hover:bg-white/10 transition-all">
                  {items.every(i => i.selected) ? (locale === "zh" ? "全部取消" : "Deselect all") : (locale === "zh" ? "全部选择" : "Select all")}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {!itemsLoaded ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}</div>
              : items.length === 0 ? <div className="text-center py-20 text-white/15">{locale === "zh" ? "暂无知识。前往数据源添加内容。" : "No knowledge. Add sources first."}</div>
              : (
                <div className="max-w-4xl mx-auto space-y-6">
                  {sourceGroups.map(g => {
                    // Apply search filter
                    const filteredGroupItems = knowledgeSearch ? g.items.filter(i => i.title.toLowerCase().includes(knowledgeSearch.toLowerCase()) || i.content.toLowerCase().includes(knowledgeSearch.toLowerCase())) : g.items;
                    if (filteredGroupItems.length === 0) return null;
                    const allSel = filteredGroupItems.every(i => i.selected);
                    const someSel = filteredGroupItems.some(i => i.selected);
                    const catCounts = g.items.reduce<Record<string, number>>((a, i) => { a[i.category] = (a[i.category] || 0) + 1; return a; }, {});
                    return (
                      <div key={g.sourceId} className="rounded-xl border border-white/5 overflow-hidden">
                        {/* Source header (acts as index.md) */}
                        <div className="px-5 py-4 bg-white/[0.02] border-b border-white/5">
                          <div className="flex items-center gap-3 mb-2">
                            <button onClick={() => toggleSourceGroup(g.sourceId)} className={`w-5 h-5 rounded border shrink-0 flex items-center justify-center ${allSel ? "bg-accent border-accent" : someSel ? "bg-accent/40 border-accent/60" : "border-white/20"}`}>
                              {(allSel || someSel) && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={allSel ? "M5 13l4 4L19 7" : "M5 12h14"} /></svg>}
                            </button>
                            <span className="text-xl">{SOURCE_TYPE_META[g.sourceType as SourceType]?.icon || "📎"}</span>
                            <div className="flex-1">
                              <h3 className="text-sm font-semibold text-white/70">{g.sourceName}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-white/25">{g.items.filter(i => i.selected).length}/{g.items.length} {locale === "zh" ? "条已选" : "selected"}</span>
                                <span className="text-[10px] text-white/15">·</span>
                                {Object.entries(catCounts).map(([cat, count]) => (
                                  <span key={cat} className={`text-[9px] px-1.5 py-0.5 rounded ${CATEGORY_META[cat as KnowledgeCategory]?.color}`}>{CATEGORY_META[cat as KnowledgeCategory]?.icon} {count}</span>
                                ))}
                              </div>
                              {/* Index summary */}
                              <p className="text-[10px] text-white/20 mt-2 leading-relaxed">
                                {locale === "zh"
                                  ? `来源类型：${g.sourceType.toUpperCase()} | 包含 ${Object.entries(catCounts).map(([c, n]) => `${CATEGORY_META[c as KnowledgeCategory]?.labelCn || c} ${n}条`).join("、")}`
                                  : `Type: ${g.sourceType.toUpperCase()} | Contains ${Object.entries(catCounts).map(([c, n]) => `${n} ${CATEGORY_META[c as KnowledgeCategory]?.label || c}`).join(", ")}`
                                }
                              </p>
                            </div>
                            <button onClick={() => { if (confirm(locale === "zh" ? "确认删除该数据源及其所有知识？" : "Delete this source and all its knowledge?")) removeSource(g.sourceId); }} className="px-3 py-1 rounded-lg bg-red-500/10 text-red-400 text-[10px] opacity-50 hover:opacity-100 transition-all">{locale === "zh" ? "删除" : "Remove"}</button>
                          </div>
                        </div>
                        {/* Items (inline editable) */}
                        <div className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-2">
                          {filteredGroupItems.map(it => {
                            const cm = CATEGORY_META[it.category as KnowledgeCategory];
                            return (
                              <div key={it.id} className={`p-3 rounded-lg transition-all group ${it.selected ? "bg-white/[0.02]" : "opacity-30"}`}>
                                <div className="flex items-start gap-2">
                                  <button onClick={() => toggleItem(it.id)} className={`mt-0.5 w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center ${it.selected ? "bg-accent border-accent" : "border-white/20"}`}>{it.selected && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</button>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1 mb-1">
                                      <span className={`text-[8px] px-1 py-0.5 rounded ${cm?.color}`}>{cm?.icon}</span>
                                      <input className="flex-1 bg-transparent text-[11px] font-medium text-white/60 focus:outline-none focus:text-white/80 truncate" value={it.title}
                                        onChange={e => { setItems(p => p.map(i => i.id === it.id ? { ...i, title: e.target.value } : i)); }}
                                        onBlur={e => { fetch(`/api/knowledge/${it.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: e.target.value }) }); }} />
                                    </div>
                                    <textarea className="w-full bg-transparent text-[10px] text-white/25 leading-relaxed resize-none focus:outline-none focus:text-white/50" rows={2} value={it.content}
                                      onChange={e => { setItems(p => p.map(i => i.id === it.id ? { ...i, content: e.target.value } : i)); }}
                                      onBlur={e => { fetch(`/api/knowledge/${it.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: e.target.value }) }); }} />
                                  </div>
                                  <button onClick={() => { if (confirm(locale === "zh" ? "确认删除？" : "Delete this item?")) deleteItem(it.id); }} className="opacity-0 group-hover:opacity-100 text-white/10 hover:text-red-400"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreatePage() {
  return <Suspense fallback={null}><CreatePageInner /></Suspense>;
}

// ─── Helpers ───
function getSourceGroups(items: KnowledgeItem[]): SourceGroup[] {
  const groups: SourceGroup[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const key = item.sourceId || "__none__";
    if (!seen.has(key)) {
      seen.add(key);
      groups.push({ sourceId: key, sourceName: item.sourceName || "Ungrouped", sourceType: item.sourceType || "", items: [] });
    }
    groups.find(g => g.sourceId === key)!.items.push(item);
  }
  return groups;
}

function buildWorkspaceDataFromKnowledge(items: KnowledgeItem[]) {
  const get = (cat: string) => items.filter(i => i.category === cat);
  const factual = get("factual"); const skills = get("skills"); const experience = get("experience"); const media = get("media"); const meta = get("meta");
  const name = factual.find(i => /name|姓名/i.test(i.title))?.content || "Your Name";
  const title = factual.find(i => /title|职位|头衔|role/i.test(i.title))?.content || "";
  const email = factual.find(i => /email|邮箱/i.test(i.title))?.content || "";
  const bio = meta.find(i => /summary|简介|overview|bio/i.test(i.title))?.content || meta[0]?.content || "";
  return {
    name, nameEn: name, title, titleEn: title, email, location: "", locationEn: "", bio, bioEn: bio,
    bioTags: meta.flatMap(m => m.tags).slice(0, 6), bioTagsEn: meta.flatMap(m => m.tags).slice(0, 6),
    skills: skills.length > 0 ? [{ title: "Skills", skills: skills.map(s => s.title) }] : [],
    skillsEn: skills.length > 0 ? [{ title: "Skills", skills: skills.map(s => s.title) }] : [],
    projects: experience.filter(e => /project|项目/i.test(e.title)).map(e => ({ title: e.title, org: "", desc: e.content.slice(0, 200), tags: e.tags, image: "", link: "" })),
    projectsEn: experience.filter(e => /project|项目/i.test(e.title)).map(e => ({ title: e.title, org: "", desc: e.content.slice(0, 200), tags: e.tags, image: "", link: "" })),
    timeline: experience.filter(e => !/project|项目/i.test(e.title)).map((e, i) => ({ date: "", title: e.title, desc: e.content.slice(0, 200), active: i === 0 })),
    timelineEn: experience.filter(e => !/project|项目/i.test(e.title)).map((e, i) => ({ date: "", title: e.title, desc: e.content.slice(0, 200), active: i === 0 })),
    education: [], educationEn: [],
    tags: skills.map(s => s.title).slice(0, 6), tagsEn: skills.map(s => s.title).slice(0, 6),
    links: media.map(m => ({ label: m.title, labelEn: m.title, url: m.content, icon: "website" })),
    visibleSections: ["about", ...(skills.length > 0 ? ["skills"] : []), ...(experience.length > 0 ? ["projects", "timeline"] : []), ...(media.length > 0 ? ["links"] : [])],
    chatbotContext: items.map(i => `${i.title}: ${i.content}`).join("\n"),
  };
}
