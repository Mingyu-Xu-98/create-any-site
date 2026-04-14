"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import { useLocale } from "@/components/LocaleProvider";
import type { KnowledgeItem, Source, SourceType, KnowledgeCategory } from "@/lib/knowledge";
import type { UserSelections, WorkspaceData } from "@/lib/types";
import { CATEGORY_META, SOURCE_TYPE_META } from "@/lib/knowledge";
import { getAutoLayout } from "@/lib/questions";
import { getImageTasks } from "@/lib/image-prompts";
import dynamic from "next/dynamic";
const KnowledgeGraph = dynamic(() => import("@/components/KnowledgeGraph"), { ssr: false });
import { buildWorkspaceDataFromKnowledge, buildWorkspaceDataFromSpec, deriveSelectionsFromSpec, type SiteSpec } from "@/lib/site-spec";
import { TEMPLATE_CASES } from "@/lib/template-showcase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const THEME_POOL = ["cyberpunk", "minimalist", "ghibli", "glassmorphism", "retro", "brutalist", "cinematic", "bold-creative", "editorial", "nature", "gradient-mesh", "neo-tokyo", "watercolor", "terminal-green", "vaporwave", "craft-paper", "aurora", "ink-wash"] as const;
function pickRandomTheme(): typeof THEME_POOL[number] { return THEME_POOL[Math.floor(Math.random() * THEME_POOL.length)]; }

type View = "build" | "sources" | "knowledge";
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  thinking?: string[];
  kind?: "message" | "prd";
}
interface OptionCard { id: string; icon: string; label: string; desc: string }
interface PRDData { version?: number; siteType?: string; targetAudience?: string; coreGoal?: string; theme?: string; layout?: string; planner?: string; markdown?: string; [key: string]: unknown }
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

