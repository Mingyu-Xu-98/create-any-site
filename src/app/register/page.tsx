"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";

export default function RegisterPage() {
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const router = useRouter(); const { t } = useLocale();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (password !== confirmPassword) { setError(t("register.mismatch")); return; }
    if (password.length < 6) { setError(t("register.tooShort")); return; }
    setLoading(true);
    const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed"); setLoading(false); return; }
    const loginRes = await signIn("credentials", { email, password, redirect: false });
    if (loginRes?.ok) router.push("/dashboard"); else { setError("Registration succeeded but login failed."); setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative bg-gray-50">
      <div className="wizard-bg"><div className="orb orb-1" /><div className="orb orb-2" /></div>
      <div className="relative z-10 w-full max-w-sm mx-auto px-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">{t("register.title")}<span className="text-accent">{t("register.titleHighlight")}</span></h1>
            <p className="text-sm text-gray-500 mt-2">{t("register.subtitle")}</p>
          </div>
          <form onSubmit={handleRegister} className="space-y-4">
            {error && <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm text-center">{error}</div>}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">{t("register.name")}</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10" placeholder={t("register.namePlaceholder")} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">{t("login.email")}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10" placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">{t("register.password")}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10" placeholder={t("register.passwordPlaceholder")} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">{t("register.confirmPassword")}</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10" placeholder={t("register.confirmPlaceholder")} />
            </div>
            <button type="submit" disabled={loading} className="w-full px-4 py-3 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-all disabled:opacity-50 shadow-lg shadow-accent/20">
              {loading ? t("register.loading") : t("register.submit")}
            </button>
          </form>
          <p className="text-center text-sm text-gray-400 mt-6">
            {t("register.hasAccount")} <Link href="/login" className="text-accent hover:text-accent/80">{t("register.login")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
