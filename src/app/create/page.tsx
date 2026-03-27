"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useLocale } from "@/components/LocaleProvider";
import type { KnowledgeItem, Source, SourceType, KnowledgeCategory } from "@/lib/knowledge";
import type { UserSelections } from "@/lib/types";
import { CATEGORY_META, SOURCE_TYPE_META } from "@/lib/knowledge";
import { getAutoLayout } from "@/lib/questions";
import { getImageTasks } from "@/lib/image-prompts";
import { buildWorkspaceDataFromKnowledge, buildWorkspaceDataFromSpec, deriveSelectionsFromSpec, type SiteSpec } from "@/lib/site-spec";
import { TEMPLATE_CASES } from "@/lib/template-showcase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type View = "build" | "sources" | "knowledge";
interface ChatMessage { role: "user" | "assistant"; content: string }
interface OptionCard { id: string; icon: string; label: string; desc: string }
interface PRDData { version?: number; siteType?: string; targetAudience?: string; coreGoal?: string; theme?: string; layout?: string; planner?: string; markdown?: string; [key: string]: unknown }
interface ConvSummary { id: string; siteId: string | null; title: string | null; updatedAt: string | null }
interface SourceGroup { sourceId: string; sourceName: string; sourceType: string; items: KnowledgeItem[] }
interface SiteResourceRef { id: string; title: string; category: string; sourceName: string; sourceType: string }
interface GuidanceAction { label: string; onClick: () => void; tone?: "accent" | "muted" }
interface NextStepCard { label: string; prompt?: string; onClick?: () => void }

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 220) || "(empty response)";
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${snippet}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 220) || "(invalid json)";
    throw new Error(`Invalid JSON response: ${snippet}`);
  }
}

