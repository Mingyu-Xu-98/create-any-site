"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import TemplateForm from "@/components/TemplateForm";

export default function NewTemplatePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

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
        <h1 className="text-2xl font-bold mb-8">Add Site Template</h1>
        <TemplateForm onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
