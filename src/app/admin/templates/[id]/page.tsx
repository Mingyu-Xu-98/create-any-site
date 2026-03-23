"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import TemplateForm from "@/components/TemplateForm";

export default function EditTemplatePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [tpl, setTpl] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  useEffect(() => {
    if (session?.user && id) {
      fetch(`/api/admin/templates/${id}`).then((r) => r.json()).then((d) => { setTpl(d.template || null); setLoading(false); });
    }
  }, [session, id]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/templates/${id}`, {
      method: "PUT",
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
        <h1 className="text-2xl font-bold mb-8">Edit Template</h1>
        {loading ? <div className="h-96 rounded-xl bg-white/5 animate-pulse" /> :
          tpl ? <TemplateForm initialData={tpl} onSubmit={handleSubmit} /> : <p className="text-white/40">Not found</p>}
      </div>
    </div>
  );
}