function CreatePageInner() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useLocale();
  const templateId = searchParams.get("template");
  const selectedTemplate = TEMPLATE_CASES.find((item) => item.id === templateId) || null;

  const [view, setView] = useState<View>("build");

  // Conversation persistence
  const [conversationId, setConversationId] = useState<string | null>(null);
  const convIdRef = useRef<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const siteIdRef = useRef<string | null>(null);
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
  const [previewTab, setPreviewTab] = useState<"preview" | "prd" | "resources">("preview");
  const [workingStatus, setWorkingStatus] = useState("");
  const [prdData, setPrdData] = useState<PRDData | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [pendingOptions, setPendingOptions] = useState<{ question: string; options: OptionCard[]; multiSelect: boolean } | null>(null);
  const [multiSelectValues, setMultiSelectValues] = useState<string[]>([]);
  const [customOptionInput, setCustomOptionInput] = useState("");
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [compiledSpec, setCompiledSpec] = useState<SiteSpec | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [siteStatus, setSiteStatus] = useState<"draft" | "published" | "archived">("draft");
  const [siteResources, setSiteResources] = useState<SiteResourceRef[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const appliedTemplateIdRef = useRef("");

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

  // Knowledge Groups
  interface KGGroup { id: string; name: string; description: string | null; tags: string[]; sourceFile: string | null; sourceType: string | null; indexMd: string | null; itemCount: number; selectedCount: number; categoryCounts: Record<string, number> }
  const [kGroups, setKGroups] = useState<KGGroup[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [groupItems, setGroupItems] = useState<KnowledgeItem[]>([]);
  const [loadedSkillIds, setLoadedSkillIds] = useState<string[]>([]);

  useEffect(() => { if (authStatus === "unauthenticated") router.push("/login"); }, [authStatus, router]);

  const loadKnowledge = useCallback(async () => {
    try { const r = await fetch("/api/knowledge"); if (r.ok) { const d = await r.json(); setItems(d.items || []); } } catch {}
    setItemsLoaded(true);
  }, []);

  const loadGroups = useCallback(async () => {
    try { const r = await fetch("/api/knowledge-groups"); if (r.ok) { const d = await r.json(); setKGroups(d.groups || []); } } catch {}
  }, []);

  useEffect(() => { if (session?.user) { loadKnowledge(); loadGroups(); } }, [session, loadKnowledge, loadGroups]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, pendingOptions, prdData]);

  // Conv list
  const loadConvList = useCallback(async () => {
    try { const r = await fetch("/api/conversations"); if (r.ok) { const d = await r.json(); setConvList(d.conversations || []); } } catch {}
  }, []);
  useEffect(() => { if (session?.user) loadConvList(); }, [session, loadConvList]);

  useEffect(() => {
    if (!session?.user || !selectedTemplate) return;
    if (searchParams.get("convId") || searchParams.get("siteId")) return;
    if (appliedTemplateIdRef.current === selectedTemplate.id) return;

    const seededPrd: PRDData = {
      version: 1,
      siteType: selectedTemplate.category,
      theme: selectedTemplate.theme,
      layout: selectedTemplate.layout,
      markdown: locale === "zh" ? selectedTemplate.mockPrdCn : selectedTemplate.mockPrd,
      createdAt: new Date().toISOString(),
    };

    const seedMessage = locale === "zh"
      ? `已载入模板「${selectedTemplate.nameCn}」，右侧先展示模板预览，并附带一份 mock PRD 与默认内容结构。你现在可以直接在左侧补充你的真实信息，例如项目、品牌介绍、文章方向、服务内容，我会基于这个模板继续改。`
      : `Loaded the "${selectedTemplate.name}" template. The right side now shows the template preview with a mock PRD and starter content structure. Add your real projects, brand details, writing topics, or services in the chat and I will adapt the site from this template.`;

    appliedTemplateIdRef.current = selectedTemplate.id;
    setChatMessages([{ role: "assistant", content: seedMessage }]);
    setPrdData(seededPrd);
    setPreviewUrl(selectedTemplate.previewUrl);
    setShowPreview(true);
    setPreviewTab("preview");
    setGenStatus("ready");
    setPublishedUrl(null);
    setSiteStatus("draft");
    setCompiledSpec(null);
    setSiteResources(selectedTemplate.mockResources);
    setThinkingSteps([]);
    setPendingOptions(null);
  }, [locale, searchParams, selectedTemplate, session]);

  // Restore from URL - track which convId/siteId we last restored to avoid duplicate loads
  const lastRestoredKey = useRef<string>("");
  useEffect(() => {
    if (!session?.user) return;
    const cid = searchParams.get("convId");
    const sid = searchParams.get("siteId");
    if (!cid && !sid) return;
    setView("build");
    const key = `${cid || ""}_${sid || ""}`;
    if (lastRestoredKey.current === key) return;
    lastRestoredKey.current = key;

    // Reset state before loading new conversation
    setChatMessages([]); setPrdData(null); setCompiledSpec(null); setPreviewUrl(null); setPublishedUrl(null); setSiteStatus("draft"); setSiteResources([]); setGenStatus("idle"); setShowPreview(false);
    setPendingOptions(null); setThinkingSteps([]); setLoadedSkillIds([]);

    if (cid) {
      fetch(`/api/conversations/${cid}`).then(r => r.json()).then(d => {
        if (d.conversation) {
          convIdRef.current = cid; setConversationId(cid);
          setChatMessages(d.conversation.messages || []);
          if (d.conversation.siteId) {
            siteIdRef.current = d.conversation.siteId; setSiteId(d.conversation.siteId);
            fetch(`/api/sites/${d.conversation.siteId}`).then(r => r.json()).then(sd => {
              if (sd.site?.prd) { try { setPrdData(JSON.parse(sd.site.prd)); } catch {} }
              if (sd.site?.publishedUrl) setPublishedUrl(sd.site.publishedUrl);
              if (sd.site?.status) setSiteStatus(sd.site.status as "draft" | "published" | "archived");
              if (sd.site?.editorState) {
                try {
                  const editorState = JSON.parse(sd.site.editorState);
                  if (editorState?.compiledSpec) setCompiledSpec(editorState.compiledSpec);
                  if (Array.isArray(editorState?.knowledgeRefs)) setSiteResources(editorState.knowledgeRefs);
                } catch {}
              }
            });
          }
          if (d.conversation.previewUrl) { setPreviewUrl(d.conversation.previewUrl); setGenStatus("ready"); setShowPreview(true); }
        }
      });
    } else if (sid) {
      fetch("/api/conversations").then(r => r.json()).then(d => {
        const conv = (d.conversations || []).find((c: ConvSummary) => c.siteId === sid);
        if (conv) {
          fetch(`/api/conversations/${conv.id}`).then(r => r.json()).then(cd => {
            if (cd.conversation) {
              convIdRef.current = conv.id; setConversationId(conv.id); siteIdRef.current = sid; setSiteId(sid);
              setChatMessages(cd.conversation.messages || []);
              fetch(`/api/sites/${sid}`).then(r => r.json()).then(sd => {
                if (sd.site?.prd) { try { setPrdData(JSON.parse(sd.site.prd)); } catch {} }
                if (sd.site?.publishedUrl) setPublishedUrl(sd.site.publishedUrl);
                if (sd.site?.status) setSiteStatus(sd.site.status as "draft" | "published" | "archived");
                if (sd.site?.editorState) {
                  try {
                    const editorState = JSON.parse(sd.site.editorState);
                    if (editorState?.compiledSpec) setCompiledSpec(editorState.compiledSpec);
                    if (Array.isArray(editorState?.knowledgeRefs)) setSiteResources(editorState.knowledgeRefs);
                  } catch {}
                }
              });
              if (cd.conversation.previewUrl) { setPreviewUrl(cd.conversation.previewUrl); setGenStatus("ready"); setShowPreview(true); }
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

  const getSelectedResourceRefs = useCallback((): SiteResourceRef[] => {
    return items
      .filter((item) => item.selected)
      .map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        sourceName: item.sourceName || (locale === "zh" ? "未命名来源" : "Untitled source"),
        sourceType: item.sourceType || "unknown",
      }));
  }, [items, locale]);

  // Auto-save site (with fileMap)
  const autoSaveSite = useCallback(async (
    url: string,
    config: Record<string, unknown>,
    convId: string | null,
    fileMap?: Record<string, string>,
    workspaceData?: Record<string, unknown>,
    selections?: Record<string, unknown>,
  ) => {
    try {
      const knowledgeRefs = getSelectedResourceRefs();
      setSiteResources(knowledgeRefs);
      if (!siteIdRef.current) {
        const r = await fetch("/api/sites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: config.siteType === "blog" ? "My Blog" : "My Site",
            siteType: config.siteType || "portfolio",
            theme: config.theme || "minimalist",
            layout: config.layout || "card-grid",
            previewUrl: url,
            fileMap,
            workspaceData,
            selections,
            prd: config.prd ? JSON.stringify(config.prd) : undefined,
            editorState: JSON.stringify({ compiledSpec: config.spec || null, knowledgeRefs }),
          }),
        });
        const d = await r.json();
        if (d.id) {
          siteIdRef.current = d.id;
          setSiteId(d.id);
          setSiteStatus("draft");
          setPublishedUrl(null);
          if (convId) await fetch(`/api/conversations/${convId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteId: d.id }) });
        }
      } else {
        await fetch(`/api/sites/${siteIdRef.current}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            previewUrl: url,
            fileMap: fileMap ? JSON.stringify(fileMap) : undefined,
            workspaceData: workspaceData ? JSON.stringify(workspaceData) : undefined,
            selections: selections ? JSON.stringify(selections) : undefined,
            prd: config.prd ? JSON.stringify(config.prd) : undefined,
            editorState: JSON.stringify({ compiledSpec: config.spec || null, knowledgeRefs }),
          }),
        });
      }
    } catch {}
  }, [getSelectedResourceRefs]);

  const compileSiteSpec = useCallback(async (intent: {
    siteType?: string;
    theme?: string;
    layout?: string;
    customTheme?: string;
    conversationSummary?: string;
    techStackHints?: string[] | string;
    assetIdeas?: string[] | string;
  }) => {
    try {
      const res = await fetch("/api/compile-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knowledge: items.filter(i => i.selected),
          intent: {
            siteType: intent.siteType || prdData?.siteType || "portfolio",
            theme: intent.theme || prdData?.theme || "minimalist",
            layout: intent.layout || prdData?.layout || getAutoLayout((intent.theme as string) || prdData?.theme || "minimalist", (intent.siteType as string) || prdData?.siteType || "portfolio"),
            customTheme: intent.customTheme || "",
            conversationSummary: intent.conversationSummary || prdData?.markdown || chatMessages.slice(-6).map(m => `${m.role}: ${m.content}`).join("\n"),
            prd: prdData?.markdown || "",
            techStackHints: intent.techStackHints || [],
            assetIdeas: intent.assetIdeas || [],
          },
          skillIds: loadedSkillIds,
        }),
      });

      if (!res.ok) return null;
      const result = await readJsonResponse<{ spec?: SiteSpec | null }>(res);
      const spec = (result.spec || null) as SiteSpec | null;
      if (spec) setCompiledSpec(spec);
      return spec;
    } catch {
      return null;
    }
  }, [items, prdData, chatMessages, loadedSkillIds]);

  const normalizePublishedUrl = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }, []);

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
  const handleFile = (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext === "zip" || f.type.includes("zip")) addFileSource(f, "zip");
    else if (ext === "pdf" || f.type.includes("pdf")) addFileSource(f, "pdf");
    else if (ext === "docx" || ext === "doc") addFileSource(f, "docx");
    else if (ext === "txt") addFileSource(f, "txt");
    else if (ext === "md") addFileSource(f, "md");
  };
  const removeSource = async (id: string) => { setSources(p => p.filter(s => s.id !== id)); await fetch(`/api/knowledge?sourceId=${id}`, { method: "DELETE" }); await loadKnowledge(); };

  // Pending
  const togglePendingItem = (id: string) => setPendingItems(p => p.map(i => i.id === id ? { ...i, selected: !i.selected } : i));
  const savePendingToKB = async () => {
    const sel = pendingItems.filter(i => i.selected); if (sel.length === 0) return; setSaveError("");
    try {
      // Derive group name from source file
      const groupName = pendingSourceName.replace(/\.[^.]+$/, "") || "Untitled";

      // Build category summary for description
      const catCounts = sel.reduce<Record<string, number>>((a, i) => { a[i.category] = (a[i.category] || 0) + 1; return a; }, {});
      const description = `${sel.length} items: ${Object.entries(catCounts).map(([c, n]) => `${c} ${n}`).join(", ")}`;

      // Collect all tags
      const allTags = [...new Set(sel.flatMap(i => i.tags || []))].slice(0, 10);

      // Create knowledge group with items
      const r = await fetch("/api/knowledge-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName,
          description,
          tags: allTags,
          sourceFile: pendingSourceName,
          sourceType: pendingSourceType,
          items: sel,
        }),
      });
      const t = await r.text(); let d; try { d = JSON.parse(t); } catch { setSaveError("Server error"); return; }
      if (!r.ok) { setSaveError(d.error || "Failed"); return; }

      // Generate index.md for the group
      if (d.id) {
        const indexMd = generateIndexMd(groupName, description, allTags, sel);
        await fetch(`/api/knowledge-groups/${d.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ indexMd }),
        });
      }

      setPendingItems([]); setPendingSourceId(null); setPendingSourceName(""); setPendingSourceType("");
      await loadKnowledge(); await loadGroups(); setView("knowledge");
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
    await fetch("/api/knowledge", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceId, selected: newVal }) });
  };

  // Chat
  const sendChat = async (overrideInput?: string) => {
    const msg = overrideInput || chatInput; if (!msg.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: msg };
    const newMsgs = [...chatMessages, userMsg];
    setChatMessages(newMsgs); setChatInput(""); setChatLoading(true);
    setWorkingStatus(locale === "zh" ? "💾 保存对话..." : "💾 Saving...");
    await saveConv(newMsgs);

    const isFirstTemplateUserMessage = Boolean(
      selectedTemplate &&
      !siteIdRef.current &&
      !chatMessages.some((item) => item.role === "user"),
    );

    if (isFirstTemplateUserMessage) {
      try {
        const template = selectedTemplate;
        if (!template) throw new Error("Template seed missing");
        const fastTrackPrd: PRDData = {
          ...(prdData || {}),
          siteType: template.category,
          theme: template.theme,
          layout: template.layout,
          markdown: `${prdData?.markdown || ""}\n\n## ${locale === "zh" ? "用户补充信息" : "User Customization Notes"}\n${msg}`.trim(),
          createdAt: new Date().toISOString(),
        };
        const fastTrackMessage: ChatMessage = {
          role: "assistant",
          content: locale === "zh"
            ? `已收到你的信息。我会先保留当前模板的结构和风格，快速生成一个可预览版本，然后你可以继续在这个基础上修改。`
            : `Got it. I will keep the current template structure and style, generate a fast first preview, and then you can keep refining it.`,
        };
        const updatedMessages = [...newMsgs, fastTrackMessage];
        setPrdData(fastTrackPrd);
        setChatMessages(updatedMessages);
        await saveConv(updatedMessages, previewUrl);
        setWorkingStatus(locale === "zh" ? "⚡ 正在基于模板生成首版预览..." : "⚡ Generating the first preview from this template...");
        await handleGenerate({
          siteType: template.category,
          theme: template.theme,
          layout: template.layout,
          prd: fastTrackPrd,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        setChatMessages((prev) => [...prev, { role: "assistant", content: locale === "zh" ? `❌ 快速生成失败：${errMsg}` : `❌ Fast preview failed: ${errMsg}` }]);
      } finally {
        setWorkingStatus("");
        setChatLoading(false);
      }
      return;
    }

    // Progressive status updates during AI call
    const statusSteps = locale === "zh"
      ? ["🧠 AI 正在分析需求...", "📚 读取知识库...", "🎨 匹配技能...", "✍️ 生成回复..."]
      : ["🧠 Analyzing request...", "📚 Reading knowledge...", "🎨 Matching skills...", "✍️ Generating response..."];
    let stepIdx = 0;
    setWorkingStatus(statusSteps[0]);
    const statusTimer = setInterval(() => {
      stepIdx++;
      if (stepIdx < statusSteps.length) setWorkingStatus(statusSteps[stepIdx]);
    }, 3000);

    try {
      const r = await fetch("/api/chat-build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMsgs.map(m => ({ role: m.role, content: m.content })),
          knowledge: items.filter(i => i.selected),
          currentSelections: {},
          loadedSkills: loadedSkillIds,
          siteId: siteIdRef.current,
          currentPrd: prdData,
        }),
      });
      const d = await readJsonResponse<{
        content?: string;
        error?: string;
        action?: {
          type?: string;
          question?: string;
          options?: OptionCard[];
          multiSelect?: boolean;
          version?: number;
          siteType?: string;
          theme?: string;
          layout?: string;
          planner?: string;
          skillIds?: string[];
          changes?: Array<{ file: string; action: string; content?: string }>;
          executionSteps?: string[];
          customTheme?: string;
        };
      }>(r);
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status} ${r.statusText}`);

      // Extract thinking steps from response
      const thinkingMatch = d.content?.match(/```thinking\s*([\s\S]*?)```/);
      if (thinkingMatch) {
        setThinkingSteps(thinkingMatch[1].trim().split("\n").filter(Boolean));
      }

      // Clean display content (remove action/thinking/json-action blocks)
      let cleanContent = d.content || "";
      // Remove ```action ... ``` blocks
      cleanContent = cleanContent.replace(/```action\s*[\s\S]*?```/g, "");
      // Remove ```thinking ... ``` blocks
      cleanContent = cleanContent.replace(/```thinking\s*[\s\S]*?```/g, "");
      // Remove ```json blocks that contain action type fields (AI sometimes wraps actions in json fence)
      cleanContent = cleanContent.replace(/```json\s*\{[\s\S]*?"type"\s*:\s*"(?:options|prd|generate|modify|activate_skills|update_prd|handoff_to_planner)"[\s\S]*?\}\s*```/g, "");
      // Remove bare ``` blocks that contain action type fields
      cleanContent = cleanContent.replace(/```\s*\{[\s\S]*?"type"\s*:\s*"(?:options|prd|generate|modify|activate_skills|update_prd|handoff_to_planner)"[\s\S]*?\}\s*```/g, "");
      cleanContent = cleanContent.trim();
      // Only add message if there's actual content (not just action blocks)
      let updated = newMsgs;
      if (cleanContent) {
        updated = [...newMsgs, { role: "assistant" as const, content: cleanContent }];
        setChatMessages(updated);
        await saveConv(updated);
      }

      // Handle actions
      if (d.action?.type === "options") {
        setPendingOptions({
          question: d.action.question || "",
          options: Array.isArray(d.action.options) ? d.action.options : [],
          multiSelect: !!d.action.multiSelect,
        });
      } else if (d.action?.type === "prd") {
        // PRD: action has siteType/theme/layout, markdown is in the cleaned content
        const prd: PRDData = {
          version: Number(d.action.version || 1),
          siteType: d.action.siteType || "portfolio",
          theme: d.action.theme || "minimalist",
          ...(d.action.layout ? { layout: d.action.layout } : {}),
          ...(d.action.planner ? { planner: d.action.planner } : {}),
          // The markdown is the cleaned response text (after removing action block)
          markdown: cleanContent || "",
          createdAt: new Date().toISOString(),
        };
        setPrdData(prd);
        setShowPreview(true);
        setPreviewTab("preview");
        if (siteIdRef.current) {
          await fetch(`/api/sites/${siteIdRef.current}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prd: JSON.stringify(prd) }) });
        }
        await handleGenerate({
          ...d.action,
          skillIds: [...new Set([...loadedSkillIds, ...(Array.isArray(d.action.skillIds) ? d.action.skillIds : [])])],
          prd,
        });
      } else if (d.action?.type === "activate_skills" && Array.isArray(d.action.skillIds)) {
        const skillIds = d.action.skillIds;
        setLoadedSkillIds(prev => [...new Set([...prev, ...skillIds])]);
      } else if (d.action?.type === "modify" && Array.isArray(d.action.changes)) {
        await handleModify({
          changes: d.action.changes,
          description: typeof (d.action as { description?: unknown }).description === "string" ? (d.action as { description?: string }).description : undefined,
          specIntent: typeof (d.action as { specIntent?: unknown }).specIntent === "string" ? (d.action as { specIntent?: string }).specIntent : undefined,
          prdSummary: typeof (d.action as { prdSummary?: unknown }).prdSummary === "string" ? (d.action as { prdSummary?: string }).prdSummary : undefined,
          techStackHints: Array.isArray((d.action as { techStackHints?: unknown }).techStackHints) ? (d.action as { techStackHints: string[] }).techStackHints : undefined,
          assetIdeas: Array.isArray((d.action as { assetIdeas?: unknown }).assetIdeas) ? (d.action as { assetIdeas: string[] }).assetIdeas : undefined,
        });
      } else if (d.action?.type === "generate") {
        if (!prdData) {
          // AI skipped PRD — create minimal PRD and auto-trigger build
          const autoPrd: PRDData = { version: 1, siteType: d.action.siteType || "portfolio", theme: d.action.theme || "minimalist", markdown: `# Auto-generated PRD\n\nSite: ${d.action.siteType || "portfolio"}\nTheme: ${d.action.theme || "minimalist"}\nLayout: ${d.action.layout || "auto"}\n\n${cleanContent}`, createdAt: new Date().toISOString() };
          setPrdData(autoPrd);
          setShowPreview(true); setPreviewTab("preview");
          // Auto-trigger build since user intent is clear
          handleGenerate({ ...d.action, skillIds: [...new Set([...loadedSkillIds, ...(Array.isArray(d.action.skillIds) ? d.action.skillIds : [])])], prd: autoPrd });
        } else {
          handleGenerate({ ...d.action, skillIds: [...new Set([...loadedSkillIds, ...(Array.isArray(d.action.skillIds) ? d.action.skillIds : [])])] });
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      setChatMessages(p => [...p, { role: "assistant", content: locale === "zh" ? `❌ 请求失败：${errMsg}。请重试。` : `❌ Request failed: ${errMsg}. Please retry.` }]);
    }
    finally { clearInterval(statusTimer); setWorkingStatus(""); setChatLoading(false); }
  };

  const handleGenerate = async (config: Record<string, unknown>) => {
    setGenStatus("generating");
    const zh = locale === "zh";
    const effectivePrd = ((config.prd as PRDData | undefined) || prdData || null);
    setThinkingSteps(Array.isArray(config.executionSteps) ? (config.executionSteps as string[]) : [zh ? "📋 准备构建参数..." : "📋 Preparing build config..."]);
    try {
      const sel = items.filter(i => i.selected);
      const theme = (config.theme as string) || "minimalist";
      const skillIds = Array.isArray(config.skillIds) ? config.skillIds : [];
      const baseSelections: UserSelections = {
        siteType: ((config.siteType as UserSelections["siteType"]) || "portfolio"),
        theme: ((theme as UserSelections["theme"]) || "minimalist"),
        layout: ((config.layout as UserSelections["layout"]) || getAutoLayout(theme, (config.siteType as string) || "portfolio")),
        customSiteType: "",
        customTheme: (config.customTheme as string) || "",
        customLayout: "",
        features: { chatbot: true, i18n: true, animations: true, share: true },
      };

      setThinkingSteps(p => [...p, zh ? "🧠 编译 Site Spec..." : "🧠 Compiling site spec..."]);
      const spec = await compileSiteSpec({
        siteType: String(config.siteType || effectivePrd?.siteType || "portfolio"),
        theme,
        layout: String(config.layout || effectivePrd?.layout || baseSelections.layout),
        customTheme: String(config.customTheme || ""),
        conversationSummary: effectivePrd?.markdown || chatMessages.slice(-6).map(m => `${m.role}: ${m.content}`).join("\n"),
        techStackHints: Array.isArray(config.techStackHints) ? (config.techStackHints as string[]) : [],
        assetIdeas: Array.isArray(config.assetGenerationPlan) ? (config.assetGenerationPlan as string[]) : [],
      });

      const data = spec ? buildWorkspaceDataFromSpec(spec, sel) : buildWorkspaceDataFromKnowledge(sel);
      const selections = spec ? deriveSelectionsFromSpec(spec, baseSelections) : baseSelections;

      setThinkingSteps(p => [...p, zh ? `🎨 主题: ${theme} | 布局: ${selections.layout}` : `🎨 Theme: ${theme} | Layout: ${selections.layout}`]);
      setThinkingSteps(p => [...p, zh ? "⚙️ 生成代码文件..." : "⚙️ Generating code files..."]);

      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, selections, skillIds, siteId: siteIdRef.current, prd: effectivePrd, spec }),
      });
      const genResult = await readJsonResponse<{
        error?: string;
        logs?: string[];
        url?: string;
        fileMap?: Record<string, string>;
        siteId?: string;
        verification?: { checks?: Array<{ label: string; ok: boolean }> };
        previewReachable?: boolean;
      }>(r);
      if (!r.ok) {
        const logText = Array.isArray(genResult?.logs) && genResult.logs.length > 0 ? `\n\n${genResult.logs.join("\n")}` : "";
        throw new Error(`${genResult?.error || "Generation failed"}${logText}`);
      }
      const url = genResult.url;
      const fileMap = genResult.fileMap;
      const verification = genResult.verification;
      const previewReachable = genResult.previewReachable !== false;
      if (!url) throw new Error("Generation response missing preview URL");
      if (genResult.siteId && !siteIdRef.current) { siteIdRef.current = genResult.siteId; setSiteId(genResult.siteId); }

      setThinkingSteps(p => [...p, zh ? `✅ 生成完成: ${Object.keys(fileMap || {}).length} 个文件` : `✅ Generated: ${Object.keys(fileMap || {}).length} files`]);
      setThinkingSteps(p => [...p, zh ? "🖼️ 生成图片资源..." : "🖼️ Generating images..."]);

      const imageTasks = getImageTasks(theme as import("@/lib/types").ThemeStyle, data.name, data.projects.map((p: { title: string; tags: string[] }) => ({ title: p.title, tags: p.tags })));
      for (const task of imageTasks) { try { await fetch("/api/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: task.prompt, filename: task.filename, style: theme }) }); } catch {} }

      setThinkingSteps(p => [...p, zh ? "🚀 启动预览服务..." : "🚀 Starting preview server..."]);
      let previewReady = previewReachable;
      if (!previewReady) {
        const healthUrl = `${url.replace(/\/+$/, "")}/__health`;
        const start = Date.now();
        for (let delay = 500; Date.now() - start < 30000; delay = Math.min(delay * 1.5, 3000)) {
          try {
            const health = await fetch(healthUrl, { cache: "no-store" });
            if (health.ok) {
              previewReady = true;
              break;
            }
          } catch {}
          await new Promise(r => setTimeout(r, delay));
        }
      }
      if (!previewReady) {
        setThinkingSteps(p => [...p, zh ? "⚠️ 预览服务启动超时，页面可能需要手动刷新" : "⚠️ Preview server timed out, you may need to refresh manually"]);
      }

      setThinkingSteps(p => [...p, zh ? "💾 保存项目..." : "💾 Saving project..."]);
      setPreviewUrl(url); setGenStatus("ready"); setShowPreview(true); setPreviewTab("preview"); setPreviewKey(k => k + 1);
      const cid = await saveConv(chatMessages, url);
      await autoSaveSite(url, { ...config, prd: effectivePrd, spec }, cid || convIdRef.current, fileMap, data as unknown as Record<string, unknown>, selections as unknown as Record<string, unknown>);
      if (verification?.checks?.length) {
        const verificationLines = verification.checks.map((check: { label: string; ok: boolean }) => `${check.ok ? "✅" : "⚠️"} ${check.label}`);
        setChatMessages(p => [...p, { role: "assistant", content: `${zh ? "构建验证结果" : "Build verification"}\n\n${verificationLines.join("\n")}` }]);
      }
      setThinkingSteps([]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      setGenStatus("idle"); setThinkingSteps([]);
      setChatMessages(p => [...p, { role: "assistant", content: locale === "zh"
        ? `❌ 生成失败：${errMsg}\n\n请根据上面的真实错误信息调整后重试。`
        : `❌ Generation failed: ${errMsg}\n\nPlease retry after addressing the specific error above.` }]);
    }
  };

  // Handle incremental code modification
  const handleModify = async (action: {
    changes: Array<{ file: string; action: string; content?: string }>;
    description?: string;
    specIntent?: string;
    prdSummary?: string;
    techStackHints?: string[];
    assetIdeas?: string[];
  }) => {
    if (!siteIdRef.current) return;
    const zh = locale === "zh";
    try {
      const nextPrd = action.prdSummary && prdData
        ? { ...prdData, markdown: `${prdData.markdown || ""}\n\n## ${zh ? "修改记录" : "Modification Notes"}\n${action.prdSummary}`.trim() }
        : prdData;
      if (nextPrd !== prdData) setPrdData(nextPrd as PRDData);

      const spec = await compileSiteSpec({
        siteType: String(prdData?.siteType || "portfolio"),
        theme: String(prdData?.theme || "minimalist"),
        layout: String(prdData?.layout || "card-grid"),
        conversationSummary: `${nextPrd?.markdown || prdData?.markdown || ""}\n\n${action.description || ""}\n${action.specIntent || ""}\n${chatMessages.slice(-4).map(m => `${m.role}: ${m.content}`).join("\n")}`.trim(),
        techStackHints: Array.isArray(action.techStackHints) ? action.techStackHints : [],
        assetIdeas: Array.isArray(action.assetIdeas) ? action.assetIdeas : [],
      });

      const r = await fetch("/api/modify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: siteIdRef.current, changes: action.changes, spec, prd: nextPrd || prdData, knowledgeRefs: getSelectedResourceRefs() }),
      });
      const d = await readJsonResponse<{
        ok?: boolean;
        error?: string;
        buildSuccess?: boolean;
        buildError?: string;
        buildLogs?: string[];
        verification?: { checks?: Array<{ label: string; ok: boolean }> };
      }>(r);
      if (!r.ok) throw new Error(d.error);

      // Show build failure warning to user
      if (d.buildSuccess === false) {
        const logText = Array.isArray(d.buildLogs) && d.buildLogs.length > 0 ? `\n\n${d.buildLogs.join("\n")}` : "";
        setChatMessages(p => [...p, { role: "assistant", content: zh ? `⚠️ 文件已保存，但构建失败：${d.buildError || "未知错误"}。预览可能未更新。${logText}` : `⚠️ Files saved but build failed: ${d.buildError || "Unknown error"}. Preview may not be updated.${logText}` }]);
      } else if (d.verification?.checks?.length) {
        const verificationLines = d.verification.checks.map((check: { label: string; ok: boolean }) => `${check.ok ? "✅" : "⚠️"} ${check.label}`);
        setChatMessages(p => [...p, { role: "assistant", content: `${zh ? "修改后验证结果" : "Post-modification verification"}\n\n${verificationLines.join("\n")}` }]);
      }

      // Refresh preview iframe via React key change (forces remount)
      setShowPreview(true);
      if (previewUrl) {
        // Wait for rebuild to complete before refreshing
        const waitMs = d.buildSuccess === false ? 500 : 2000;
        setTimeout(() => setPreviewKey(k => k + 1), waitMs);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("Modify failed:", err);
      setChatMessages(p => [...p, { role: "assistant", content: zh ? `❌ 修改失败：${msg}` : `❌ Modification failed: ${msg}` }]);
    }
  };

  const updateSitePublishState = useCallback(async (nextStatus: "draft" | "published", nextPublishedUrl: string | null) => {
    if (!siteIdRef.current) return;
    await fetch(`/api/sites/${siteIdRef.current}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: nextStatus,
        publishedUrl: nextPublishedUrl,
      }),
    });
    setSiteStatus(nextStatus);
    setPublishedUrl(nextPublishedUrl);
  }, []);

  const handlePublish = useCallback(async () => {
    if (!siteIdRef.current) return;
    const promptLabel = locale === "zh" ? "请输入发布域名，例如 portfolio.yourbrand.com" : "Enter the publish domain, for example portfolio.yourbrand.com";
    const value = window.prompt(promptLabel, publishedUrl || "");
    if (value === null) return;
    const normalized = normalizePublishedUrl(value);
    if (!normalized) return;
    await updateSitePublishState("published", normalized);
  }, [locale, normalizePublishedUrl, publishedUrl, updateSitePublishState]);

  const handleUnpublish = useCallback(async () => {
    if (!siteIdRef.current) return;
    await updateSitePublishState("draft", null);
  }, [updateSitePublishState]);

  const quickGenerate = () => handleGenerate({
    siteType: selectedTemplate?.category || "portfolio",
    theme: selectedTemplate?.theme || "minimalist",
    layout: selectedTemplate?.layout || undefined,
    prd: prdData || undefined,
  });
  const newConversation = () => { convIdRef.current = null; siteIdRef.current = null; lastRestoredKey.current = ""; appliedTemplateIdRef.current = ""; setConversationId(null); setSiteId(null); setChatMessages([]); setPreviewUrl(null); setPublishedUrl(null); setSiteStatus("draft"); setSiteResources([]); setGenStatus("idle"); setShowPreview(false); setLoadedSkillIds([]); setPrdData(null); setCompiledSpec(null); setPendingOptions(null); setThinkingSteps([]); setPreviewTab("preview"); setPreviewKey(0); router.replace("/create"); };
  const deleteConversation = useCallback(async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      setConvList((prev) => prev.filter((item) => item.id !== id));
      if (conversationId === id) {
        newConversation();
      }
    } catch {}
  }, [conversationId]);

  if (authStatus === "loading" || !session?.user) return null;

  const selectedCount = items.filter(i => i.selected).length;
  const sourceGroups = getSourceGroups(items);
  const currentStep = previewUrl ? 3 : chatMessages.length > 0 || pendingOptions ? 2 : 1;
  const isTemplateStart = Boolean(selectedTemplate && !siteId);
  const hasKnowledge = items.length > 0;
  const hasSelectedKnowledge = selectedCount > 0;
  const initialTemplateMessageCount = selectedTemplate ? 1 : 0;
  const showGuidanceBanner = !siteId && !chatLoading && (
    (!hasKnowledge && chatMessages.length <= initialTemplateMessageCount) ||
    (isTemplateStart && !hasKnowledge && chatMessages.length <= initialTemplateMessageCount)
  );
  const contentSourceLabel = siteId
    ? (hasSelectedKnowledge
        ? (locale === "zh" ? "你的知识库 + 对话生成" : "Your knowledge + generated content")
        : (locale === "zh" ? "对话生成草稿" : "Chat-generated draft"))
    : (isTemplateStart
        ? (hasSelectedKnowledge
            ? (locale === "zh" ? "模板结构 + 你的知识库" : "Template structure + your knowledge")
            : (locale === "zh" ? "模板示例内容" : "Template sample content"))
        : (hasSelectedKnowledge
            ? (locale === "zh" ? "你的知识库草稿" : "Knowledge-based draft")
            : (locale === "zh" ? "从零开始草稿" : "Blank-start draft")));
  const guidanceTitle = isTemplateStart
    ? (locale === "zh" ? "当前是模板起点" : "You are starting from a template")
    : (locale === "zh" ? "当前是从零开始" : "You are starting from scratch");
  const guidanceDescription = isTemplateStart
    ? (hasKnowledge
        ? (locale === "zh" ? "当前右侧展示的是模板案例。你已经有资料可用，接下来系统会优先用你的内容替换模板中的示例项目、介绍和 CTA。" : "The preview currently shows a template case. Your uploaded sources are available, so the system can now replace the sample projects, intro, and CTA with your own content.")
        : (locale === "zh" ? "当前右侧展示的是模板案例。上传简历、项目文档、品牌介绍或文章内容后，我会把这些示例内容替换成你的版本。" : "The preview currently shows a template case. Upload your resume, project docs, brand copy, or writing samples and I will replace the sample content with your own."))
    : (hasKnowledge
        ? (locale === "zh" ? "你已经添加了资料，系统会自动整理并优先用这些信息生成网站内容。也可以直接继续对话补充细节。" : "You already have uploaded sources. The system will organize them automatically and use them first when generating the site. You can still refine everything through chat.")
        : (locale === "zh" ? "你可以直接开始描述需求，系统会先生成一个草稿。上传资料后，网站内容会更像你，也更容易替换掉占位文案。" : "You can start describing your site right away and get a first draft. Uploading your own materials will make the content feel more like you and replace placeholder copy faster."));
  const guidanceActions: GuidanceAction[] = [
    {
      label: locale === "zh" ? "上传资料" : "Upload Materials",
      onClick: () => setView("sources"),
      tone: "accent",
    },
    {
      label: locale === "zh" ? "管理知识库" : "Manage Knowledge",
      onClick: () => setView("knowledge"),
      tone: "muted",
    },
    {
      label: isTemplateStart
        ? (locale === "zh" ? "继续基于模板修改" : "Keep Editing From Template")
        : (locale === "zh" ? "直接开始对话" : "Start in Chat"),
      onClick: () => setView("build"),
      tone: "muted",
    },
  ];
  const uploadChips = locale === "zh"
    ? ["上传简历", "上传项目文档", "粘贴品牌介绍", "导入博客文章"]
    : ["Upload resume", "Upload project doc", "Paste brand intro", "Import blog posts"];
  const nextStepCards: NextStepCard[] = previewUrl && genStatus === "ready"
    ? (hasSelectedKnowledge
        ? [
            { label: locale === "zh" ? "把我的资料映射到首页" : "Map my sources to the homepage", prompt: locale === "zh" ? "请优先用我的资料替换首页的标题、简介和主要 CTA" : "Use my uploaded materials to replace the homepage headline, intro, and main CTA first" },
            { label: locale === "zh" ? "强化项目案例展示" : "Strengthen project case studies", prompt: locale === "zh" ? "请把项目案例部分改得更有说服力，突出结果和过程" : "Make the case study section more convincing and highlight both outcomes and process" },
            { label: locale === "zh" ? "优化品牌故事" : "Refine the brand story", prompt: locale === "zh" ? "请根据当前内容优化品牌故事和关于部分的叙事" : "Refine the brand story and about section based on the current content" },
            { label: locale === "zh" ? "只调整视觉，不改结构" : "Refine visuals only", prompt: locale === "zh" ? "保留当前结构，只优化视觉层次、配色和动效" : "Keep the current structure and only improve visual hierarchy, color, and motion" },
          ]
        : [
            { label: locale === "zh" ? "上传资料替换示例内容" : "Upload materials to replace sample content", onClick: () => setView("sources") },
            { label: locale === "zh" ? "增强首页视觉冲击" : "Increase hero impact", prompt: locale === "zh" ? "增强首页的视觉冲击力和第一屏表现" : "Increase the visual impact of the hero and first screen" },
            { label: locale === "zh" ? "优化 CTA 和联系区" : "Improve CTA and contact", prompt: locale === "zh" ? "优化当前网站的 CTA 和联系区，让转化更明确" : "Improve the CTA and contact section to make conversion clearer" },
            { label: locale === "zh" ? "补充案例与项目展示" : "Add stronger showcase sections", prompt: locale === "zh" ? "补充更完整的案例或项目展示模块" : "Add stronger case study or project showcase sections" },
          ])
    : (selectedTemplate
        ? [
            { label: locale === "zh" ? "用我的信息替换模板内容" : "Replace template content with my info", prompt: locale === "zh" ? "请根据我刚才提供的信息替换模板里的示例内容" : "Replace the sample template content with the information I just provided" },
            { label: locale === "zh" ? "保留结构，只改语气" : "Keep structure, change tone", prompt: locale === "zh" ? "保留当前模板结构，只把语气改成更符合我的品牌风格" : "Keep the current template structure and only adapt the tone to my brand" },
            { label: locale === "zh" ? "上传资料后再生成" : "Upload materials before generating", onClick: () => setView("sources") },
            { label: locale === "zh" ? "直接生成首版预览" : "Generate first preview now", onClick: () => quickGenerate() },
          ]
        : (hasSelectedKnowledge
            ? [
                { label: locale === "zh" ? "根据资料推荐网站定位" : "Recommend a site angle from my materials", prompt: locale === "zh" ? "根据我现在的资料推荐一个最适合的网站定位和结构" : "Recommend the best site positioning and structure based on my current materials" },
                { label: locale === "zh" ? "直接生成首版预览" : "Generate first preview now", onClick: () => quickGenerate() },
                { label: locale === "zh" ? "总结当前资料还缺什么" : "Summarize what is still missing", prompt: locale === "zh" ? "总结一下当前资料还缺哪些信息会影响网站效果" : "Summarize which missing information is still limiting the quality of the site" },
                { label: locale === "zh" ? "继续上传资料" : "Upload more materials", onClick: () => setView("sources") },
              ]
            : [
                { label: locale === "zh" ? "先上传资料" : "Upload materials first", onClick: () => setView("sources") },
                { label: locale === "zh" ? "推荐适合我的网站结构" : "Recommend a site structure", prompt: locale === "zh" ? "根据我接下来的需求，推荐一个适合我的网站结构" : "Recommend a site structure based on what I need" },
                { label: locale === "zh" ? "先生成一个草稿" : "Generate a quick draft", prompt: locale === "zh" ? "先根据我的简单描述生成一个可预览的草稿" : "Generate a quick preview draft from a simple description first" },
                { label: locale === "zh" ? "我想做个人网站" : "I want a personal site", prompt: locale === "zh" ? "我想做一个个人网站，请先给我一个快速草稿" : "I want a personal site. Start with a quick draft first" },
              ]));

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
        <div className={`shrink-0 border-r border-gray-200/60 flex flex-col bg-white transition-all duration-200 ${sidebarExpanded ? "w-56" : "w-14"}`}>
          <div className={`flex items-center ${sidebarExpanded ? "px-3 py-2 justify-between" : "flex-col items-center py-3 gap-1"}`}>
            <button onClick={() => setSidebarExpanded(!sidebarExpanded)} className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-500 transition-all">
              <svg className={`w-4 h-4 transition-transform ${sidebarExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            {sidebarExpanded && <button onClick={newConversation} className="px-2 py-1 rounded-lg bg-accent/10 text-accent text-[10px] hover:bg-accent/30">{locale === "zh" ? "+ 新对话" : "+ New"}</button>}
          </div>

          {/* Nav icons (collapsed) */}
          {!sidebarExpanded && <div className="flex flex-col items-center gap-1">{NAV.map(n => (
            <button key={n.id} onClick={() => setView(n.id)} className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${view === n.id ? "bg-accent/10 text-accent" : "text-gray-500 hover:bg-gray-100"}`} title={n.label}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={n.icon} /></svg>
              {n.badge && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent text-white text-[8px] flex items-center justify-center">{n.badge}</span>}
            </button>
          ))}</div>}

          {/* Expanded sidebar */}
          {sidebarExpanded && <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-2 py-1 space-y-0.5">{NAV.map(n => (
              <button key={n.id} onClick={() => setView(n.id)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] transition-all ${view === n.id ? "bg-accent/15 text-accent" : "text-gray-400 hover:bg-gray-100"}`}>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={n.icon} /></svg>
                {n.label}{n.badge && <span className="ml-auto text-[9px] px-1.5 rounded bg-gray-200/50">{n.badge}</span>}
              </button>
            ))}</div>
            <div className="px-3 pt-3"><p className="text-[9px] text-gray-500 uppercase tracking-wider mb-2">{locale === "zh" ? "对话记录" : "History"}</p></div>
            <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
              {convList.map(c => (
                <div key={c.id} className={`group flex items-center gap-1 rounded-lg transition-all ${conversationId === c.id ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                  <button onClick={() => { lastRestoredKey.current = ""; setView("build"); router.push(`/create?convId=${c.id}`); }} className={`flex-1 text-left px-3 py-2 rounded-lg transition-all ${conversationId === c.id ? "text-gray-700" : "text-gray-500"}`}>
                    <p className="text-[10px] truncate">{c.title || "Untitled"}</p>
                    <p className="text-[8px] text-gray-500 mt-0.5">{c.updatedAt ? new Date(c.updatedAt).toLocaleDateString() : ""}{c.siteId ? " · 🌐" : ""}</p>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); void deleteConversation(c.id); }}
                    className="mr-1 w-7 h-7 shrink-0 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                    aria-label={locale === "zh" ? "删除对话" : "Delete conversation"}
                  >
                    <svg className="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 7h12M9 7V5h6v2m-7 4v6m4-6v6m4-6v6M8 7l1 12h6l1-12" />
                    </svg>
                  </button>
                </div>
              ))}
              {convList.length === 0 && <p className="text-[9px] text-gray-400 text-center py-4">{locale === "zh" ? "暂无记录" : "No history"}</p>}
            </div>
          </div>}
        </div>

        {/* Global file input (always in DOM) */}
        <input ref={fileRef} type="file" accept=".pdf,.zip,.docx,.doc,.txt,.md" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />

        {/* ====== BUILD VIEW ====== */}
        {view === "build" && <>
          {/* Chat */}
          <div className="flex flex-col overflow-hidden" style={{ width: showPreview ? `${splitPct}%` : "100%" }}>
            {/* Header */}
            <div className="shrink-0 px-4 py-2.5 border-b border-gray-200/60 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm font-medium shrink-0">{locale === "zh" ? "构建" : "Build"}</h2>
                {selectedTemplate && (
                  <span className="shrink-0 rounded-full bg-accent/10 px-2.5 py-1 text-[10px] text-accent">
                    {locale === "zh" ? `模板：${selectedTemplate.nameCn}` : `Template: ${selectedTemplate.name}`}
                  </span>
                )}
                {/* Knowledge selector button */}
                <div className="relative">
                  <button onClick={() => setShowKnowledgeSelector(!showKnowledgeSelector)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-[10px] text-gray-400 hover:bg-gray-200/50 transition-all">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    {locale === "zh" ? `知识库 (${selectedCount}/${items.length})` : `Knowledge (${selectedCount}/${items.length})`}
                    <svg className={`w-2.5 h-2.5 transition-transform ${showKnowledgeSelector ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {/* Knowledge dropdown */}
                  {showKnowledgeSelector && (
                    <div className="absolute top-full left-0 mt-1 w-72 max-h-80 rounded-xl bg-white border border-gray-200 shadow-2xl z-50 overflow-hidden">
                      <div className="p-3 border-b border-gray-200/60">
                        <p className="text-[10px] text-gray-400">{locale === "zh" ? "选择构建时使用的知识来源" : "Select knowledge sources for building"}</p>
                      </div>
                      <div className="overflow-y-auto max-h-60 p-2 space-y-1">
                        {sourceGroups.map(g => {
                          const allSel = g.items.every(i => i.selected);
                          const someSel = g.items.some(i => i.selected);
                          return (
                            <button key={g.sourceId} onClick={() => toggleSourceGroup(g.sourceId)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${allSel ? "bg-accent/10" : "hover:bg-gray-100"}`}>
                              <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${allSel ? "bg-accent border-accent" : someSel ? "bg-accent/40 border-accent/60" : "border-gray-300"}`}>
                                {(allSel || someSel) && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={allSel ? "M5 13l4 4L19 7" : "M5 12h14"} /></svg>}
                              </div>
                              <span className="text-sm">{SOURCE_TYPE_META[g.sourceType as SourceType]?.icon || "📎"}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-gray-600 truncate">{g.sourceName}</p>
                                <p className="text-[8px] text-gray-500">{g.items.filter(i => i.selected).length}/{g.items.length} {locale === "zh" ? "条" : "items"}</p>
                              </div>
                            </button>
                          );
                        })}
                        {sourceGroups.length === 0 && <p className="text-[9px] text-gray-500 text-center py-4">{locale === "zh" ? "暂无知识库数据" : "No knowledge"}</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {genStatus === "idle" && items.length > 0 && <button onClick={quickGenerate} className="px-3 py-1.5 rounded-lg bg-accent/10 text-[10px] text-accent hover:bg-accent/30">{locale === "zh" ? "⚡ 快速生成" : "⚡ Quick Gen"}</button>}
                <button onClick={() => setShowPreview(!showPreview)} className={`px-2.5 py-1.5 rounded-lg text-[10px] transition-all ${showPreview ? "bg-gray-100 text-gray-400" : "bg-accent/10 text-accent"}`}>
                  {showPreview ? (locale === "zh" ? "隐藏预览" : "Hide") : (locale === "zh" ? "显示预览" : "Show")}
                </button>
              </div>
            </div>

            <div className="shrink-0 px-4 py-3 border-b border-gray-200/60 bg-white/70">
              <div className="flex items-center gap-3">
                {[
                  { step: 1, label: locale === "zh" ? "选择资料" : "Select Context" },
                  { step: 2, label: locale === "zh" ? "快速问答" : "Quick Brief" },
                  { step: 3, label: locale === "zh" ? "生成预览" : "Preview Build" },
                ].map((item, index) => (
                  <div key={item.step} className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full text-[10px] font-semibold flex items-center justify-center ${currentStep >= item.step ? "bg-accent text-white" : "bg-gray-100 text-gray-400"}`}>
                        {item.step}
                      </span>
                      <span className={`text-[11px] ${currentStep >= item.step ? "text-gray-700" : "text-gray-400"}`}>{item.label}</span>
                    </div>
                    {index < 2 && <div className={`h-px flex-1 ${currentStep > item.step ? "bg-accent/40" : "bg-gray-200"}`} />}
                  </div>
                ))}
              </div>
            </div>

            {showGuidanceBanner && <div className="shrink-0 px-4 py-3 border-b border-gray-200/60 bg-gradient-to-r from-accent/6 via-white to-sky-50/60">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-accent">{guidanceTitle}</p>
                  <p className="mt-1 text-xs text-gray-700 leading-relaxed">{guidanceDescription}</p>
                  <p className="mt-1 text-[10px] text-gray-500">
                    {hasKnowledge
                      ? (locale === "zh" ? `已整理 ${items.length} 条资料，其中 ${selectedCount} 条会参与当前构建。` : `${items.length} source items are organized, and ${selectedCount} are selected for this build.`)
                      : (locale === "zh" ? "现在不需要先整理知识库，直接上传文件或继续对话都可以。" : "You do not need to organize the knowledge base first. Upload files or keep chatting.")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {guidanceActions.map((action) => (
                    <button
                      key={action.label}
                      onClick={action.onClick}
                      className={action.tone === "accent"
                        ? "px-3 py-2 rounded-xl bg-accent text-white text-[11px] font-medium hover:bg-accent/90 transition-all"
                        : "px-3 py-2 rounded-xl bg-white border border-gray-200 text-[11px] text-gray-600 hover:bg-gray-50 transition-all"}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" onClick={() => setShowKnowledgeSelector(false)}>
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200/60 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  </div>
                  <p className="text-sm text-gray-400 mb-1">
                    {selectedTemplate
                      ? (locale === "zh" ? "这个模板已经载入，继续补充你的真实内容即可" : "This template is loaded, now add your real content")
                      : (locale === "zh" ? "描述你想创建的网站" : "Describe the site you want")}
                  </p>

                  {/* New user guidance: show step hints when no knowledge */}
                  {items.length === 0 ? (
                    <div className="mb-6 max-w-sm">
                      <p className="text-[10px] text-gray-500 mb-4">{locale === "zh" ? "你可以直接描述需求，或先添加数据源让 AI 更了解你" : "Describe what you need, or add sources first for better results"}</p>
                      {/* Step hints */}
                      <div className="flex items-center gap-3 mb-4 px-3">
                        <div className="flex items-center gap-1.5 text-[9px]">
                          <span className="w-5 h-5 rounded-full bg-accent/10 text-accent flex items-center justify-center font-bold">1</span>
                          <span className="text-gray-500">{locale === "zh" ? "添加数据源" : "Add sources"}</span>
                        </div>
                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        <div className="flex items-center gap-1.5 text-[9px]">
                          <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold">2</span>
                          <span className="text-gray-500">{locale === "zh" ? "整理知识库" : "Organize KB"}</span>
                        </div>
                        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        <div className="flex items-center gap-1.5 text-[9px]">
                          <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-bold">3</span>
                          <span className="text-gray-500">{locale === "zh" ? "对话构建" : "Build via chat"}</span>
                        </div>
                      </div>
                      <button onClick={() => setView("sources")} className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-200 text-[10px] text-gray-400 hover:text-accent hover:border-accent/20 transition-all">
                        {locale === "zh" ? "📎 先去添加数据源（推荐）" : "📎 Add data sources first (recommended)"}
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-500 mb-6 max-w-sm">
                      {selectedTemplate
                        ? (locale === "zh" ? `当前模板为 ${selectedTemplate.nameCn}，已预填默认 PRD 和参考结构，你可以继续补充知识或直接修改内容。` : `The ${selectedTemplate.name} template is loaded with a starter PRD and structure. Add more context or start modifying it.`)
                        : (locale === "zh" ? `已加载 ${selectedCount} 条知识，AI 将结合知识库内容帮你构建` : `${selectedCount} knowledge items loaded, AI will use them to build`)}
                    </p>
                  )}

                  <div className="space-y-1.5 w-full max-w-xs">
                    <p className="text-[9px] text-gray-500 mb-1">{locale === "zh" ? "快速开始：" : "Quick start:"}</p>
                    {((selectedTemplate
                      ? [locale === "zh" ? selectedTemplate.starterPromptCn : selectedTemplate.starterPrompt, locale === "zh" ? "把首页标题和核心卖点改成我的版本" : "Rewrite the hero and value proposition around me", locale === "zh" ? "根据我的资料替换当前案例内容" : "Replace the current mock content with my real data", locale === "zh" ? "保留这个结构，但改成更适合我的品牌语气" : "Keep the structure but adapt the tone to my brand"]
                      : (locale === "zh"
                        ? ["帮我搭建一个个人作品集网站", "我想做一个极简风格的博客", "根据知识库内容推荐网站类型", "创建一个科技感品牌官网"]
                        : ["Build me a personal portfolio", "Create a minimalist blog", "Recommend a site type for my content", "Build a tech-style brand website"]))
                    ).map(p => (
                      <button key={p} onClick={() => sendChat(p)} className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200/60 text-[11px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all text-left">{p}</button>
                    ))}
                  </div>
                </div>
              )}
              {chatMessages.map((msg, i) => {
                // Check if user message is an option selection: [question] emoji label
                const optionMatch = msg.role === "user" && msg.content.match(/^\[(.+?)\]\s*(\S+)\s+(.+)$/);
                return (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {optionMatch ? (
                      // Render as styled option card
                      <div className="max-w-[70%] rounded-xl overflow-hidden">
                        <div className="px-3 py-1 bg-accent/10 text-[10px] text-accent">{optionMatch[1]}</div>
                        <div className="px-3.5 py-2.5 bg-accent text-white flex items-center gap-2">
                          <span className="text-base">{optionMatch[2]}</span>
                          <span className="text-[12px] font-medium">{optionMatch[3]}</span>
                        </div>
                      </div>
                    ) : (
                      <div className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-[12px] leading-relaxed ${msg.role === "user" ? "bg-accent text-white" : "bg-gray-100 text-gray-600"}`}>
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm prose-gray max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1 prose-code:text-accent prose-code:bg-accent/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-pre:rounded-lg prose-pre:my-2 text-[12px]">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Option cards */}
              {pendingOptions && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 font-medium">{pendingOptions.question}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {pendingOptions.options.map(opt => {
                      const isMulti = pendingOptions.multiSelect;
                      const isSelected = multiSelectValues.includes(opt.id);
                      return (
                        <button key={opt.id} onClick={() => {
                          if (isMulti) {
                            setMultiSelectValues(prev => prev.includes(opt.id) ? prev.filter(v => v !== opt.id) : [...prev, opt.id]);
                          } else {
                            const question = pendingOptions.question;
                            setPendingOptions(null); setMultiSelectValues([]);
                            sendChat(`[${question}] ${opt.icon} ${opt.label}`);
                          }
                        }}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all text-left ${isSelected ? "border-accent bg-accent/5" : "border-gray-200 bg-gray-50 hover:border-accent/30 hover:bg-gray-100"}`}>
                          {isMulti && (
                            <div className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center ${isSelected ? "bg-accent border-accent" : "border-gray-300"}`}>
                              {isSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                          )}
                          <span className="text-lg">{opt.icon}</span>
                          <div>
                            <p className="text-xs font-medium text-gray-700">{opt.label}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                    {/* Custom input card */}
                    <div className="flex items-start gap-2.5 p-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/50">
                      {pendingOptions.multiSelect && (
                        <div className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center ${customOptionInput ? "bg-accent border-accent" : "border-gray-300"}`}>
                          {customOptionInput && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                      )}
                      <span className="text-lg">✏️</span>
                      <div className="flex-1">
                        <input type="text" value={customOptionInput} onChange={e => setCustomOptionInput(e.target.value)}
                          placeholder={locale === "zh" ? "自定义..." : "Custom..."}
                          className="w-full bg-transparent text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none"
                          onKeyDown={e => {
                            if (e.key === "Enter" && customOptionInput.trim() && !pendingOptions.multiSelect) {
                              const question = pendingOptions.question;
                              setPendingOptions(null); setCustomOptionInput("");
                              sendChat(`[${question}] ✏️ ${customOptionInput.trim()}`);
                            }
                          }} />
                        <p className="text-[10px] text-gray-400 mt-0.5">{locale === "zh" ? "输入你的选项" : "Type your option"}</p>
                      </div>
                    </div>
                  </div>
                  {/* Multi-select confirm button */}
                  {pendingOptions.multiSelect && (multiSelectValues.length > 0 || customOptionInput.trim()) && (
                    <button onClick={() => {
                      const question = pendingOptions.question;
                      const selectedLabels = pendingOptions.options.filter(o => multiSelectValues.includes(o.id)).map(o => `${o.icon} ${o.label}`);
                      if (customOptionInput.trim()) selectedLabels.push(`✏️ ${customOptionInput.trim()}`);
                      setPendingOptions(null); setMultiSelectValues([]); setCustomOptionInput("");
                      sendChat(`[${question}] ${selectedLabels.join(" + ")}`);
                    }}
                      className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-all shadow-sm">
                      {locale === "zh" ? `确认选择 (${multiSelectValues.length + (customOptionInput.trim() ? 1 : 0)})` : `Confirm (${multiSelectValues.length + (customOptionInput.trim() ? 1 : 0)})`}
                    </button>
                  )}
                </div>
              )}

              {/* Thinking steps during generation */}
              {thinkingSteps.length > 0 && genStatus === "generating" && (
                <div className="space-y-1 p-3 rounded-xl bg-gray-50/50 border border-gray-200/60">
                  {thinkingSteps.map((step, i) => (
                    <p key={i} className="text-[10px] text-gray-400 font-mono">{step}</p>
                  ))}
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    <span className="text-[10px] text-accent/60">{locale === "zh" ? "构建中..." : "Building..."}</span>
                  </div>
                </div>
              )}

              {chatLoading && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-xl bg-gray-100 space-y-1.5">
                    {workingStatus && <p className="text-[11px] text-gray-500 font-medium">{workingStatus}</p>}
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                      <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: "0.2s" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: "0.4s" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 px-5 py-3 border-t border-gray-200/60 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {uploadChips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setView("sources")}
                    className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-[10px] text-gray-500 hover:text-accent hover:border-accent/30 hover:bg-accent/5 transition-all"
                  >
                    {chip}
                  </button>
                ))}
                <button
                  onClick={() => setShowKnowledgeSelector((prev) => !prev)}
                  className="px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-[10px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all"
                >
                  {locale === "zh" ? "选择用于构建的资料" : "Choose build materials"}
                </button>
              </div>
              {!chatLoading && (
                <div className="grid grid-cols-2 gap-2">
                  {nextStepCards.map((card) => (
                    <button
                      key={card.label}
                      onClick={() => {
                        if (card.onClick) {
                          card.onClick();
                          return;
                        }
                        if (card.prompt) {
                          void sendChat(card.prompt);
                        }
                      }}
                      className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-[11px] text-gray-600 hover:border-accent/30 hover:bg-accent/5 hover:text-gray-800 transition-all"
                    >
                      {card.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }} disabled={chatLoading || genStatus === "generating"} placeholder={genStatus === "generating" ? (locale === "zh" ? "正在生成中，请稍候..." : "Generating, please wait...") : previewUrl ? (locale === "zh" ? "描述要修改的内容..." : "Describe changes...") : (locale === "zh" ? "描述你的需求..." : "Describe what you want...")} className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 border border-gray-200 text-xs text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-accent/50 disabled:opacity-50" />
                <button onClick={() => sendChat()} disabled={!chatInput.trim() || chatLoading || genStatus === "generating"} className="px-4 py-2.5 rounded-xl bg-accent text-white hover:bg-accent/90 disabled:opacity-30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </div>
            </div>
          </div>

          {/* Splitter + Preview/PRD Panel */}
          {showPreview && <>
            <div onMouseDown={() => { dragging.current = true; document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }} className="w-1 shrink-0 bg-gray-100 hover:bg-accent/30 cursor-col-resize transition-colors" />
            <div className="flex flex-col bg-gray-50 overflow-hidden" style={{ width: `${100 - splitPct}%` }}>

              {/* Tab bar */}
              <div className="shrink-0 flex items-center border-b border-gray-200/60">
                <button onClick={() => setPreviewTab("preview")} className={`flex-1 py-2 text-[11px] font-medium text-center border-b-2 transition-all ${previewTab === "preview" ? "border-accent text-accent" : "border-transparent text-gray-400 hover:text-gray-500"}`}>
                  {locale === "zh" ? "网页预览" : "Preview"}
                </button>
                <button onClick={() => setPreviewTab("prd")} className={`flex-1 py-2 text-[11px] font-medium text-center border-b-2 transition-all ${previewTab === "prd" ? "border-accent text-accent" : "border-transparent text-gray-400 hover:text-gray-500"}`}>
                  {locale === "zh" ? "PRD 文档" : "PRD Doc"}
                  {prdData && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-accent inline-block" />}
                </button>
                <button onClick={() => setPreviewTab("resources")} className={`flex-1 py-2 text-[11px] font-medium text-center border-b-2 transition-all ${previewTab === "resources" ? "border-accent text-accent" : "border-transparent text-gray-400 hover:text-gray-500"}`}>
                  {locale === "zh" ? "项目资源" : "Resources"}
                  {siteResources.length > 0 && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-accent inline-block" />}
                </button>
              </div>

              {/* Preview tab */}
              {previewTab === "preview" && (
                genStatus === "generating" ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    <p className="text-sm text-gray-500">{locale === "zh" ? "正在生成网站..." : "Generating..."}</p>
                    {thinkingSteps.length > 0 && (
                      <div className="max-w-xs space-y-1 mt-4">
                        {thinkingSteps.map((s, i) => <p key={i} className="text-[9px] text-gray-500 font-mono">{s}</p>)}
                      </div>
                    )}
                  </div>
                ) : previewUrl ? (
                  <>
                    <div className="shrink-0 border-b border-gray-200/60 bg-white px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-red-400/50" /><div className="w-2 h-2 rounded-full bg-yellow-400/50" /><div className="w-2 h-2 rounded-full bg-green-400/50" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="px-2 py-1 rounded-lg bg-gray-100 text-[9px] text-gray-500 truncate">
                            {selectedTemplate && !siteId ? `${locale === "zh" ? "模板预览" : "Template Preview"} · ${previewUrl}` : previewUrl}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-lg text-[9px] ${siteStatus === "published" ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-700"}`}>
                          {siteStatus === "published" ? (locale === "zh" ? "已发布" : "Published") : (locale === "zh" ? "草稿" : "Draft")}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="px-2.5 py-1 rounded-lg bg-accent/10 text-[10px] text-accent">
                          {locale === "zh" ? "内容来源" : "Content Source"}: {contentSourceLabel}
                        </span>
                        <button onClick={() => setPreviewTab("prd")} className="px-2.5 py-1 rounded-lg bg-gray-100 text-[10px] text-gray-600 hover:bg-gray-200 transition-all">
                          {locale === "zh" ? "查看 PRD" : "View PRD"}
                        </button>
                        <button onClick={() => setPreviewTab("resources")} className="px-2.5 py-1 rounded-lg bg-gray-100 text-[10px] text-gray-600 hover:bg-gray-200 transition-all">
                          {locale === "zh" ? "查看资源" : "View Resources"}
                        </button>
                        <button onClick={() => quickGenerate()} className="px-2.5 py-1 rounded-lg bg-gray-100 text-[10px] text-gray-600 hover:bg-gray-200 transition-all">
                          {locale === "zh" ? "重新生成预览" : "Regenerate"}
                        </button>
                        {siteStatus === "published" ? (
                          <button onClick={() => void handleUnpublish()} className="px-2.5 py-1 rounded-lg bg-gray-900 text-[10px] text-white hover:bg-gray-800 transition-all">
                            {locale === "zh" ? "取消发布" : "Unpublish"}
                          </button>
                        ) : (
                          <button onClick={() => void handlePublish()} className="px-2.5 py-1 rounded-lg bg-accent text-[10px] text-white hover:bg-accent/90 transition-all">
                            {locale === "zh" ? "发布站点" : "Publish"}
                          </button>
                        )}
                        <a href={publishedUrl || previewUrl} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 rounded-lg bg-gray-100 text-[10px] text-gray-600 hover:bg-gray-200 transition-all">
                          {locale === "zh" ? "新窗口打开" : "Open"}
                        </a>
                      </div>
                      {publishedUrl && (
                        <p className="mt-2 text-[10px] text-gray-500">
                          {locale === "zh" ? "发布域名：" : "Published URL: "}
                          <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                            {publishedUrl}
                          </a>
                        </p>
                      )}
                      {selectedTemplate && !siteId && (
                        <p className="mt-2 text-[10px] text-gray-500">
                          {locale === "zh"
                            ? `当前展示的是模板案例预览「${selectedTemplate.nameCn}」。发送你的资料或修改要求后，会基于这个模板生成你的专属站点。`
                            : `You are currently viewing the "${selectedTemplate.name}" demo preview. Once you send your content or edit requests, the system will generate your own site from this template.`}
                        </p>
                      )}
                    </div>
                    <iframe key={previewKey} src={`${previewUrl}?t=${previewKey}`} className="flex-1 w-full border-0 bg-white" title="Preview" />
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center"><p className="text-xs text-gray-500">{locale === "zh" ? "回答几个问题后会自动生成首版预览" : "A first preview appears automatically after a few questions"}</p></div>
                )
              )}

              {/* PRD tab */}
              {previewTab === "prd" && (
                prdData ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* PRD header */}
                    <div className="shrink-0 px-4 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">v{prdData.version || 1}{prdData.siteType ? ` · ${prdData.siteType}` : ""}</span>
                      <button onClick={() => setPreviewTab("preview")} className="px-3 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px] hover:bg-gray-200 transition-all">
                        {locale === "zh" ? "返回预览" : "Back to Preview"}
                      </button>
                    </div>
                    {/* PRD content */}
                    <div className="flex-1 overflow-y-auto bg-white">
                      <div className="p-5 max-w-none prose prose-sm prose-gray prose-headings:text-gray-800 prose-p:text-gray-600 prose-li:text-gray-600 prose-strong:text-gray-800 prose-code:text-accent prose-code:bg-accent/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {prdData.markdown || JSON.stringify(prdData, null, 2)}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-2">{locale === "zh" ? "尚未生成 PRD" : "No PRD yet"}</p>
                      <p className="text-[10px] text-gray-400">{locale === "zh" ? "在对话中描述需求，AI 将生成 PRD 文档" : "Describe your needs in chat to generate PRD"}</p>
                    </div>
                  </div>
                )
              )}

              {previewTab === "resources" && (
                <div className="flex-1 overflow-y-auto bg-white">
                  <div className="p-5 border-b border-gray-200/60">
                    <h3 className="text-sm font-medium text-gray-800">{locale === "zh" ? "项目资源" : "Project Resources"}</h3>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {locale === "zh"
                        ? "这里保留本次网站生成关联的 PRD 与知识引用，方便后续修改时回看。"
                        : "This keeps the PRD and referenced knowledge linked to the current site for later review."}
                    </p>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-gray-700">PRD</p>
                          <p className="mt-1 text-[11px] text-gray-500">
                            {prdData
                              ? (locale === "zh" ? "当前预览对应的需求设计文档" : "The requirements document tied to this preview")
                              : (locale === "zh" ? "当前还没有 PRD 文档" : "No PRD available yet")}
                          </p>
                        </div>
                        {prdData && (
                          <button onClick={() => setPreviewTab("prd")} className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-[10px] text-gray-600 hover:bg-gray-100 transition-all">
                            {locale === "zh" ? "查看 PRD" : "Open PRD"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-gray-700">{locale === "zh" ? "知识引用" : "Knowledge References"}</p>
                          <p className="mt-1 text-[11px] text-gray-500">
                            {locale === "zh"
                              ? `${siteResources.length} 条被用于本次网站构建和后续修改`
                              : `${siteResources.length} references were used for this site build and future edits`}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        {siteResources.length > 0 ? siteResources.map((resource) => (
                          <div key={resource.id} className="rounded-lg bg-white border border-gray-200 px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[11px] font-medium text-gray-700 truncate">{resource.title}</p>
                              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[9px] text-gray-500">{resource.category}</span>
                            </div>
                            <p className="mt-1 text-[10px] text-gray-500">{resource.sourceName} · {resource.sourceType}</p>
                          </div>
                        )) : (
                          <p className="text-[11px] text-gray-500">
                            {locale === "zh" ? "当前还没有记录知识引用。选中知识条目并生成后会显示在这里。" : "No knowledge references recorded yet. They appear here after you build with selected knowledge."}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>}
        </>}

        {/* ====== SOURCES VIEW (full width) ====== */}
        {view === "sources" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="shrink-0 px-6 py-4 border-b border-gray-200/60 flex items-center justify-between">
              <div><h2 className="text-lg font-bold">{locale === "zh" ? "数据源管理" : "Source Management"}</h2><p className="text-xs text-gray-500 mt-0.5">{locale === "zh" ? "上传文件或添加链接，AI 将分析内容并提取知识" : "Upload files or add links, AI will analyze and extract knowledge"}</p></div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {/* Drag & drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("border-accent", "bg-accent/5"); }}
                  onDragLeave={e => { e.currentTarget.classList.remove("border-accent", "bg-accent/5"); }}
                  onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove("border-accent", "bg-accent/5"); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center cursor-pointer hover:border-gray-300 transition-all"
                >
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gray-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  </div>
                  <p className="text-sm text-gray-400">{locale === "zh" ? "拖拽文件到此处，或点击上传" : "Drop files here, or click to upload"}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{locale === "zh" ? "支持 PDF、DOCX、TXT、MD、ZIP" : "Supports PDF, DOCX, TXT, MD, ZIP"}</p>
                </div>

                {/* Source type buttons for URLs */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 shrink-0">{locale === "zh" ? "或添加链接：" : "Or add links:"}</span>
                  {(Object.keys(SOURCE_TYPE_META) as SourceType[]).filter(t => !["pdf", "zip", "docx", "txt", "md"].includes(t)).map(type => {
                    const m = SOURCE_TYPE_META[type];
                    return <button key={type} onClick={() => setAddMode(addMode === type ? null : type)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-all ${addMode === type ? "bg-accent/10 text-accent border border-accent/30" : "bg-gray-50 text-gray-400 border border-transparent hover:bg-gray-100"}`}><span>{m.icon}</span><span>{m.label}</span></button>;
                  })}
                </div>

                {addMode && !["pdf", "zip"].includes(addMode) && (
                  <div className="flex gap-3"><input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder={SOURCE_TYPE_META[addMode].placeholder} className="flex-1 px-4 py-3 rounded-xl bg-gray-100 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-accent/50" onKeyDown={e => { if (e.key === "Enter" && urlInput.trim()) addUrlSource(urlInput.trim(), addMode); }} /><button onClick={() => urlInput.trim() && addUrlSource(urlInput.trim(), addMode)} className="px-6 py-3 rounded-xl bg-accent text-white text-sm">添加</button></div>
                )}

                {/* Active uploads */}
                {sources.length > 0 && <div className="space-y-2">{sources.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-4 rounded-xl bg-gray-50/50 border border-gray-200/60">
                    <span className="text-lg">{SOURCE_TYPE_META[s.type].icon}</span>
                    <div className="flex-1"><p className="text-sm text-gray-600">{s.name}</p><p className={`text-xs ${s.status === "done" ? "text-green-400" : s.status === "error" ? "text-red-400" : "text-accent"}`}>{s.status === "analyzing" ? "分析中..." : s.status === "done" ? "已完成" : s.error || "等待中"}</p></div>
                    {s.status === "analyzing" && <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />}
                  </div>
                ))}</div>}

                {/* Pending review */}
                {pendingItems.length > 0 && (
                  <div className="rounded-xl border border-accent/20 bg-accent/5 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">{locale === "zh" ? `解析完成 — ${pendingItems.filter(i => i.selected).length} 条待保存` : `Parsed — ${pendingItems.filter(i => i.selected).length} items to save`}</h3>
                      <div className="flex gap-2">
                        <button onClick={() => setPendingItems([])} className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs text-gray-400">{locale === "zh" ? "丢弃" : "Discard"}</button>
                        <button onClick={savePendingToKB} className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs">{locale === "zh" ? "保存到知识库" : "Save to Knowledge"}</button>
                      </div>
                    </div>
                    {saveError && <p className="text-xs text-red-400">{saveError}</p>}
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {pendingItems.map(it => (
                        <div key={it.id} className={`flex items-start gap-2 p-2 rounded-lg ${it.selected ? "bg-gray-50" : "opacity-30"}`}>
                          <button onClick={() => togglePendingItem(it.id)} className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center ${it.selected ? "bg-accent border-accent" : "border-gray-300"}`}>{it.selected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</button>
                          <div className="flex-1 min-w-0"><p className="text-xs text-gray-600 truncate">{it.title}</p><p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{it.content}</p></div>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${CATEGORY_META[it.category as KnowledgeCategory]?.color}`}>{CATEGORY_META[it.category as KnowledgeCategory]?.icon}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Existing sources */}
                {sourceGroups.length > 0 && <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-400">{locale === "zh" ? "已有数据源" : "Existing Sources"}</h3>
                  {sourceGroups.map(g => (
                    <div key={g.sourceId} className="flex items-center gap-3 p-4 rounded-xl bg-gray-50/50 border border-gray-200/60 group">
                      <span className="text-lg">{SOURCE_TYPE_META[g.sourceType as SourceType]?.icon || "📎"}</span>
                      <div className="flex-1"><p className="text-sm text-gray-500">{g.sourceName}</p><p className="text-[10px] text-gray-500">{g.items.length} {locale === "zh" ? "条知识" : "items"}</p></div>
                      <button onClick={() => { if (confirm(locale === "zh" ? "确认删除该数据源及其所有知识？" : "Delete this source and all its knowledge?")) removeSource(g.sourceId); }} className="opacity-0 group-hover:opacity-100 px-3 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs">{locale === "zh" ? "删除" : "Remove"}</button>
                    </div>
                  ))}
                </div>}
              </div>
            </div>
          </div>
        )}

        {/* ====== KNOWLEDGE VIEW (folder-based) ====== */}
        {view === "knowledge" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="shrink-0 px-6 py-4 border-b border-gray-200/60 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">{locale === "zh" ? "知识库" : "Knowledge Base"}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{kGroups.length} {locale === "zh" ? "个知识组" : "groups"} · {selectedCount}/{items.length} {locale === "zh" ? "条已选" : "selected"}</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="text" placeholder={locale === "zh" ? "搜索知识..." : "Search..."} value={knowledgeSearch} onChange={e => setKnowledgeSearch(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-xs text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-accent/50 w-48" />
                <button onClick={async () => { const allSel = items.every(i => i.selected); const newVal = !allSel; setItems(p => p.map(i => ({ ...i, selected: newVal }))); await fetch("/api/knowledge", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selected: newVal }) }); await loadGroups(); }} className="px-3 py-1.5 rounded-lg bg-gray-100 text-[10px] text-gray-400 hover:bg-gray-200/50 transition-all">
                  {items.every(i => i.selected) ? (locale === "zh" ? "全部取消" : "Deselect all") : (locale === "zh" ? "全部选择" : "Select all")}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {!itemsLoaded ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}</div>
              : kGroups.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center"><span className="text-2xl opacity-30">📚</span></div>
                  <p className="text-gray-500">{locale === "zh" ? "暂无知识。前往数据源添加内容。" : "No knowledge. Add sources first."}</p>
                  <button onClick={() => setView("sources")} className="mt-4 px-4 py-2 rounded-lg bg-accent/10 text-accent text-xs hover:bg-accent/20 transition-all">{locale === "zh" ? "添加数据源" : "Add Sources"}</button>
                </div>
              ) : expandedGroupId ? (
                /* ── Expanded: show single group's items ── */
                (() => {
                  const g = kGroups.find(g => g.id === expandedGroupId);
                  if (!g) return null;
                  const allSel = g.selectedCount === g.itemCount;
                  const someSel = g.selectedCount > 0 && g.selectedCount < g.itemCount;
                  const filtered = knowledgeSearch ? groupItems.filter(i => i.title.toLowerCase().includes(knowledgeSearch.toLowerCase()) || i.content.toLowerCase().includes(knowledgeSearch.toLowerCase())) : groupItems;

                  return (
                    <div className="max-w-4xl mx-auto">
                      {/* Back + group header */}
                      <button onClick={() => { setExpandedGroupId(null); setGroupItems([]); }} className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-4">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        {locale === "zh" ? "返回知识库" : "Back to list"}
                      </button>

                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-2xl shadow-sm">
                          {SOURCE_TYPE_META[g.sourceType as SourceType]?.icon || "📁"}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-800">{g.name}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            {g.tags.map((tag: string) => <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-accent/8 text-accent">{tag}</span>)}
                            <span className="text-[10px] text-gray-400">{g.selectedCount}/{g.itemCount} {locale === "zh" ? "条已选" : "selected"}</span>
                          </div>
                        </div>
                        <button onClick={async () => {
                          const newVal = !allSel;
                          const ids = groupItems.map(it => it.id);
                          setGroupItems(p => p.map(i => ({ ...i, selected: newVal })));
                          await fetch("/api/knowledge", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, selected: newVal }) });
                          await loadGroups(); await loadKnowledge();
                        }} className={`px-3 py-1.5 rounded-lg text-xs transition-all ${allSel ? "bg-accent text-white" : "bg-gray-100 text-gray-500"}`}>
                          {allSel ? (locale === "zh" ? "取消全选" : "Deselect all") : (locale === "zh" ? "全选" : "Select all")}
                        </button>
                      </div>

                      {/* Items grid */}
                      <div className="space-y-2">
                        {filtered.map(it => {
                          const cm = CATEGORY_META[it.category as KnowledgeCategory];
                          return (
                            <div key={it.id} className={`p-4 rounded-xl border transition-all group ${it.selected ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100 opacity-40"}`}>
                              <div className="flex items-start gap-3">
                                <button onClick={async () => {
                                  await fetch(`/api/knowledge/${it.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selected: !it.selected }) });
                                  setGroupItems(p => p.map(i => i.id === it.id ? { ...i, selected: !i.selected } : i));
                                  await loadGroups();
                                }} className={`mt-1 w-4 h-4 rounded border shrink-0 flex items-center justify-center ${it.selected ? "bg-accent border-accent" : "border-gray-300"}`}>
                                  {it.selected && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${cm?.color}`}>{cm?.icon} {cm?.label}</span>
                                    <span className="text-sm font-medium text-gray-700">{it.title}</span>
                                  </div>
                                  <p className="text-[12px] text-gray-500 leading-relaxed whitespace-pre-wrap">{it.content}</p>
                                  {it.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">{it.tags.map((tag: string, i: number) => <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">{tag}</span>)}</div>
                                  )}
                                </div>
                                <button onClick={async () => { if (confirm(locale === "zh" ? "确认删除？" : "Delete?")) { await fetch(`/api/knowledge/${it.id}`, { method: "DELETE" }); setGroupItems(p => p.filter(i => i.id !== it.id)); await loadGroups(); } }}
                                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* ── Folder list (default) ── */
                <div className="max-w-4xl mx-auto space-y-3">
                  {kGroups.map(g => {
                    const allSel = g.selectedCount === g.itemCount;
                    const someSel = g.selectedCount > 0 && g.selectedCount < g.itemCount;
                    return (
                      <div key={g.id} className="flex items-center gap-4 p-4 rounded-xl bg-white border border-gray-200 hover:border-accent/30 hover:shadow-sm transition-all cursor-pointer"
                        onClick={async () => {
                          setExpandedGroupId(g.id);
                          const r = await fetch(`/api/knowledge-groups/${g.id}`);
                          const d = await r.json();
                          setGroupItems(d.items || []);
                        }}>
                        <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-xl">
                          {SOURCE_TYPE_META[g.sourceType as SourceType]?.icon || "📁"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-gray-800 truncate">{g.name}</h3>
                            {g.tags.slice(0, 3).map((tag: string) => <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-accent/8 text-accent">{tag}</span>)}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-gray-400">{g.itemCount} {locale === "zh" ? "条知识" : "items"}</span>
                            <span className="text-[10px] text-gray-300">·</span>
                            {Object.entries(g.categoryCounts).map(([cat, count]) => (
                              <span key={cat} className={`text-[8px] px-1 py-0.5 rounded ${CATEGORY_META[cat as KnowledgeCategory]?.color}`}>{CATEGORY_META[cat as KnowledgeCategory]?.icon} {count}</span>
                            ))}
                          </div>
                        </div>
                        <button onClick={async (e) => {
                          e.stopPropagation();
                          const newVal = !allSel;
                          const r = await fetch(`/api/knowledge-groups/${g.id}`); const d = await r.json();
                          const ids = (d.items || []).map((it: KnowledgeItem) => it.id);
                          await fetch("/api/knowledge", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, selected: newVal }) });
                          await loadGroups(); await loadKnowledge();
                        }} className={`w-6 h-6 rounded border shrink-0 flex items-center justify-center ${allSel ? "bg-accent border-accent" : someSel ? "bg-accent/40 border-accent/60" : "border-gray-300"}`}>
                          {(allSel || someSel) && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={allSel ? "M5 13l4 4L19 7" : "M5 12h14"} /></svg>}
                        </button>
                        <button onClick={async (e) => { e.stopPropagation(); if (confirm(locale === "zh" ? "确认删除？" : "Delete?")) { await fetch(`/api/knowledge-groups/${g.id}`, { method: "DELETE" }); await loadKnowledge(); await loadGroups(); } }}
                          className="text-gray-300 hover:text-red-400 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                        <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
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

function generateIndexMd(name: string, description: string, tags: string[], items: KnowledgeItem[]): string {
  const catCounts = items.reduce<Record<string, number>>((a, i) => { a[i.category] = (a[i.category] || 0) + 1; return a; }, {});
  const catSummary = Object.entries(catCounts).map(([c, n]) => `- ${c}: ${n} items`).join("\n");
  const itemList = items.map((it, i) => `${i + 1}. [${it.category}] ${it.title}`).join("\n");

  return `# ${name}

## Trigger
Use this knowledge group when building websites related to: ${tags.join(", ") || name}.

## Summary
${description}

## Categories
${catSummary}

## Items
${itemList}

## Key Information
${items.filter(i => i.category === "factual" || i.category === "meta").map(i => `- ${i.title}: ${i.content.slice(0, 100)}`).join("\n") || "See items for details."}
`;
}