function textIncludes(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function isPrdMarkdown(content: string): boolean {
  return /^\s*#\s+(Website PRD|网站 PRD|Auto-generated PRD)/i.test(content) || /##\s+(Problem Statement|Solution|Target Audience|品牌|设计系统)/i.test(content);
}

function summarizePrd(content: string, locale: string): string {
  const headings = Array.from(content.matchAll(/^##\s+(.+)$/gm)).map((match) => match[1]).slice(0, 3);
  if (headings.length > 0) return headings.join(" · ");
  return locale === "zh" ? "查看本轮生成的需求设计文档" : "Open the generated requirements document";
}

function CreatePageInner() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useLocale();
  const templateId = searchParams.get("template");
  const selectedTemplate = TEMPLATE_CASES.find((item) => item.id === templateId) || null;

  const [view, setView] = useState<View>("build");

  // Site tracking (no conversation persistence — ephemeral chat)
  const [siteId, setSiteId] = useState<string | null>(null);
  const siteIdRef = useRef<string | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [kbSectionExpanded, setKbSectionExpanded] = useState(true);

  // Chat & Build
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [genStatus, setGenStatus] = useState<"idle" | "generating" | "ready">("idle");
  const [showPreview, setShowPreview] = useState(false);

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
  const [knowledgeViewMode, setKnowledgeViewMode] = useState<"list" | "graph">("list");
  const genMode = "advanced" as const;

  // Knowledge Bases (new KB system)
  interface KBBase { id: string; name: string; description: string | null; fileCount: number | null; totalChars: number | null }
  const [kbBases, setKbBases] = useState<KBBase[]>([]);
  const [selectedBaseIds, setSelectedBaseIds] = useState<string[]>([]);

  // Knowledge Groups
  interface KGGroup { id: string; name: string; description: string | null; tags: string[]; sourceFile: string | null; sourceType: string | null; indexMd: string | null; itemCount: number; selectedCount: number; categoryCounts: Record<string, number> }
  const [kGroups, setKGroups] = useState<KGGroup[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [groupItems, setGroupItems] = useState<KnowledgeItem[]>([]);
  const [loadedSkillIds, setLoadedSkillIds] = useState<string[]>([]);

  const generateImagesForSite = useCallback(async (args: {
    siteId: string;
    theme: string;
    data: WorkspaceData;
  }) => {
    const theme = args.theme as UserSelections["theme"];
    const projects = Array.isArray(args.data.projects)
      ? args.data.projects.map((project) => {
          const record = project as { title?: string; tags?: unknown };
          return {
            title: typeof record.title === "string" ? record.title : "Project",
            tags: Array.isArray(record.tags) ? record.tags.filter((item): item is string => typeof item === "string") : [],
          };
        })
      : [];

    const userName = typeof args.data.name === "string" ? args.data.name : "Creator";
    const tasks = getImageTasks(theme || pickRandomTheme(), userName, projects);
    if (tasks.length === 0) {
      return { attempted: 0, succeeded: 0, failed: 0, errors: [] as string[] };
    }

    const results = await Promise.all(tasks.map(async (task) => {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: task.prompt,
          filename: task.filename,
          style: theme,
          siteId: args.siteId,
        }),
      });
      if (!response.ok) {
        const body = await readJsonResponse<{ error?: string }>(response).catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(body.error || `Failed to generate ${task.filename}`);
      }
      return task.filename;
    }).map(promise => promise.then(
      (filename) => ({ ok: true as const, filename }),
      (error: unknown) => ({ ok: false as const, error: error instanceof Error ? error.message : "Unknown image generation error" }),
    )));

    const succeeded = results.filter((item) => item.ok).length;
    const errors = results.filter((item) => !item.ok).map((item) => item.error);
    return {
      attempted: tasks.length,
      succeeded,
      failed: tasks.length - succeeded,
      errors,
    };
  }, []);

  useEffect(() => { if (authStatus === "unauthenticated") router.push("/login"); }, [authStatus, router]);

  const loadKnowledge = useCallback(async () => {
    try { const r = await fetch("/api/knowledge"); if (r.ok) { const d = await r.json(); setItems(d.items || []); } } catch {}
    setItemsLoaded(true);
  }, []);

  const loadGroups = useCallback(async () => {
    try { const r = await fetch("/api/knowledge-groups"); if (r.ok) { const d = await r.json(); setKGroups(d.groups || []); } } catch {}
  }, []);

  const loadKnowledgeBases = useCallback(async () => {
    try { const r = await fetch("/api/kb"); if (r.ok) { const d = await r.json(); setKbBases(d.bases || []); } } catch {}
  }, []);

  useEffect(() => { if (session?.user) { loadKnowledge(); loadGroups(); loadKnowledgeBases(); } }, [session, loadKnowledge, loadGroups, loadKnowledgeBases]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages, pendingOptions, prdData]);

  // Guide tooltip state (first-time user onboarding)
  const [showGuideTips, setShowGuideTips] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("create-guide-seen")) {
      setShowGuideTips(true);
    }
  }, []);

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

  // Restore from URL — only siteId (for re-builds of existing sites)
  const lastRestoredKey = useRef<string>("");
  useEffect(() => {
    if (!session?.user) return;
    const sid = searchParams.get("siteId");
    if (!sid) return;
    setView("build");
    if (lastRestoredKey.current === sid) return;
    lastRestoredKey.current = sid;

    // If the site already has a build, redirect to edit workspace
    siteIdRef.current = sid;
    setSiteId(sid);
    fetch(`/api/sites/${sid}`).then(r => r.json()).then(sd => {
      if (sd.site?.previewUrl || sd.site?.buildStatus === "ready") {
        window.location.href = `/edit/${sid}`;
        return;
      }
      if (sd.site) {
        if (sd.site.prd) { try { setPrdData(JSON.parse(sd.site.prd)); } catch {} }
        if (sd.site.publishedUrl) setPublishedUrl(sd.site.publishedUrl);
        if (sd.site.status) setSiteStatus(sd.site.status as "draft" | "published" | "archived");
        if (sd.site.editorState) {
          try {
            const editorState = JSON.parse(sd.site.editorState);
            if (editorState?.compiledSpec) setCompiledSpec(editorState.compiledSpec);
            if (Array.isArray(editorState?.knowledgeRefs)) setSiteResources(editorState.knowledgeRefs);
          } catch {}
        }
      }
    }).catch(() => {});
  }, [searchParams, session]);

  const dismissGuideTips = useCallback(() => {
    setShowGuideTips(false);
    if (typeof window !== "undefined") localStorage.setItem("create-guide-seen", "1");
  }, []);

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

  // (autoSaveSite removed — sites are created by the build backend on success)

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
            theme: intent.theme || prdData?.theme || pickRandomTheme(),
            layout: intent.layout || prdData?.layout || getAutoLayout((intent.theme as string) || prdData?.theme || pickRandomTheme(), (intent.siteType as string) || prdData?.siteType || "portfolio"),
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

  // ─── Source upload ───
  const addFileSource = async (file: File, type: SourceType) => {
    const sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
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
    const sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
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
      await loadKnowledge(); await loadGroups(); router.push("/knowledge");
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
    setWorkingStatus("");
    if (showGuideTips) dismissGuideTips();

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
      const chatAbort = new AbortController();
      const chatTimeout = setTimeout(() => chatAbort.abort(), 300_000); // 5 min
      let r: Response;
      try {
        r = await fetch("/api/chat-build", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: chatAbort.signal,
          body: JSON.stringify({
            messages: newMsgs.map(m => ({ role: m.role, content: m.content })),
            knowledge: items.filter(i => i.selected),
            knowledgeBaseIds: selectedBaseIds,
            currentSelections: {},
            loadedSkills: loadedSkillIds,
            siteId: siteIdRef.current,
            currentPrd: prdData,
          }),
        });
      } finally {
        clearTimeout(chatTimeout);
      }
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
          changes?: Array<{ file: string; action: string; content?: string; search?: string; replace?: string }>;
          executionSteps?: string[];
          customTheme?: string;
        };
      }>(r);
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status} ${r.statusText}`);

      // Extract thinking steps from response
      const extractedThinking = (d.content?.match(/```thinking\s*([\s\S]*?)```/)?.[1] || "")
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (extractedThinking.length > 0) {
        setThinkingSteps(extractedThinking);
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
        updated = [...newMsgs, {
          role: "assistant" as const,
          content: cleanContent,
          thinking: extractedThinking.length > 0 ? extractedThinking : undefined,
          kind: d.action?.type === "prd" || isPrdMarkdown(cleanContent) ? "prd" : "message",
        }];
        setChatMessages(updated);
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
          theme: d.action.theme || pickRandomTheme(),
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
          const autoPrd: PRDData = { version: 1, siteType: d.action.siteType || "portfolio", theme: d.action.theme || pickRandomTheme(), markdown: `# Auto-generated PRD\n\nSite: ${d.action.siteType || "portfolio"}\nTheme: ${d.action.theme || pickRandomTheme()}\nLayout: ${d.action.layout || "auto"}\n\n${cleanContent}`, createdAt: new Date().toISOString() };
          setPrdData(autoPrd);
          setShowPreview(true); setPreviewTab("preview");
          handleGenerate({ ...d.action, skillIds: [...new Set([...loadedSkillIds, ...(Array.isArray(d.action.skillIds) ? d.action.skillIds : [])])], prd: autoPrd });
        } else {
          handleGenerate({ ...d.action, skillIds: [...new Set([...loadedSkillIds, ...(Array.isArray(d.action.skillIds) ? d.action.skillIds : [])])] });
        }
      } else if (d.action?.type === "orchestrate") {
        // Orchestrator decision — mostly informational
        const act = d.action as Record<string, unknown>;
        const intent = act.site_intent as Record<string, unknown> | undefined;
        if (intent?.type) {
          setWorkingStatus(locale === "zh" ? `网站类型: ${intent.type}` : `Site type: ${intent.type}`);
        }
      } else if (d.action?.type === "suggest_capability") {
        const act = d.action as Record<string, unknown>;
        const capName = (act.capability as string) || "";
        const reason = (act.reason as string) || "";
        setPendingOptions({
          question: locale === "zh" ? "建议安装能力" : "Suggested Capability",
          options: [
            { id: "install", icon: "🔧", label: locale === "zh" ? `安装 ${capName}` : `Install ${capName}`, desc: reason },
            { id: "skip", icon: "⏭️", label: locale === "zh" ? "跳过" : "Skip", desc: locale === "zh" ? "不安装，继续" : "Continue without it" },
          ],
          multiSelect: false,
        });
      }
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      const errMsg = isAbort
        ? (locale === "zh" ? "AI 响应超时（5分钟），请重试或简化请求" : "AI response timed out (5 min), please retry or simplify your request")
        : (err instanceof Error ? err.message : "Unknown error");
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
      const theme = (config.theme as string) || pickRandomTheme();
      const skillIds = Array.isArray(config.skillIds) ? config.skillIds : [];
      // ===== ADVANCED MODE: AI pipeline =====
      const agentPlan = config.compositionPlan as UserSelections["compositionPlan"] | undefined;
      const visualDir = config.visualDirection as Record<string, unknown> | undefined;

      // Merge visualDirection into compositionPlan if both exist
      const enrichedPlan = agentPlan ? {
        ...agentPlan,
        ...(visualDir ? { visualDirection: visualDir } : {}),
      } : undefined;

      const baseSelections: UserSelections = {
        siteType: ((config.siteType as UserSelections["siteType"]) || "portfolio"),
        theme: ((theme as UserSelections["theme"]) || pickRandomTheme()),
        layout: ((config.layout as UserSelections["layout"]) || getAutoLayout(theme, (config.siteType as string) || "portfolio")),
        customSiteType: "",
        customTheme: (config.customTheme as string) || "",
        customLayout: "",
        features: { chatbot: true, i18n: true, animations: true, share: true },
        mode: "advanced",
        compositionPlan: enrichedPlan,
      };

      // Skip compileSiteSpec if Design Agent already provided a compositionPlan
      let spec = null;
      let data: WorkspaceData;
      let selections: UserSelections;

      if (enrichedPlan) {
        // Design Agent path: plan already complete, just build WorkspaceData from knowledge
        setThinkingSteps(p => [...p, zh ? "🎨 Design Agent 已完成设计" : "🎨 Design Agent plan ready"]);
        data = buildWorkspaceDataFromKnowledge(sel);
        selections = baseSelections;
      } else {
        // Legacy advanced path: compile spec
        setThinkingSteps(p => [...p, zh ? "🧠 编译 Site Spec..." : "🧠 Compiling site spec..."]);
        spec = await compileSiteSpec({
          siteType: String(config.siteType || effectivePrd?.siteType || "portfolio"),
          theme,
          layout: String(config.layout || effectivePrd?.layout || baseSelections.layout),
          customTheme: String(config.customTheme || ""),
          conversationSummary: effectivePrd?.markdown || chatMessages.slice(-6).map(m => `${m.role}: ${m.content}`).join("\n"),
          techStackHints: Array.isArray(config.techStackHints) ? (config.techStackHints as string[]) : [],
          assetIdeas: Array.isArray(config.assetGenerationPlan) ? (config.assetGenerationPlan as string[]) : [],
        });
        data = spec ? buildWorkspaceDataFromSpec(spec, sel) : buildWorkspaceDataFromKnowledge(sel);
        selections = spec ? deriveSelectionsFromSpec(spec, baseSelections) : baseSelections;
      }

      setThinkingSteps(p => [...p, zh ? "📦 创建构建任务..." : "📦 Creating build job..."]);

      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, selections, skillIds, siteId: siteIdRef.current, prd: effectivePrd, spec, knowledgeRefs: getSelectedResourceRefs(), knowledgeBaseIds: selectedBaseIds }),
      });
      await handleGenerateResult(r, zh, theme, data);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      setGenStatus("idle"); setThinkingSteps([]);
      setChatMessages(p => [...p, { role: "assistant", content: locale === "zh"
        ? `❌ 生成失败：${errMsg}\n\n请根据上面的真实错误信息调整后重试。`
        : `❌ Generation failed: ${errMsg}\n\nPlease retry after addressing the specific error above.` }]);
    }
  };

  /** Shared: parse generate response, poll build status, update preview */
  const handleGenerateResult = async (r: Response, zh: boolean, theme: string, data: WorkspaceData | null) => {
    const genResult = await readJsonResponse<{ error?: string; logs?: string[]; jobId?: string; siteId?: string; status?: string }>(r);
    if (!r.ok) {
      const logText = Array.isArray(genResult?.logs) && genResult.logs.length > 0 ? `\n\n${genResult.logs.join("\n")}` : "";
      throw new Error(`${genResult?.error || "Generation failed"}${logText}`);
    }
    if (!genResult.jobId) throw new Error("Generation response missing job ID");
    if (genResult.siteId) { siteIdRef.current = genResult.siteId; setSiteId(genResult.siteId); }

    setThinkingSteps(p => [...p, zh ? "⏳ 任务已入队，等待构建..." : "⏳ Queued, waiting for build..."]);

    const pollStart = Date.now();
    let finished = false;
    while (!finished && Date.now() - pollStart < 300000) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const jobRes = await fetch(`/api/builds/${genResult.jobId}`, { cache: "no-store" });
      const jobResult = await readJsonResponse<{ error?: string; job?: { status: string; previewUrl?: string | null; error?: string | null; logs?: string[] } }>(jobRes);
      if (!jobRes.ok) throw new Error(jobResult.error || `HTTP ${jobRes.status}`);
      const job = jobResult.job;
      if (!job) throw new Error("Build job not found");

      if (job.status === "building") {
        const steps = Array.isArray(job.logs) && job.logs.length > 0
          ? job.logs as string[]
          : [zh ? "🏗️ 正在构建..." : "🏗️ Building..."];
        setThinkingSteps(steps);
        continue;
      }
      if (job.status === "ready") {
        const url = job.previewUrl;
        if (!url) throw new Error("Build completed without preview URL");
        setThinkingSteps([zh ? "✅ 构建完成" : "✅ Build completed"]);
        if (genResult.siteId && data) {
          setThinkingSteps([zh ? "🎨 正在生成配图..." : "🎨 Generating images..."]);
          const imageSummary = await generateImagesForSite({ siteId: genResult.siteId, theme, data });
          if (imageSummary?.attempted > 0) {
            const msg = imageSummary.failed > 0
              ? (zh ? `🎨 配图：${imageSummary.succeeded}/${imageSummary.attempted} 张成功` : `🎨 Images: ${imageSummary.succeeded}/${imageSummary.attempted} succeeded`)
              : (zh ? `✅ 配图生成完成：${imageSummary.succeeded} 张` : `✅ ${imageSummary.succeeded} images generated`);
            setChatMessages(prev => [...prev, { role: "assistant", content: msg }]);
            if (imageSummary.errors.length > 0) {
              console.warn("[image-gen] errors:", imageSummary.errors);
            }
          }
        }
        setPreviewUrl(url); setGenStatus("ready"); setShowPreview(true); setPreviewTab("preview"); setPreviewKey(k => k + 1);
        finished = true; break;
      }
      if (job.status === "failed") {
        const logText = Array.isArray(job.logs) && job.logs.length > 0 ? `\n\n${job.logs.join("\n")}` : "";
        throw new Error(`${job.error || "Build failed"}${logText}`);
      }
    }
    if (!finished) throw new Error(zh ? "构建超时" : "Build timed out");
    setThinkingSteps([]);
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
        theme: String(prdData?.theme || pickRandomTheme()),
        layout: String(prdData?.layout || "card-grid"),
        conversationSummary: `${nextPrd?.markdown || prdData?.markdown || ""}\n\n${action.description || ""}\n${action.specIntent || ""}\n${chatMessages.slice(-4).map(m => `${m.role}: ${m.content}`).join("\n")}`.trim(),
        techStackHints: Array.isArray(action.techStackHints) ? action.techStackHints : [],
        assetIdeas: Array.isArray(action.assetIdeas) ? action.assetIdeas : [],
      });

      const r = await fetch("/api/modify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: siteIdRef.current, changes: action.changes, spec, prd: nextPrd || prdData, knowledgeRefs: getSelectedResourceRefs(), knowledgeBaseIds: selectedBaseIds }),
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

  const updateSitePublishState = useCallback(async (action: "publish" | "unpublish") => {
    if (!siteIdRef.current) return;
    const response = await fetch(`/api/sites/${siteIdRef.current}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await readJsonResponse<{ error?: string; site?: { status?: "draft" | "published" | "archived"; publishedUrl?: string | null } }>(response);
    if (!response.ok) throw new Error(data.error || "Failed to update publish state");
    setSiteStatus((data.site?.status || (action === "publish" ? "published" : "draft")) as "draft" | "published" | "archived");
    setPublishedUrl(data.site?.publishedUrl || null);
  }, []);

  const handlePublish = useCallback(async () => {
    if (!siteIdRef.current) return;
    try {
      const defaultName = prdData?.theme ? `${prdData.theme} site` : "My Site";
      const name = prompt(locale === "zh" ? "请给这个网站起个名字（方便在 Dashboard 中区分）：" : "Name this site (for your Dashboard):", defaultName);
      if (name === null) return; // user cancelled
      if (name.trim()) {
        await fetch(`/api/sites/${siteIdRef.current}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
      }
      await updateSitePublishState("publish");
      // Redirect to dashboard after successful publish
      router.push("/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      alert(locale === "zh" ? `发布失败：${msg}` : `Publish failed: ${msg}`);
    }
  }, [updateSitePublishState, prdData, locale, router]);

  const handleUnpublish = useCallback(async () => {
    if (!siteIdRef.current) return;
    try {
      await updateSitePublishState("unpublish");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      alert(locale === "zh" ? `取消发布失败：${msg}` : `Unpublish failed: ${msg}`);
    }
  }, [updateSitePublishState, locale]);

  const quickGenerate = () => handleGenerate({
    siteType: selectedTemplate?.category || "portfolio",
    theme: selectedTemplate?.theme || pickRandomTheme(),
    layout: selectedTemplate?.layout || undefined,
    prd: prdData || undefined,
  });
  const newConversation = () => {
    if (chatMessages.length > 0 && !confirm(locale === "zh" ? "当前对话将丢失，确定开始新对话？" : "Current conversation will be lost. Start new?")) return;
    siteIdRef.current = null; lastRestoredKey.current = ""; appliedTemplateIdRef.current = ""; setSiteId(null); setChatMessages([]); setPreviewUrl(null); setPublishedUrl(null); setSiteStatus("draft"); setSiteResources([]); setGenStatus("idle"); setShowPreview(false); setLoadedSkillIds([]); setPrdData(null); setCompiledSpec(null); setPendingOptions(null); setThinkingSteps([]); setPreviewTab("preview"); setPreviewKey(0); router.replace("/create");
  };

  if (authStatus === "loading" || !session?.user) return null;

  const selectedCount = items.filter(i => i.selected).length;
  const sourceGroups = getSourceGroups(items);
  const currentStep = publishedUrl ? 4 : previewUrl ? 3 : chatMessages.length > 0 || pendingOptions ? 2 : 1;
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
      onClick: () => router.push("/knowledge"),
      tone: "accent",
    },
    {
      label: locale === "zh" ? "管理知识库" : "Manage Knowledge",
      onClick: () => router.push("/knowledge"),
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
  const siteTypeHint = String(prdData?.siteType || selectedTemplate?.category || "").toLowerCase();
  const themeHint = String(prdData?.theme || selectedTemplate?.theme || "").toLowerCase();
  const latestUserMessage = [...chatMessages].reverse().find((item) => item.role === "user")?.content || "";
  const latestAssistantMessage = [...chatMessages].reverse().find((item) => item.role === "assistant")?.content || "";
  const recentConversation = `${latestUserMessage}\n${latestAssistantMessage}`.toLowerCase();
  const wantsVisualPolish = textIncludes(recentConversation, [/视觉|动效|配色|风格|hero|动画|aesthetic/i]);
  const wantsStorytelling = textIncludes(recentConversation, [/品牌|故事|叙事|about|story/i]);
  const wantsConversion = textIncludes(recentConversation, [/cta|联系|转化|销售|咨询|预约|lead/i]);
  const wantsShowcase = textIncludes(recentConversation, [/项目|案例|作品|project|case study|portfolio/i]);
  const isBrandSite = /brand|landing|saas/.test(siteTypeHint);
  const isPortfolioSite = /portfolio|resume|personal/.test(siteTypeHint);

  const nextStepCards: NextStepCard[] = (() => {
    const cards: NextStepCard[] = [];
    const push = (card: NextStepCard) => {
      if (!cards.some((item) => item.label === card.label)) cards.push(card);
    };

    if (previewUrl && genStatus === "ready") {
      if (!hasSelectedKnowledge) {
        push({ label: locale === "zh" ? "上传资料替换示例内容" : "Upload materials to replace sample content", onClick: () => router.push("/knowledge") });
      } else {
        push({ label: locale === "zh" ? "把我的资料映射到首页" : "Map my sources to the homepage", prompt: locale === "zh" ? "请优先用我的资料替换首页的标题、简介和主要 CTA" : "Use my uploaded materials to replace the homepage headline, intro, and main CTA first" });
      }

      if (siteStatus === "published") {
        push({ label: locale === "zh" ? "把当前草稿更新到已发布版本" : "Update the published version", prompt: locale === "zh" ? "请检查当前草稿是否已经适合更新发布，并优先修正影响上线的内容" : "Review the current draft for publication and prioritize fixes that affect the live version" });
      }

      if (wantsVisualPolish || /retro|cinematic|cyberpunk|neo-tokyo|ghibli|glass/.test(themeHint)) {
        push({ label: locale === "zh" ? "继续强化视觉表现" : "Push the visual direction further", prompt: locale === "zh" ? "保留当前结构，继续强化视觉层次、风格细节和动效表现" : "Keep the current structure and push the visual hierarchy, theme details, and motion further" });
      } else {
        push({ label: locale === "zh" ? "只调整视觉，不改结构" : "Refine visuals only", prompt: locale === "zh" ? "保留当前结构，只优化视觉层次、配色和动效" : "Keep the current structure and only improve visual hierarchy, color, and motion" });
      }

      if (wantsStorytelling || isBrandSite) {
        push({ label: locale === "zh" ? "优化品牌故事" : "Refine the brand story", prompt: locale === "zh" ? "请根据当前内容优化品牌故事、关于部分和叙事节奏" : "Refine the brand story, about section, and storytelling flow based on the current content" });
      }

      if (wantsShowcase || isPortfolioSite) {
        push({ label: locale === "zh" ? "强化项目案例展示" : "Strengthen project case studies", prompt: locale === "zh" ? "请把项目案例部分改得更有说服力，突出结果、过程和角色分工" : "Make the case study section more convincing and highlight outcomes, process, and role clearly" });
      }

      if (wantsConversion || isBrandSite) {
        push({ label: locale === "zh" ? "优化 CTA 和联系区" : "Improve CTA and contact", prompt: locale === "zh" ? "优化当前网站的 CTA 和联系区，让转化路径更明确" : "Improve the CTA and contact section to make the conversion path clearer" });
      }

      if (cards.length < 4) {
        push({ label: locale === "zh" ? "补充案例与项目展示" : "Add stronger showcase sections", prompt: locale === "zh" ? "补充更完整的案例、项目或证明实力的模块" : "Add stronger case study, project, or proof sections" });
      }

      return cards.slice(0, 4);
    }

    if (selectedTemplate) {
      push({ label: locale === "zh" ? "用我的信息替换模板内容" : "Replace template content with my info", prompt: locale === "zh" ? "请根据我刚才提供的信息替换模板里的示例内容" : "Replace the sample template content with the information I just provided" });
      push({ label: locale === "zh" ? "保留结构，只改语气" : "Keep structure, change tone", prompt: locale === "zh" ? "保留当前模板结构，只把语气改成更符合我的品牌风格" : "Keep the current template structure and only adapt the tone to my brand" });
      if (!hasSelectedKnowledge) push({ label: locale === "zh" ? "上传资料后再生成" : "Upload materials before generating", onClick: () => router.push("/knowledge") });
      push({ label: locale === "zh" ? "直接生成首版预览" : "Generate first preview now", onClick: () => quickGenerate() });
      return cards.slice(0, 4);
    }

    if (hasSelectedKnowledge) {
      push({ label: locale === "zh" ? "根据资料推荐网站定位" : "Recommend a site angle from my materials", prompt: locale === "zh" ? "根据我现在的资料推荐一个最适合的网站定位和结构" : "Recommend the best site positioning and structure based on my current materials" });
      push({ label: locale === "zh" ? "直接生成首版预览" : "Generate first preview now", onClick: () => quickGenerate() });
      push({ label: locale === "zh" ? "总结当前资料还缺什么" : "Summarize what is still missing", prompt: locale === "zh" ? "总结一下当前资料还缺哪些信息会影响网站效果" : "Summarize which missing information is still limiting the quality of the site" });
      push({ label: locale === "zh" ? "继续上传资料" : "Upload more materials", onClick: () => router.push("/knowledge") });
      return cards.slice(0, 4);
    }

    push({ label: locale === "zh" ? "先上传资料" : "Upload materials first", onClick: () => router.push("/knowledge") });
    push({ label: locale === "zh" ? "推荐适合我的网站结构" : "Recommend a site structure", prompt: locale === "zh" ? "根据我接下来的需求，推荐一个适合我的网站结构" : "Recommend a site structure based on what I need" });
    push({ label: locale === "zh" ? "先生成一个草稿" : "Generate a quick draft", prompt: locale === "zh" ? "先根据我的简单描述生成一个可预览的草稿" : "Generate a quick preview draft from a simple description first" });
    push({ label: locale === "zh" ? "我想做个人网站" : "I want a personal site", prompt: locale === "zh" ? "我想做一个个人网站，请先给我一个快速草稿" : "I want a personal site. Start with a quick draft first" });
    return cards.slice(0, 4);
  })();

  // ─── NAV items (simplified: only build tab, sources/knowledge moved to /knowledge page) ───
  const NAV = [
    { id: "build" as View, icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", label: locale === "zh" ? "构建" : "Build" },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar />
      <div className="flex-1 flex pt-14 overflow-hidden" ref={containerRef}>

        {/* ====== SIDEBAR — Knowledge selector + New chat ====== */}
        <div className={`shrink-0 border-r border-gray-200/40 flex flex-col bg-[#f9fafb] transition-all duration-200 ${sidebarExpanded ? "w-60" : "w-12"}`}>
          {/* Top: toggle + new conversation */}
          <div className={`flex items-center h-12 ${sidebarExpanded ? "px-3 justify-between" : "justify-center"}`}>
            <button onClick={() => setSidebarExpanded(!sidebarExpanded)} className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 transition-all">
              <svg className={`w-3.5 h-3.5 transition-transform ${sidebarExpanded ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
            </button>
            {sidebarExpanded && (
              <button onClick={newConversation} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all text-[12px] font-medium shadow-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {locale === "zh" ? "新对话" : "New Chat"}
              </button>
            )}
          </div>

          {/* Collapsed: icons */}
          {!sidebarExpanded && (
            <div className="flex flex-col items-center pt-2 gap-2">
              <button onClick={() => setSidebarExpanded(true)} className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200/50" title={locale === "zh" ? "知识库" : "Knowledge"}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </button>
            </div>
          )}

          {/* Expanded: knowledge selector */}
          {sidebarExpanded && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Knowledge section header */}
              <button onClick={() => setKbSectionExpanded(!kbSectionExpanded)} className="flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-200/30 transition-all">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                <span className="text-[12px] font-medium text-gray-600 flex-1">{locale === "zh" ? "知识库" : "Knowledge"}</span>
                {selectedBaseIds.length > 0 && <span className="text-[10px] text-accent font-medium">{selectedBaseIds.length}</span>}
                <svg className={`w-3 h-3 text-gray-400 transition-transform ${kbSectionExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {/* Guide tooltip */}
              {showGuideTips && kbSectionExpanded && (
                <div className="mx-2 mb-2 p-2.5 rounded-lg bg-accent/10 border border-accent/20 relative">
                  <button onClick={dismissGuideTips} className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center text-accent/50 hover:text-accent">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                  <p className="text-[10px] text-accent/80 pr-4">{locale === "zh" ? "上传简历、项目文档等资料，AI 会更好地理解你" : "Upload your resume, project docs — AI will understand you better"}</p>
                </div>
              )}

              {kbSectionExpanded && (
                <div className="flex-1 overflow-y-auto px-2">
                  {/* Knowledge Bases */}
                  {kbBases.map(kb => (
                    <button key={kb.id} onClick={() => setSelectedBaseIds(prev => prev.includes(kb.id) ? prev.filter(id => id !== kb.id) : [...prev, kb.id])} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all mb-0.5 ${selectedBaseIds.includes(kb.id) ? "bg-accent/10" : "hover:bg-gray-200/30"}`}>
                      <div className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center ${selectedBaseIds.includes(kb.id) ? "bg-accent border-accent" : "border-gray-300"}`}>
                        {selectedBaseIds.includes(kb.id) && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-gray-700 truncate">{kb.name}</p>
                        <p className="text-[9px] text-gray-400">{kb.fileCount || 0} {locale === "zh" ? "个文件" : "files"}</p>
                      </div>
                    </button>
                  ))}
                  {/* Legacy knowledge groups */}
                  {sourceGroups.map(g => {
                    const allSel = g.items.every(i => i.selected);
                    const someSel = g.items.some(i => i.selected);
                    return (
                      <button key={g.sourceId} onClick={() => toggleSourceGroup(g.sourceId)} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all mb-0.5 ${allSel ? "bg-accent/10" : "hover:bg-gray-200/30"}`}>
                        <div className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center ${allSel ? "bg-accent border-accent" : someSel ? "bg-accent/40 border-accent/60" : "border-gray-300"}`}>
                          {(allSel || someSel) && <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={allSel ? "M5 13l4 4L19 7" : "M5 12h14"} /></svg>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-gray-700 truncate">{g.sourceName}</p>
                          <p className="text-[9px] text-gray-400">{g.items.filter(i => i.selected).length}/{g.items.length} {locale === "zh" ? "条" : "items"}</p>
                        </div>
                      </button>
                    );
                  })}
                  {kbBases.length === 0 && sourceGroups.length === 0 && (
                    <p className="text-[10px] text-gray-400 text-center py-4">{locale === "zh" ? "暂无知识库" : "No knowledge yet"}</p>
                  )}
                </div>
              )}

              {/* Bottom: manage knowledge link */}
              {sidebarExpanded && (
                <div className="shrink-0 p-2 border-t border-gray-200/40">
                  <button onClick={() => router.push("/knowledge")} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] text-gray-500 hover:bg-gray-200/30 transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {locale === "zh" ? "管理知识库" : "Manage Knowledge"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Global file input (always in DOM) */}
        <input ref={fileRef} type="file" accept=".pdf,.zip,.docx,.doc,.txt,.md" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />

        {/* ====== BUILD VIEW ====== */}
        {view === "build" && <>
          {/* Chat */}
          <div className="flex flex-col overflow-hidden" style={{ width: showPreview ? `${splitPct}%` : "100%" }}>
            {/* Header — minimal, Claude-style */}
            <div className="shrink-0 h-12 px-4 border-b border-gray-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {selectedTemplate && (
                  <span className="text-[11px] text-gray-400 truncate">
                    {locale === "zh" ? selectedTemplate.nameCn : selectedTemplate.name}
                  </span>
                )}
              </div>
              {/* Preview toggle — only show when a site has been generated */}
              {previewUrl && (
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => setShowPreview(!showPreview)} className={`px-2.5 py-1.5 rounded-lg text-[10px] transition-all ${showPreview ? "bg-gray-100 text-gray-400" : "bg-accent/10 text-accent"}`}>
                    {showPreview ? (locale === "zh" ? "隐藏预览" : "Hide") : (locale === "zh" ? "显示预览" : "Show")}
                  </button>
                </div>
              )}
            </div>

            {/* Step bar — 4-step progress indicator */}
            <div className="shrink-0 px-4 py-2 border-b border-gray-100 flex items-center gap-0">
              {([
                { n: 1, zh: "准备资料", en: "Prepare" },
                { n: 2, zh: "对话设计", en: "Design" },
                { n: 3, zh: "生成预览", en: "Preview" },
                { n: 4, zh: "发布上线", en: "Publish" },
              ] as const).map((step, idx) => (
                <div key={step.n} className="flex items-center flex-1 min-w-0">
                  {idx > 0 && <div className={`h-px flex-1 ${currentStep > step.n - 1 ? "bg-accent/40" : "bg-gray-200"}`} />}
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] whitespace-nowrap transition-all ${
                    currentStep === step.n ? "bg-accent/10 text-accent font-medium" :
                    currentStep > step.n ? "text-accent/60" : "text-gray-400"
                  }`}>
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                      currentStep === step.n ? "bg-accent text-white" :
                      currentStep > step.n ? "bg-accent/30 text-white" : "bg-gray-200 text-gray-400"
                    }`}>
                      {currentStep > step.n ? <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : step.n}
                    </div>
                    {locale === "zh" ? step.zh : step.en}
                  </div>
                  {idx < 3 && <div className={`h-px flex-1 ${currentStep > step.n ? "bg-accent/40" : "bg-gray-200"}`} />}
                </div>
              ))}
            </div>

            {/* Messages — spacious, Claude-style */}
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto px-6">
                  <div className="w-10 h-10 rounded-full bg-accent/8 flex items-center justify-center mb-5">
                    <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <p className="text-base text-gray-800 font-medium mb-1">
                    {locale === "zh" ? "创建你的网站" : "Create your website"}
                  </p>
                  <div className="mb-6 flex items-center gap-3">
                    <button onClick={() => router.push("/knowledge")} className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-600 hover:border-accent/30 hover:text-accent transition-all shadow-sm">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      {locale === "zh" ? "上传资料" : "Upload materials"}
                    </button>
                    <button onClick={() => { sendChat(locale === "zh" ? "帮我做一个网站" : "Build me a website"); }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-all shadow-sm shadow-accent/20">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      {locale === "zh" ? "直接对话" : "Start chatting"}
                    </button>
                  </div>
                  {selectedCount > 0 && (
                    <p className="text-xs text-gray-400 mb-4">{locale === "zh" ? `已关联 ${selectedCount} 条知识` : `${selectedCount} knowledge items linked`}</p>
                  )}
                </div>
              )}
              {chatMessages.map((msg, i) => {
                // Check if user message is an option selection: [question] emoji label
                const optionMatch = msg.role === "user" && msg.content.match(/^\[(.+?)\]\s*(\S+)\s+(.+)$/);
                return (
                  <div key={i} className={`flex gap-2.5 animate-[fadeSlideIn_0.3s_ease] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    {/* Avatar */}
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${msg.role === "assistant" ? "bg-gradient-to-br from-accent/20 to-accent/5 ring-1 ring-accent/10" : "bg-gradient-to-br from-gray-100 to-gray-50 ring-1 ring-gray-200/60"}`}>
                      {msg.role === "assistant" ? (
                        <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      )}
                    </div>
                    {optionMatch ? (
                      <div className="rounded-xl overflow-hidden border border-accent/15 bg-accent/3 shadow-sm">
                        <div className="px-3 py-1 bg-accent/5 text-[10px] text-accent/70 font-medium">{optionMatch[1]}</div>
                        <div className="px-3 py-2 flex items-center gap-2">
                          <span className="text-sm">{optionMatch[2]}</span>
                          <span className="text-[13px] text-gray-700 font-medium">{optionMatch[3]}</span>
                        </div>
                      </div>
                    ) : (
                      <div className={`flex-1 min-w-0 text-[13px] leading-[1.7] ${msg.role === "user" ? "bg-gradient-to-br from-accent/8 to-accent/3 rounded-2xl rounded-tr-md px-3.5 py-2.5 text-gray-700 ring-1 ring-accent/10" : "text-gray-800"}`}>
                        {msg.role === "assistant" ? (
                          <div className="space-y-2">
                            {Array.isArray(msg.thinking) && msg.thinking.length > 0 && (
                              <details className="rounded-xl border border-gray-200 bg-white/70">
                                <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-medium text-gray-600 flex items-center justify-between">
                                  <span>{locale === "zh" ? "查看思考过程" : "View Thinking"}</span>
                                  <span className="text-[10px] text-gray-400">{msg.thinking.length} {locale === "zh" ? "条" : "steps"}</span>
                                </summary>
                                <div className="border-t border-gray-200 px-3 py-2 space-y-1">
                                  {msg.thinking.map((step, stepIndex) => (
                                    <p key={stepIndex} className="text-[10px] text-gray-500 font-mono">{step}</p>
                                  ))}
                                </div>
                              </details>
                            )}
                            {msg.kind === "prd" || isPrdMarkdown(msg.content) ? (
                              <details className="rounded-xl border border-accent/20 bg-white overflow-hidden">
                                <summary className="cursor-pointer list-none px-3 py-2.5 flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] font-medium text-gray-700">{locale === "zh" ? "PRD 文档" : "PRD Document"}</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5">{summarizePrd(msg.content, locale)}</p>
                                  </div>
                                  <span className="shrink-0 text-[10px] text-accent">{locale === "zh" ? "点击查看" : "Open"}</span>
                                </summary>
                                <div className="border-t border-accent/10 px-3 py-3 prose prose-sm prose-gray max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1 prose-code:text-accent prose-code:bg-accent/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-pre:rounded-lg prose-pre:my-2 text-[12px]">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                </div>
                              </details>
                            ) : (
                              <div className="prose prose-sm prose-gray max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0.5 prose-ul:my-1 prose-ol:my-1 prose-code:text-accent prose-code:bg-accent/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-pre:rounded-lg prose-pre:my-2 text-[12px]">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                              </div>
                            )}
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
                          className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all text-left hover:scale-[1.02] hover:shadow-md ${isSelected ? "border-accent bg-accent/5 shadow-sm shadow-accent/10 ring-1 ring-accent/20" : "border-gray-200/80 bg-white hover:border-accent/30 hover:shadow-accent/5"}`}>
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
            <div className="shrink-0 px-5 py-4 border-t border-gray-100 space-y-3">
              {!chatLoading && previewUrl && nextStepCards.length > 0 && (
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
              {/* Guide tooltip — chat input hint */}
              {showGuideTips && chatMessages.length === 0 && (
                <div className="relative mb-2 mx-1 px-3 py-2 rounded-xl bg-accent/5 border border-accent/15 text-[11px] text-accent/80">
                  {locale === "zh" ? "描述你想要的网站，或直接发送让 AI 帮你生成" : "Describe the site you want, or just send to let AI generate"}
                  <button onClick={dismissGuideTips} className="absolute top-1 right-1.5 w-4 h-4 flex items-center justify-center text-accent/40 hover:text-accent">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                  <div className="absolute bottom-0 left-6 translate-y-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-accent/15" />
                </div>
              )}
              {/* Input — Claude-style clean bottom bar OR completion card */}
              {previewUrl && genStatus === "ready" && siteStatus !== "published" ? (
                <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">&#10003;</span>
                    <span className="text-sm font-semibold text-gray-800">
                      {locale === "zh" ? "网站已生成完成！" : "Site generated successfully!"}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5 mb-3 border border-amber-100">
                    {locale === "zh"
                      ? "未发布的站点不会保存到「我的网站」"
                      : "Unpublished sites won't appear in My Sites"}
                  </p>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => void handlePublish()}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-all shadow-sm shadow-accent/20"
                    >
                      {locale === "zh" ? "发布站点" : "Publish Site"}
                    </button>
                    {siteId && (
                      <button
                        onClick={() => router.push(`/edit/${siteId}`)}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition-all"
                      >
                        {locale === "zh" ? "进入编辑" : "Edit Site"}
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 text-center">
                    {locale === "zh"
                      ? "效果不满意？发布后可在「我的网站」中点击编辑继续优化"
                      : "Not satisfied? Publish first, then edit from My Sites"}
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                    disabled={chatLoading || genStatus === "generating"}
                    placeholder={genStatus === "generating"
                      ? (locale === "zh" ? "正在生成中..." : "Generating...")
                      : previewUrl
                        ? (locale === "zh" ? "描述你想修改的内容..." : "Describe your changes...")
                        : (locale === "zh" ? "描述你想创建的网站..." : "Describe the site you want...")}
                    className="w-full pl-4 pr-12 py-3.5 rounded-2xl border border-gray-200/80 bg-gray-50/50 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-accent/30 focus:ring-2 focus:ring-accent/10 focus:bg-white disabled:opacity-40 transition-all shadow-sm"
                  />
                  <button
                    onClick={() => sendChat()}
                    disabled={!chatInput.trim() || chatLoading || genStatus === "generating"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-accent text-white flex items-center justify-center hover:bg-accent/90 hover:shadow-md hover:shadow-accent/20 disabled:opacity-20 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Splitter + Preview/PRD Panel */}
          {showPreview && <>
            <div onMouseDown={() => { dragging.current = true; document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }} className="w-1 shrink-0 bg-transparent hover:bg-accent/30 cursor-col-resize transition-colors" />
            <div className="flex flex-col overflow-hidden p-3 pl-0" style={{ width: `${100 - splitPct}%` }}>

              {/* Browser-style preview window */}
              <div className="flex-1 flex flex-col rounded-2xl overflow-hidden shadow-2xl shadow-black/8 border border-gray-200/60 bg-white">

              {/* Browser chrome header */}
              {previewUrl && genStatus !== "generating" && (
                <div className="shrink-0 bg-gradient-to-b from-gray-50 to-gray-100/80 px-3.5 py-2.5 border-b border-gray-200/50">
                  <div className="flex items-center gap-2.5">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57] shadow-sm shadow-[#ff5f57]/30" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e] shadow-sm shadow-[#febc2e]/30" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#28c840] shadow-sm shadow-[#28c840]/30" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/80 border border-gray-200/60 shadow-inner shadow-gray-100">
                        <svg className="w-2.5 h-2.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
                        <span className="text-[9px] text-gray-500 truncate font-mono">
                          {selectedTemplate && !siteId ? `${locale === "zh" ? "模板预览" : "Template"} · ${previewUrl}` : previewUrl}
                        </span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${siteStatus === "published" ? "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20" : "bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20"}`}>
                      {siteStatus === "published" ? (locale === "zh" ? "已发布" : "Published") : (locale === "zh" ? "草稿" : "Draft")}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button onClick={() => setPreviewTab("preview")} className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${previewTab === "preview" ? "bg-accent/10 text-accent ring-1 ring-accent/20" : "text-gray-500 hover:bg-gray-200/60"}`}>
                      {locale === "zh" ? "预览" : "Preview"}
                    </button>
                    <button onClick={() => setPreviewTab("resources")} className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${previewTab === "resources" ? "bg-accent/10 text-accent ring-1 ring-accent/20" : "text-gray-500 hover:bg-gray-200/60"}`}>
                      {locale === "zh" ? "资源" : "Resources"}
                      {(siteResources.length > 0 || selectedBaseIds.length > 0) && previewTab !== "resources" && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-accent inline-block animate-pulse" />}
                    </button>
                    <span className="border-l border-gray-200/60 mx-0.5" />
                    {siteStatus === "published" ? (
                      <>
                        <button onClick={() => void handlePublish()} disabled={genStatus !== "ready"} className="px-3 py-1 rounded-full bg-accent text-[10px] font-medium text-white hover:bg-accent/90 transition-all shadow-sm shadow-accent/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
                          {locale === "zh" ? "更新发布" : "Update"}
                        </button>
                        <button onClick={() => void handleUnpublish()} disabled={genStatus !== "ready"} className="px-3 py-1 rounded-full bg-gray-800 text-[10px] font-medium text-white hover:bg-gray-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                          {locale === "zh" ? "取消发布" : "Unpublish"}
                        </button>
                      </>
                    ) : (
                      <button onClick={() => void handlePublish()} disabled={genStatus !== "ready"} className="px-3 py-1 rounded-full bg-accent text-[10px] font-medium text-white hover:bg-accent/90 transition-all shadow-sm shadow-accent/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none">
                        {locale === "zh" ? "发布站点" : "Publish"}
                      </button>
                    )}
                    <a href={publishedUrl || previewUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1 rounded-full text-[10px] text-gray-500 hover:bg-gray-100 transition-all flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      {locale === "zh" ? "打开" : "Open"}
                    </a>
                  </div>
                  {publishedUrl && (
                    <p className="mt-2 text-[10px] text-gray-400">
                      {locale === "zh" ? "已发布：" : "Live: "}
                      <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{publishedUrl}</a>
                    </p>
                  )}
                  {selectedTemplate && !siteId && (
                    <p className="mt-2 text-[10px] text-gray-400 italic">
                      {locale === "zh"
                        ? `模板预览「${selectedTemplate.nameCn}」— 发送内容后生成你的专属站点`
                        : `Template "${selectedTemplate.name}" — send your content to generate your site`}
                    </p>
                  )}
                </div>
              )}

              {/* Preview content */}
              {previewTab === "preview" && (
                genStatus === "generating" ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-gray-50 via-white to-accent/3">
                    {/* Animated building blocks */}
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 rounded-2xl bg-accent/10 animate-ping" style={{ animationDuration: "2s" }} />
                      <div className="absolute inset-1 rounded-xl bg-accent/5 animate-pulse" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-7 h-7 text-accent animate-spin" style={{ animationDuration: "3s" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">{locale === "zh" ? "正在构建你的网站" : "Building your site"}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{locale === "zh" ? "AI 正在编写代码、组装页面..." : "AI is writing code, assembling pages..."}</p>
                    </div>
                    {thinkingSteps.length > 0 && (
                      <div className="max-w-xs w-full space-y-1.5 mt-2">
                        {thinkingSteps.map((s, i) => (
                          <div key={i} className="flex items-center gap-2 text-[10px] text-gray-500 font-mono animate-[fadeSlideIn_0.3s_ease]">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${i === thinkingSteps.length - 1 ? "bg-accent animate-pulse" : "bg-gray-300"}`} />
                            {s}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : previewUrl ? (
                  <iframe key={previewKey} src={`${previewUrl}?t=${previewKey}`} className="flex-1 w-full border-0 bg-white" title="Preview" />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-gray-50 via-white to-accent/3">
                    <div className="w-12 h-12 rounded-2xl bg-accent/5 flex items-center justify-center">
                      <svg className="w-6 h-6 text-accent/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <p className="text-xs text-gray-400">{locale === "zh" ? "回答几个问题后自动生成预览" : "Preview appears after a few questions"}</p>
                  </div>
                )
              )}

              </div>{/* end browser window */}

              {previewTab === "resources" && (
                <div className="flex-1 overflow-y-auto bg-white">
                  <div className="p-5 border-b border-gray-200/60">
                    <h3 className="text-sm font-medium text-gray-800">{locale === "zh" ? "项目资源" : "Project Resources"}</h3>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {locale === "zh"
                        ? "本次网站生成使用的知识库和内容来源。"
                        : "Knowledge bases and content sources used for this site build."}
                    </p>
                  </div>
                  <div className="p-5 space-y-4">
                    {/* Knowledge Base source */}
                    {selectedBaseIds.length > 0 && (
                      <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm">📚</span>
                          <p className="text-xs font-medium text-gray-800">{locale === "zh" ? "关联知识库" : "Linked KBs"} ({selectedBaseIds.length})</p>
                        </div>
                        <div className="space-y-1.5">
                          {selectedBaseIds.map(bid => {
                            const kb = kbBases.find(b => b.id === bid);
                            return (
                              <div key={bid} className="flex items-center justify-between text-[11px]">
                                <span className="text-gray-600 truncate">{kb?.name || bid}</span>
                                <span className="text-[9px] text-gray-400 shrink-0 ml-2">{kb?.fileCount || 0}{locale === "zh" ? "文件" : "f"}</span>
                              </div>
                            );
                          })}
                        </div>
                        <a href="/knowledge" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[10px] text-accent hover:underline">
                          {locale === "zh" ? "管理知识库 →" : "Manage KBs →"}
                        </a>
                      </div>
                    )}
                    {/* Legacy knowledge items */}
                    {siteResources.length > 0 && (
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm">📋</span>
                          <p className="text-xs font-medium text-gray-700">{locale === "zh" ? "知识条目" : "Knowledge Items"}</p>
                        </div>
                        <p className="mt-1 text-[11px] text-gray-500">
                          {locale === "zh"
                            ? `${siteResources.length} 条用于本次构建`
                            : `${siteResources.length} items used for this build`}
                        </p>
                        <div className="mt-3 space-y-2">
                          {siteResources.map((resource) => (
                            <div key={resource.id} className="rounded-lg bg-white border border-gray-200 px-3 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-[11px] font-medium text-gray-700 truncate">{resource.title}</p>
                                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[9px] text-gray-500">{resource.category}</span>
                              </div>
                              <p className="mt-1 text-[10px] text-gray-500">{resource.sourceName} · {resource.sourceType}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedBaseIds.length === 0 && siteResources.length === 0 && (
                      <div className="text-center py-8">
                        <p className="text-3xl mb-2">📭</p>
                        <p className="text-[11px] text-gray-500">
                          {locale === "zh" ? "没有关联的知识库或内容来源。" : "No linked knowledge base or content sources."}
                        </p>
                        <a href="/knowledge" className="mt-2 inline-block text-[10px] text-accent hover:underline">
                          {locale === "zh" ? "去创建知识库" : "Create knowledge base"}
                        </a>
                      </div>
                    )}
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
                {/* List / Graph toggle */}
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setKnowledgeViewMode("list")}
                    className={`px-2.5 py-1.5 text-[10px] transition-all ${knowledgeViewMode === "list" ? "bg-accent text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                  </button>
                  <button
                    onClick={() => setKnowledgeViewMode("graph")}
                    className={`px-2.5 py-1.5 text-[10px] transition-all ${knowledgeViewMode === "graph" ? "bg-accent text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2" strokeWidth={2} /><circle cx="18" cy="6" r="2" strokeWidth={2} /><circle cx="12" cy="18" r="2" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 7.5l3 7.5m6-7.5l-3 7.5" /></svg>
                  </button>
                </div>
                {knowledgeViewMode === "list" && (
                  <>
                    <input type="text" placeholder={locale === "zh" ? "搜索知识..." : "Search..."} value={knowledgeSearch} onChange={e => setKnowledgeSearch(e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-xs text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-accent/50 w-48" />
                    <button onClick={async () => { const allSel = items.every(i => i.selected); const newVal = !allSel; setItems(p => p.map(i => ({ ...i, selected: newVal }))); await fetch("/api/knowledge", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selected: newVal }) }); await loadGroups(); }} className="px-3 py-1.5 rounded-lg bg-gray-100 text-[10px] text-gray-400 hover:bg-gray-200/50 transition-all">
                      {items.every(i => i.selected) ? (locale === "zh" ? "全部取消" : "Deselect all") : (locale === "zh" ? "全部选择" : "Select all")}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Graph view */}
            {knowledgeViewMode === "graph" && <KnowledgeGraph />}

            {/* List view */}
            {knowledgeViewMode === "list" && <div className="flex-1 overflow-y-auto p-6">
              {!itemsLoaded ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}</div>
              : kGroups.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center"><span className="text-2xl opacity-30">📚</span></div>
                  <p className="text-gray-500">{locale === "zh" ? "暂无知识。前往数据源添加内容。" : "No knowledge. Add sources first."}</p>
                  <button onClick={() => router.push("/knowledge")} className="mt-4 px-4 py-2 rounded-lg bg-accent/10 text-accent text-xs hover:bg-accent/20 transition-all">{locale === "zh" ? "添加数据源" : "Add Sources"}</button>
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
            </div>}
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
