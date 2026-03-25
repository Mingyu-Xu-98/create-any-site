"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import TemplateForm from "@/components/TemplateForm";
import { useLocale } from "@/components/LocaleProvider";

export default function NewTemplatePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { locale } = useLocale();
  const zh = locale === "zh";

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    const res = await fetch("/api/admin/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) router.push("/admin/templates");
  };

  if (status === "loading" || !session?.user) return null;

  return (
    <div className="min-h-screen relative">
      <div className="wizard-bg"><div className="orb orb-1" /><div className="orb orb-2" /></div>
      <Navbar />
      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-24 pb-12">
        <Link href="/admin/templates" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-600 transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          {zh ? "返回模板列表" : "Back to Templates"}
        </Link>
        <h1 className="text-2xl font-bold mb-8">{zh ? "添加网站模板" : "Add Site Template"}</h1>
        <TemplateForm onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
