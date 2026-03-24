"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useLocale } from "@/components/LocaleProvider";

interface Stats { users: number; sites: number; skills: number; knowledgeItems: number; templates: number }

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { locale } = useLocale();
  const [stats, setStats] = useState<Stats | null>(null);
  const zh = locale === "zh";

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);
  useEffect(() => { if (session?.user) fetch("/api/admin/stats").then(r => r.json()).then(setStats); }, [session]);

  if (status === "loading" || !session?.user) return null;

  const cards = [
    { label: zh ? "用户" : "Users", value: stats?.users ?? "—", href: "/admin/users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z", color: "from-blue-500/20 to-cyan-500/20" },
    { label: zh ? "网站模板" : "Templates", value: stats?.templates ?? "—", href: "/admin/templates", icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z", color: "from-violet-500/20 to-purple-500/20" },
    { label: "Skills", value: stats?.skills ?? "—", href: "/admin/skills", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z", color: "from-yellow-500/20 to-amber-500/20" },
    { label: zh ? "已创建网站" : "Sites", value: stats?.sites ?? "—", href: "#", icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064", color: "from-green-500/20 to-emerald-500/20" },
    { label: zh ? "知识条目" : "Knowledge", value: stats?.knowledgeItems ?? "—", href: "#", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", color: "from-pink-500/20 to-rose-500/20" },
  ];

  const quickLinks = [
    { label: zh ? "管理 Skills" : "Manage Skills", desc: zh ? "添加、编辑、启用/禁用构建技能" : "Add, edit, enable/disable skills", href: "/admin/skills" },
    { label: zh ? "管理模板" : "Manage Templates", desc: zh ? "创建和管理完整网站模板" : "Create and manage website templates", href: "/admin/templates" },
    { label: zh ? "查看用户" : "View Users", desc: zh ? "查看注册用户和活动数据" : "See registered users and activity", href: "/admin/users" },
  ];

  return (
    <div className="min-h-screen relative">
      <div className="wizard-bg"><div className="orb orb-1" /><div className="orb orb-2" /></div>
      <Navbar />
      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-24 pb-12">
        <h1 className="text-2xl font-bold mb-2">{zh ? "管理后台" : "Admin Dashboard"}</h1>
        <p className="text-sm text-text-muted mb-8">{zh ? "管理模板、技能和用户" : "Manage templates, skills, and users"}</p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-10">
          {cards.map(c => (
            <Link key={c.label} href={c.href} className={`p-4 rounded-2xl bg-gradient-to-br ${c.color} border border-white/5 hover:border-white/10 transition-all group`}>
              <svg className="w-5 h-5 text-white/30 mb-3 group-hover:text-white/50 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={c.icon} /></svg>
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-[10px] text-white/35 mt-1">{c.label}</div>
            </Link>
          ))}
        </div>

        <h2 className="text-sm font-semibold text-white/50 mb-4">{zh ? "快捷操作" : "Quick Actions"}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {quickLinks.map(item => (
            <Link key={item.href} href={item.href} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-accent/20 hover:bg-white/[0.05] transition-all group">
              <h3 className="text-sm font-medium group-hover:text-accent transition-colors">{item.label}</h3>
              <p className="text-[10px] text-white/25 mt-1">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
