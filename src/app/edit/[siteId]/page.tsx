"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

// ---- Helpers ----

/** Safely parse JSON from a fetch Response. Returns { error: "..." } on failure. */
async function safeJson(res: Response): Promise<any> {
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : { error: `HTTP ${res.status} (empty response)` };
  } catch {
    return { error: `HTTP ${res.status} (invalid JSON)` };
  }
}

// ---- Types ----

interface EditSession {
  id: string;
  status: string;
  intent: string;
  instruction: string;
  changeCount: number;
  buildSuccess: boolean;
  buildError: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface SiteInfo {
  id: string;
  name: string;
  previewUrl: string | null;
  publishedUrl: string | null;
  buildStatus: string;
  status: string;
  slug: string;
}

// ---- Intent badges ----

const INTENT_COLORS: Record<string, string> = {
  style: "bg-purple-100 text-purple-700",
  content: "bg-blue-100 text-blue-700",
  component: "bg-green-100 text-green-700",
  structure: "bg-orange-100 text-orange-700",
  fix: "bg-red-100 text-red-700",
};

const INTENT_LABELS: Record<string, string> = {
  style: "样式",
  content: "内容",
  component: "组件",
  structure: "结构",
  fix: "修复",
};

// ---- Quick actions ----

const QUICK_ACTIONS = [
  { label: "改配色", icon: "🎨", instruction: "换一套配色方案，保持整体风格协调" },
  { label: "改文案", icon: "✏️", instruction: "优化页面文案，使其更加专业和吸引人" },
  { label: "改布局", icon: "📐", instruction: "调整页面布局，让内容展示更加合理" },
  { label: "修复错误", icon: "🔧", instruction: "__AUTOFIX__" },
];

// ---- Main page ----

export default function EditWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const siteId = params.siteId as string;

