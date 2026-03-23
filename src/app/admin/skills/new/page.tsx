"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Navbar from "@/components/Navbar";
import SkillForm from "@/components/SkillForm";

export default function NewSkillPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    const res = await fetch("/api/admin/skills", {
      method: "POST",
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
        <h1 className="text-2xl font-bold mb-8">Add New Skill</h1>
        <SkillForm onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
