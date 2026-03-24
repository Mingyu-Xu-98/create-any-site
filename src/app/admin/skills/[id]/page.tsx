"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SkillForm from "@/components/SkillForm";
import { useLocale } from "@/components/LocaleProvider";

export default function EditSkillPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [skill, setSkill] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (session?.user && id) {
      fetch(`/api/admin/skills/${id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.skill) {
            const s = data.skill;
            setSkill({
              ...s,
              enabled: !!s.enabled,
            });
          }
          setLoading(false);
        });
    }
  }, [session, id]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/skills/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      router.push("/admin/skills");
    }
  };

  if (status === "loading" || !session?.user) return null;

  return (
    <div className="min-h-screen relative">
      <div className="wizard-bg">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>
      <Navbar />
      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-24 pb-12">
        <Link href="/admin/skills" className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors mb-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          返回 Skills
        </Link>
        <h1 className="text-2xl font-bold mb-8">Edit Skill</h1>
        {loading ? (
          <div className="h-96 rounded-xl bg-white/5 animate-pulse" />
        ) : skill ? (
          <SkillForm initialData={skill} onSubmit={handleSubmit} />
        ) : (
          <p className="text-white/40">Skill not found</p>
        )}
      </div>
    </div>
  );
}
