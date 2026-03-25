"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { useLocale } from "@/components/LocaleProvider";

interface UserItem { id: string; name: string | null; email: string | null; role: string | null; createdAt: string | null; siteCount: number; knowledgeCount: number }

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { locale } = useLocale();
  const zh = locale === "zh";
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);
  useEffect(() => { if (session?.user) fetch("/api/admin/users").then(r => r.json()).then(d => { setUsers(d.users || []); setLoading(false); }); }, [session]);

  if (status === "loading" || !session?.user) return null;

  return (
    <div className="min-h-screen relative">
      <div className="wizard-bg"><div className="orb orb-1" /><div className="orb orb-2" /></div>
      <Navbar />
      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-24 pb-12">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-600 transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {zh ? "返回管理后台" : "Back to Admin"}
        </Link>
        <h1 className="text-2xl font-bold mb-6">{zh ? "用户管理" : "Users"}</h1>

        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}</div>
        ) : users.length === 0 ? (
          <p className="text-gray-500 text-sm">{zh ? "暂无用户" : "No users yet."}</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-3 px-4 py-2 text-[10px] text-gray-400 uppercase tracking-wider">
              <div className="col-span-3">{zh ? "姓名" : "Name"}</div>
              <div className="col-span-3">{zh ? "邮箱" : "Email"}</div>
              <div className="col-span-1">{zh ? "角色" : "Role"}</div>
              <div className="col-span-1 text-center">{zh ? "网站" : "Sites"}</div>
              <div className="col-span-2 text-center">{zh ? "知识" : "Knowledge"}</div>
              <div className="col-span-2">{zh ? "注册时间" : "Joined"}</div>
            </div>
            {users.map(u => (
              <div key={u.id} className="grid grid-cols-12 gap-3 items-center px-4 py-3 rounded-xl bg-white border border-gray-200">
                <div className="col-span-3 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 shrink-0">{u.name?.[0] || u.email?.[0] || "U"}</div>
                  <span className="text-xs text-white/70 truncate">{u.name || "—"}</span>
                </div>
                <div className="col-span-3 text-xs text-gray-400 truncate">{u.email || "—"}</div>
                <div className="col-span-1"><span className={`text-[10px] px-1.5 py-0.5 rounded ${u.role === "admin" ? "bg-accent/20 text-accent" : "bg-gray-100 text-gray-500"}`}>{u.role || "user"}</span></div>
                <div className="col-span-1 text-xs text-gray-400 text-center">{u.siteCount}</div>
                <div className="col-span-2 text-xs text-gray-400 text-center">{u.knowledgeCount}</div>
                <div className="col-span-2 text-[10px] text-gray-400">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
