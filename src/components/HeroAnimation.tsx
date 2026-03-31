"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@/components/LocaleProvider";

const STEP_DURATION = 3200;
const TOTAL_STEPS = 5;

export default function HeroAnimation() {
  const [step, setStep] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const { locale } = useLocale();
  const zh = locale === "zh";

  const advance = useCallback(() => {
    setTransitioning(true);
    setTimeout(() => {
      setStep(s => (s + 1) % TOTAL_STEPS);
      setTransitioning(false);
    }, 400);
  }, []);

  useEffect(() => {
    const timer = setInterval(advance, STEP_DURATION);
    return () => clearInterval(timer);
  }, [advance]);

  const steps = [
    { label: zh ? "上传资料" : "Upload", icon: "📄", color: "#6366f1" },
    { label: zh ? "知识提取" : "Extract", icon: "🧠", color: "#06b6d4" },
    { label: zh ? "AI 对话" : "AI Chat", icon: "💬", color: "#a855f7" },
    { label: zh ? "生成网站" : "Generate", icon: "✨", color: "#10b981" },
    { label: zh ? "发布分享" : "Publish", icon: "🚀", color: "#f59e0b" },
  ];

  return (
    <div className="relative select-none">
      {/* Soft glow behind the frame */}
      <div className="absolute -inset-6 bg-gradient-to-br from-violet-300/20 via-cyan-200/15 to-fuchsia-200/10 blur-3xl rounded-full" />

      {/* Main frame — floating card feel */}
      <div className="relative rounded-[20px] bg-white/80 backdrop-blur-sm shadow-[0_8px_40px_rgba(99,102,241,0.08),0_2px_8px_rgba(0,0,0,0.04)] border border-white/60 overflow-hidden">
        {/* Minimal browser chrome */}
        <div className="flex items-center gap-2.5 px-4 py-2 bg-white/60">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gray-300/80" />
            <div className="w-2 h-2 rounded-full bg-gray-300/80" />
            <div className="w-2 h-2 rounded-full bg-gray-300/80" />
          </div>
          <div className="flex-1 mx-1 px-3 py-0.5 rounded-md bg-gray-100/60 text-[9px] text-gray-400 truncate">
            createanysite.com
          </div>
        </div>

        {/* Screen content */}
        <div className="relative bg-gradient-to-b from-gray-50/80 to-white/50" style={{ aspectRatio: "4/3" }}>
          <div className={`absolute inset-0 transition-opacity duration-400 ${transitioning ? "opacity-0" : "opacity-100"}`}>
            {step === 0 && <UploadScene zh={zh} />}
            {step === 1 && <ExtractScene zh={zh} />}
            {step === 2 && <ChatScene zh={zh} />}
            {step === 3 && <GenerateScene zh={zh} />}
            {step === 4 && <PublishScene zh={zh} />}
          </div>
        </div>

        {/* Step indicators — pill style */}
        <div className="flex items-center justify-center gap-1 px-3 py-2.5 bg-white/60">
          {steps.map((s, i) => (
            <button
              key={i}
              onClick={() => { setTransitioning(true); setTimeout(() => { setStep(i); setTransitioning(false); }, 300); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] transition-all cursor-pointer ${step === i ? "text-gray-700 font-medium" : "text-gray-400 hover:text-gray-500"}`}
              style={step === i ? { background: `${s.color}10` } : {}}
            >
              <span className="text-xs">{s.icon}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===== Scene Components ===== */

function UploadScene({ zh }: { zh: boolean }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-4">
      {/* Drop zone */}
      <div className="w-full max-w-[280px] border-2 border-dashed border-indigo-200 rounded-xl p-6 text-center bg-white animate-[fadeSlideUp_0.5s_ease]">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-indigo-50 flex items-center justify-center">
          <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
        </div>
        <p className="text-sm font-medium text-gray-700">{zh ? "拖拽文件到这里" : "Drop files here"}</p>
        <p className="text-[10px] text-gray-400 mt-1">PDF, DOCX, TXT, ZIP</p>
      </div>
      {/* Animated file cards entering */}
      <div className="flex gap-2">
        {["resume.pdf", "projects.md", "skills.txt"].map((f, i) => (
          <div
            key={f}
            className="px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm text-[10px] text-gray-600 flex items-center gap-1.5"
            style={{ animation: `fadeSlideUp 0.4s ${0.3 + i * 0.15}s ease both` }}
          >
            <span className="text-indigo-500">📎</span> {f}
          </div>
        ))}
      </div>
      {/* Progress */}
      <div className="w-full max-w-[280px]" style={{ animation: "fadeSlideUp 0.4s 0.8s ease both" }}>
        <div className="flex items-center gap-2 text-[10px] text-indigo-500">
          <div className="w-3 h-3 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
          {zh ? "正在上传..." : "Uploading..."}
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-[progressFill_2s_0.8s_ease_both]" />
        </div>
      </div>
    </div>
  );
}

function ExtractScene({ zh }: { zh: boolean }) {
  const categories = [
    { label: zh ? "工作经历" : "Experience", color: "#22c55e", count: 4 },
    { label: zh ? "技能" : "Skills", color: "#eab308", count: 8 },
    { label: zh ? "项目" : "Projects", color: "#6366f1", count: 3 },
    { label: zh ? "事实" : "Facts", color: "#3b82f6", count: 6 },
    { label: zh ? "观点" : "Opinions", color: "#f97316", count: 2 },
  ];

  return (
    <div className="h-full flex flex-col p-5 gap-3">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-700" style={{ animation: "fadeSlideUp 0.4s ease both" }}>
        <span className="text-lg">🧠</span> {zh ? "AI 正在提取知识..." : "AI extracting knowledge..."}
      </div>
      {/* Knowledge cards appearing */}
      <div className="flex-1 grid grid-cols-2 gap-2 overflow-hidden">
        {categories.map((cat, i) => (
          <div
            key={cat.label}
            className="rounded-xl border border-gray-200 bg-white p-3 flex items-center gap-3"
            style={{ animation: `fadeSlideUp 0.4s ${0.2 + i * 0.2}s ease both` }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ background: cat.color }}>
              {cat.count}
            </div>
            <div>
              <p className="text-[11px] font-medium text-gray-700">{cat.label}</p>
              <p className="text-[9px] text-gray-400">{cat.count} {zh ? "条" : "items"}</p>
            </div>
          </div>
        ))}
        {/* Relation lines animation */}
        <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-3 flex items-center gap-3" style={{ animation: "fadeSlideUp 0.4s 1.2s ease both" }}>
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />→
            <span className="w-2 h-2 rounded-full bg-emerald-400" />→
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
          <p className="text-[10px] text-gray-500">{zh ? "发现 12 条知识关联" : "12 knowledge relations found"}</p>
        </div>
      </div>
    </div>
  );
}

function ChatScene({ zh }: { zh: boolean }) {
  const messages = [
    { role: "user", text: zh ? "帮我做一个科技感的品牌官网" : "Build me a tech-style brand site", delay: 0 },
    { role: "ai", text: zh ? "好的！我为你选择了赛博朋克主题，包含首页、项目展示、团队介绍和联系方式。" : "Sure! I'll use the cyberpunk theme with hero, projects, team, and contact.", delay: 0.5 },
    { role: "user", text: zh ? "加入 3D 粒子背景效果" : "Add 3D particle background", delay: 1.0 },
    { role: "ai", text: zh ? "已添加 Three.js 粒子效果 ✨ 正在生成预览..." : "Added Three.js particles ✨ Generating preview...", delay: 1.5 },
  ];

  return (
    <div className="h-full flex flex-col p-4 gap-2.5">
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1" style={{ animation: "fadeIn 0.3s ease both" }}>
        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        {zh ? "AI 构建助手" : "AI Build Agent"}
      </div>
      <div className="flex-1 flex flex-col gap-2 overflow-hidden">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            style={{ animation: `fadeSlideUp 0.35s ${msg.delay}s ease both` }}
          >
            <div className={`max-w-[80%] px-3 py-2 text-[11px] leading-relaxed ${
              msg.role === "user"
                ? "bg-indigo-500 text-white rounded-xl rounded-br-sm"
                : "bg-white border border-gray-200 text-gray-700 rounded-xl rounded-bl-sm"
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>
      {/* Typing indicator */}
      <div className="flex items-center gap-1 px-3 py-2 bg-white border border-gray-200 rounded-xl w-fit" style={{ animation: "fadeSlideUp 0.3s 2s ease both" }}>
        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0s" }} />
        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.15s" }} />
        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.3s" }} />
      </div>
    </div>
  );
}

function GenerateScene({ zh }: { zh: boolean }) {
  return (
    <div className="h-full flex flex-col">
      {/* Mini browser showing generated site */}
      <div className="flex-1 relative overflow-hidden">
        {/* Dark site preview mock */}
        <div className="absolute inset-0 bg-[#0a0a1a] text-white p-4" style={{ animation: "fadeIn 0.5s ease both" }}>
          {/* Nav */}
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="text-[10px] font-mono text-cyan-400">PORTFOLIO</div>
            <div className="flex gap-3 text-[8px] text-gray-500">
              <span>Projects</span><span>Skills</span><span>Contact</span>
            </div>
          </div>
          {/* Hero */}
          <div className="text-center py-3" style={{ animation: "fadeSlideUp 0.4s 0.3s ease both" }}>
            <div className="text-[8px] text-cyan-400/60 tracking-widest mb-1">HELLO WORLD</div>
            <div className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">Sarah Chen</div>
            <div className="text-[9px] text-gray-400 mt-0.5">Senior Frontend Engineer</div>
          </div>
          {/* Project cards */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-lg bg-white/5 border border-white/10 p-2" style={{ animation: `fadeSlideUp 0.4s ${0.5 + i * 0.15}s ease both` }}>
                <div className="h-10 rounded bg-gradient-to-br from-cyan-500/20 to-purple-500/20 mb-1.5" />
                <div className="h-1.5 w-3/4 rounded bg-white/20 mb-1" />
                <div className="h-1 w-1/2 rounded bg-white/10" />
              </div>
            ))}
          </div>
          {/* Skills */}
          <div className="flex gap-1.5 mt-3 flex-wrap" style={{ animation: "fadeSlideUp 0.4s 1.1s ease both" }}>
            {["React", "TypeScript", "Node.js", "Three.js"].map(s => (
              <span key={s} className="px-2 py-0.5 rounded text-[7px] bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">{s}</span>
            ))}
          </div>
        </div>
        {/* Build overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-center gap-2" style={{ animation: "fadeIn 0.3s 0.2s ease both" }}>
          <div className="w-4 h-4 border-2 border-emerald-300/30 border-t-emerald-400 rounded-full animate-spin" />
          <span className="text-[10px] text-emerald-400">{zh ? "网站已生成 ✓" : "Site generated ✓"}</span>
        </div>
      </div>
    </div>
  );
}

function PublishScene({ zh }: { zh: boolean }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 gap-4">
      {/* Success checkmark */}
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center" style={{ animation: "fadeSlideUp 0.5s ease both" }}>
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ animation: "drawCheck 0.5s 0.3s ease both", strokeDasharray: 24, strokeDashoffset: 24 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="text-center" style={{ animation: "fadeSlideUp 0.4s 0.4s ease both" }}>
        <p className="text-base font-semibold text-gray-800">{zh ? "发布成功！" : "Published!"}</p>
        <p className="text-xs text-gray-500 mt-1">createanysite.com/sarah-chen</p>
      </div>
      {/* Share options */}
      <div className="flex gap-2" style={{ animation: "fadeSlideUp 0.4s 0.7s ease both" }}>
        {[
          { label: zh ? "复制链接" : "Copy Link", icon: "🔗" },
          { label: zh ? "生成海报" : "Poster", icon: "🖼️" },
          { label: zh ? "二维码" : "QR Code", icon: "📱" },
        ].map(s => (
          <div key={s.label} className="px-3 py-2 rounded-lg bg-white border border-gray-200 shadow-sm text-[10px] text-gray-600 flex items-center gap-1.5">
            <span>{s.icon}</span> {s.label}
          </div>
        ))}
      </div>
      {/* Visitor counter */}
      <div className="flex items-center gap-2 text-[10px] text-gray-400" style={{ animation: "fadeSlideUp 0.4s 1s ease both" }}>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        {zh ? "3 人正在浏览你的网站" : "3 visitors on your site now"}
      </div>
    </div>
  );
}