  const [site, setSite] = useState<SiteInfo | null>(null);
  const [sessions, setSessions] = useState<EditSession[]>([]);
  const [instruction, setInstruction] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0); // Force iframe refresh
  const [publishing, setPublishing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load site info
  useEffect(() => {
    fetch(`/api/sites/${siteId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error || !data.site) {
          router.push("/dashboard");
          return;
        }
        setSite({
          id: data.site.id,
          name: data.site.name,
          previewUrl: data.site.previewUrl,
          publishedUrl: data.site.publishedUrl || null,
          buildStatus: data.site.buildStatus || "idle",
          status: data.site.status || "draft",
          slug: data.site.slug,
        });
      })
      .catch(() => router.push("/dashboard"));
  }, [siteId, router]);

  // Load edit history
  const loadHistory = useCallback(() => {
    fetch(`/api/edit?siteId=${siteId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.sessions) setSessions(data.sessions);
      })
      .catch(() => {});
  }, [siteId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Edit progress phase for centered overlay display
  const [editPhase, setEditPhase] = useState<string | null>(null);
  const [editElapsed, setEditElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Submit edit
  const handleSubmit = async (text?: string) => {
    const instr = text || instruction.trim();
    if (!instr || isEditing) return;

    setIsEditing(true);
    setEditPhase("分析编辑意图...");
    setEditElapsed(0);
    setEditStatus(null);

    // Elapsed timer (ticks every second)
    const startTime = Date.now();
    elapsedRef.current = setInterval(() => {
      setEditElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    // Progress phase updates
    const phaseTimers = [
      setTimeout(() => setEditPhase("AI 正在分析代码并生成修改方案..."), 3000),
      setTimeout(() => setEditPhase("正在应用修改并构建验证..."), 20000),
      setTimeout(() => setEditPhase("构建验证中，请稍候..."), 40000),
    ];

    try {
      const res = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, instruction: instr }),
      });

      const result = await safeJson(res);

      // Handle API-level errors (500, 400, etc.)
      if (!res.ok || result.error) {
        setEditStatus(`编辑失败: ${result.error || `HTTP ${res.status}`}`);
      } else if (result.buildSuccess) {
        setEditStatus("✅ 编辑成功！预览已更新");
        setPreviewKey((k) => k + 1); // Refresh preview
        // Refetch site to get updated previewUrl
        fetch(`/api/sites/${siteId}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.site) {
              setSite((prev) => prev ? { ...prev, ...data.site } : prev);
            }
          })
          .catch(() => {});
        setInstruction("");
      } else {
        setEditStatus(`编辑失败: ${result.buildError?.slice(0, 200) || result.summary || "未知错误"}`);
        setInstruction("");
      }

      loadHistory();
    } catch (err) {
      setEditStatus(`请求失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      phaseTimers.forEach(clearTimeout);
      if (elapsedRef.current) clearInterval(elapsedRef.current);
      setIsEditing(false);
      setEditPhase(null);
      setEditElapsed(0);
      setTimeout(() => setEditStatus(null), 6000);
    }
  };

  // Undo
  const handleUndo = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/edit/${sessionId}/undo`, { method: "POST" });
      const result = await safeJson(res);
      if (result.success) {
        setEditStatus("已撤销");
        setPreviewKey((k) => k + 1);
        loadHistory();
      } else {
        setEditStatus(`撤销失败: ${result.error || "未知错误"}`);
      }
    } catch {
      setEditStatus("撤销请求失败");
    }
    setTimeout(() => setEditStatus(null), 3000);
  };

  // Publish / Update
  const handlePublish = async () => {
    if (!site) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });
      const result = await safeJson(res);
      if (result.site) {
        setSite((prev) =>
          prev
            ? {
                ...prev,
                status: result.site.status ?? "published",
                publishedUrl: result.site.publishedUrl ?? prev.publishedUrl,
              }
            : prev,
        );
        setEditStatus("发布成功！站点已更新");
      } else {
        setEditStatus(`发布失败: ${result.error || "未知错误"}`);
      }
    } catch (err) {
      setEditStatus(`发布请求失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setPublishing(false);
      setTimeout(() => setEditStatus(null), 4000);
    }
  };

  if (!site) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">加载中...</div>
      </div>
    );
  }

  const previewUrl = site.previewUrl
    ? `${site.previewUrl}${site.previewUrl.includes("?") ? "&" : "?"}v=${previewKey}`
    : null;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-sm font-semibold text-gray-900">{site.name}</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            {site.buildStatus === "ready" ? "已构建" : site.buildStatus}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              新窗口打开
            </a>
          )}
          {site && site.publishedUrl && (
            <a
              href={site.publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              已发布
            </a>
          )}
          <button
            onClick={handlePublish}
            disabled={publishing || isEditing || !site || site.buildStatus !== "ready"}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {publishing
              ? "发布中..."
              : site?.status === "published"
                ? "更新发布"
                : "发布站点"}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel — edit controls */}
        <div className="w-80 flex flex-col border-r border-gray-200 bg-white shrink-0">
          {/* Instruction input */}
          <div className="p-4 border-b border-gray-100">
            <textarea
              ref={textareaRef}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="描述你想修改的内容..."
              className="w-full h-20 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder-gray-400"
              disabled={isEditing}
            />
            <button
              onClick={() => handleSubmit()}
              disabled={isEditing || !instruction.trim()}
              className="mt-2 w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isEditing ? "编辑中..." : "应用修改"}
            </button>
          </div>

          {/* Quick actions */}
          <div className="p-4 border-b border-gray-100">
            <div className="text-xs font-medium text-gray-500 mb-2">快捷操作</div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => handleSubmit(action.instruction)}
                  disabled={isEditing}
                  className="px-2 py-1.5 text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-700 disabled:opacity-50 transition-colors text-left"
                >
                  <span className="mr-1">{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {/* Edit history */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-xs font-medium text-gray-500 mb-2">编辑历史</div>
            {sessions.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">暂无编辑记录</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-2.5 rounded-lg border border-gray-100 bg-gray-50/50"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          INTENT_COLORS[session.intent] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {INTENT_LABELS[session.intent] || session.intent}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {session.buildSuccess ? "✅" : "❌"}
                      </span>
                      <span className="text-[10px] text-gray-400 ml-auto">
                        {formatTime(session.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 line-clamp-2">
                      {session.instruction === "__AUTOFIX__"
                        ? "自动修复：运行 guardrails 检查并修复常见错误"
                        : session.instruction.startsWith("自动修复模式：")
                          ? "自动修复（第二轮）：Edit Agent 修复剩余问题"
                          : session.instruction}
                    </p>
                    {session.buildSuccess && (
                      <button
                        onClick={() => handleUndo(session.id)}
                        className="mt-1.5 text-[10px] text-blue-600 hover:text-blue-700 font-medium"
                      >
                        ↩ 撤销
                      </button>
                    )}
                    {session.buildError && !session.buildSuccess && (
                      <p className="mt-1 text-[10px] text-red-500 line-clamp-3">
                        {session.buildError}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right panel — preview */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Status bar (non-editing result messages) */}
          {editStatus && !isEditing && (
            <div className={`px-4 py-2 text-xs font-medium shrink-0 z-20 ${
              editStatus.includes("成功") || editStatus.includes("撤销")
                ? "bg-green-50 text-green-700"
                : editStatus.includes("失败")
                  ? "bg-red-50 text-red-700"
                  : "bg-blue-50 text-blue-700"
            }`}>
              {editStatus}
            </div>
          )}

          {/* Preview iframe */}
          {previewUrl ? (
            <iframe
              key={previewKey}
              src={previewUrl}
              className="flex-1 w-full border-0"
              title="Site preview"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              暂无预览 — 请先构建站点
            </div>
          )}

          {/* Editing overlay — covers preview, shows centered progress */}
          {isEditing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm transition-opacity duration-300">
              <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white shadow-lg border border-gray-100 max-w-sm">
                {/* Spinner */}
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
                  <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                </div>
                {/* Phase text */}
                <p className="text-sm font-medium text-gray-800 text-center">
                  {editPhase || "处理中..."}
                </p>
                {/* Elapsed time */}
                <p className="text-xs text-gray-400">
                  已用时 {editElapsed < 60
                    ? `${editElapsed} 秒`
                    : `${Math.floor(editElapsed / 60)}分${editElapsed % 60}秒`
                  }
                </p>
                {/* Progress bar (indeterminate) */}
                <div className="w-48 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: "60%" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Helpers ----

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return `${diffMin}分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}小时前`;
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}
